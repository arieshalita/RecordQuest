import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ProfileIdentityRow = {
  display_name: string | null;
  username: string | null;
};

type PushTokenRow = {
  expo_push_token: string | null;
  updated_at: string | null;
};

type FollowNotificationResponse = {
  ok: boolean;
  sent: boolean;
  reason?: string;
  detail?: string;
  httpStatus?: number;
  expoStatus?: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function safeErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "unknown_error";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function readFollowerLabel(profile: ProfileIdentityRow | null): string {
  const displayName = profile?.display_name?.trim();
  if (displayName) return displayName;

  const username = profile?.username?.trim();
  if (username) return username;

  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");

  const finalize = (status: number, payload: FollowNotificationResponse): Response => {
    return jsonResponse(status, payload as Record<string, unknown>);
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("[RecordQuest][edge-follow] missing required Supabase env vars");
      return finalize(500, {
        ok: false,
        sent: false,
        reason: "missing_supabase_env",
        detail: "SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY is missing",
      });
    }

    if (!authHeader) {
      return finalize(401, {
        ok: false,
        sent: false,
        reason: "missing_authorization",
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user?.id) {
      return finalize(401, {
        ok: false,
        sent: false,
        reason: "invalid_user",
        detail: authError?.message ?? "unable_to_resolve_user",
      });
    }

    let followedUserId = "";
    try {
      const body = (await req.json()) as { followedUserId?: string };
      followedUserId = typeof body.followedUserId === "string" ? body.followedUserId.trim() : "";
    } catch {
      followedUserId = "";
    }

    if (!followedUserId) {
      return finalize(200, {
        ok: true,
        sent: false,
        reason: "missing_followed_auth_user_id",
      });
    }

    if (!isUuid(followedUserId)) {
      return finalize(200, {
        ok: true,
        sent: false,
        reason: "missing_followed_auth_user_id",
        detail: "followedUserId must be an auth UUID",
      });
    }

    if (followedUserId === user.id) {
      return finalize(200, {
        ok: true,
        sent: false,
        reason: "self_notification_blocked",
      });
    }

    const { data: followRow, error: followError } = await serviceClient
      .from("user_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", followedUserId)
      .limit(1)
      .maybeSingle();

    if (followError) {
      console.error("[RecordQuest][edge-follow] follow lookup failed:", followError.message);
      return finalize(500, {
        ok: false,
        sent: false,
        reason: "follow_lookup_failed",
        detail: followError.message,
      });
    }

    if (!followRow) {
      return finalize(200, {
        ok: true,
        sent: false,
        reason: "follow_not_confirmed",
      });
    }

    const { data: profileRow } = await serviceClient
      .from("profiles")
      .select("display_name,username")
      .eq("user_id", user.id)
      .maybeSingle();

    const followerLabel = readFollowerLabel((profileRow as ProfileIdentityRow | null) ?? null);

    const { data: tokenRow, error: tokenError } = await serviceClient
      .from("user_push_tokens")
      .select("expo_push_token,updated_at")
      .eq("user_id", followedUserId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Target push tokens are server-only. We intentionally read with service-role here
    // so clients never need broad SELECT access to other users' tokens.

    if (tokenError) {
      console.error("[RecordQuest][edge-follow] target token lookup failed:", tokenError.message);
      return finalize(500, {
        ok: false,
        sent: false,
        reason: "target_token_lookup_failed",
        detail: tokenError.message,
      });
    }

    const targetToken = (tokenRow as PushTokenRow | null)?.expo_push_token?.trim();

    if (!targetToken) {
      return finalize(200, {
        ok: true,
        sent: false,
        reason: "no_target_token",
      });
    }

    const notificationBody = followerLabel
      ? `${followerLabel} followed you on RecordQuest`
      : "Someone followed you on RecordQuest";

    try {
      const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: targetToken,
          title: "RecordQuest",
          body: notificationBody,
          sound: "default",
        }),
      });

      const payload = (await expoResponse.json()) as {
        data?: { status?: string; message?: string } | Array<{ status?: string; message?: string }>;
        errors?: Array<{ message?: string }>;
      };

      const normalizedData = Array.isArray(payload.data) ? payload.data[0] : payload.data;
      const expoStatus = normalizedData?.status;

      if (!expoResponse.ok) {
        console.warn("[RecordQuest][edge-follow] Expo push HTTP request failed");
        return finalize(200, {
          ok: true,
          sent: false,
          reason: payload.errors?.[0]?.message ?? "expo_http_error",
          httpStatus: expoResponse.status,
          expoStatus: expoStatus ?? null,
        });
      }

      if (expoStatus !== "ok") {
        console.warn("[RecordQuest][edge-follow] Expo push request was not accepted");
        return finalize(200, {
          ok: true,
          sent: false,
          reason:
            normalizedData?.message ?? payload.errors?.[0]?.message ?? "expo_error_status",
          httpStatus: expoResponse.status,
          expoStatus: expoStatus ?? null,
        });
      }

      return finalize(200, {
        ok: true,
        sent: true,
      });
    } catch (expoError) {
      console.error("[RecordQuest][edge-follow] Expo push fetch failed:", safeErrorDetail(expoError));
      return finalize(200, {
        ok: true,
        sent: false,
        reason: "expo_fetch_error",
        detail: safeErrorDetail(expoError),
      });
    }
  } catch (unexpectedError) {
    console.error("[RecordQuest][edge-follow] unexpected server error:", safeErrorDetail(unexpectedError));
    return finalize(500, {
      ok: false,
      sent: false,
      reason: "unexpected_server_error",
      detail: safeErrorDetail(unexpectedError),
    });
  }
});
