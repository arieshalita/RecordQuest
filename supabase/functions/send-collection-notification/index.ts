import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CollectionRow = {
  id: number;
  user_id: string;
  album: string | null;
  artist: string | null;
};

type ProfileIdentityRow = {
  display_name: string | null;
  username: string | null;
};

type FollowRow = {
  follower_id: string;
};

type PushTokenRow = {
  user_id: string;
  expo_push_token: string | null;
  updated_at: string | null;
};

type ExpoPushTicket = {
  status?: string;
  message?: string;
};

type CollectionNotificationResponse = {
  ok: boolean;
  sent: boolean;
  reason?: string;
  detail?: string;
  recipientCount?: number;
  sentCount?: number;
  failedCount?: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(status: number, payload: CollectionNotificationResponse): Response {
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

function readActorName(profile: ProfileIdentityRow | null): string {
  const displayName = profile?.display_name?.trim();
  if (displayName) return displayName;

  const username = profile?.username?.trim();
  if (username) return username;

  return "Someone";
}

function readCollectionItemId(body: unknown): number | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = (body as { collectionItemId?: unknown }).collectionItemId;

  if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
    return candidate;
  }

  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (!trimmed) return null;

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function dedupeFollowerIds(rows: FollowRow[], callerUserId: string): string[] {
  const ids = new Set<string>();

  for (const row of rows) {
    const followerId = row.follower_id?.trim();
    if (!followerId || followerId === callerUserId) {
      continue;
    }

    ids.add(followerId);
  }

  return Array.from(ids);
}

function dedupeLatestTokens(rows: PushTokenRow[]): string[] {
  const userToToken = new Map<string, string>();

  for (const row of rows) {
    const userId = row.user_id?.trim();
    const token = row.expo_push_token?.trim();

    if (!userId || !token) {
      continue;
    }

    if (!userToToken.has(userId)) {
      userToToken.set(userId, token);
    }
  }

  return Array.from(new Set(userToToken.values()));
}

function buildNotificationBody(
  actorName: string,
  albumTitle: string,
  artistName: string
): string {
  const safeActor = actorName.trim() || "Someone";
  const safeAlbum = albumTitle.trim();
  const safeArtist = artistName.trim();

  if (safeAlbum && safeArtist) {
    return `${safeActor} added ${safeAlbum} by ${safeArtist} to their collection`;
  }

  if (safeAlbum) {
    return `${safeActor} added ${safeAlbum} to their collection`;
  }

  return "Someone added a new record to their collection";
}

function chunk<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[RecordQuest][edge-collection] function started");

  const authHeader = req.headers.get("Authorization");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("[RecordQuest][edge-collection] missing required Supabase env vars");
      return jsonResponse(500, {
        ok: false,
        sent: false,
        reason: "missing_supabase_env",
        detail: "SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY is missing",
      });
    }

    if (!authHeader) {
      return jsonResponse(401, {
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

    console.log("[RecordQuest][edge-collection] caller authenticated:", Boolean(user?.id) && !authError);

    if (authError || !user?.id) {
      return jsonResponse(401, {
        ok: false,
        sent: false,
        reason: "invalid_user",
        detail: authError?.message ?? "unable_to_resolve_user",
      });
    }

    let collectionItemId: number | null = null;
    try {
      const body = (await req.json()) as unknown;
      collectionItemId = readCollectionItemId(body);
    } catch {
      collectionItemId = null;
    }

    console.log("[RecordQuest][edge-collection] collectionItemId present:", Boolean(collectionItemId));

    if (!collectionItemId) {
      console.log("[RecordQuest][edge-collection] final sent:", false);
      console.log("[RecordQuest][edge-collection] safe reason:", "invalid_collection_item");
      return jsonResponse(200, {
        ok: true,
        sent: false,
        reason: "invalid_collection_item",
      });
    }

    const { data: collectionRow, error: collectionError } = await serviceClient
      .from("records")
      .select("id,user_id,album,artist")
      .eq("id", collectionItemId)
      .limit(1)
      .maybeSingle();

    if (collectionError) {
      console.error("[RecordQuest][edge-collection] collection lookup failed:", collectionError.message);
      return jsonResponse(500, {
        ok: false,
        sent: false,
        reason: "collection_lookup_failed",
        detail: collectionError.message,
      });
    }

    console.log("[RecordQuest][edge-collection] collection row found:", Boolean(collectionRow));

    if (!collectionRow) {
      console.log("[RecordQuest][edge-collection] final sent:", false);
      console.log("[RecordQuest][edge-collection] safe reason:", "invalid_collection_item");
      return jsonResponse(200, {
        ok: true,
        sent: false,
        reason: "invalid_collection_item",
      });
    }

    const typedCollectionRow = collectionRow as CollectionRow;
    const ownershipConfirmed = typedCollectionRow.user_id === user.id;
    console.log("[RecordQuest][edge-collection] ownership confirmed:", ownershipConfirmed);

    if (!ownershipConfirmed) {
      console.log("[RecordQuest][edge-collection] final sent:", false);
      console.log(
        "[RecordQuest][edge-collection] safe reason:",
        "collection_item_not_owned_by_caller"
      );
      return jsonResponse(200, {
        ok: true,
        sent: false,
        reason: "collection_item_not_owned_by_caller",
      });
    }

    const { data: profileRow } = await serviceClient
      .from("profiles")
      .select("display_name,username")
      .eq("user_id", user.id)
      .maybeSingle();

    const actorName = readActorName((profileRow as ProfileIdentityRow | null) ?? null);

    const { data: followRows, error: followError } = await serviceClient
      .from("user_follows")
      .select("follower_id")
      .eq("following_id", user.id);

    if (followError) {
      console.error("[RecordQuest][edge-collection] followers lookup failed:", followError.message);
      return jsonResponse(500, {
        ok: false,
        sent: false,
        reason: "followers_lookup_failed",
        detail: followError.message,
      });
    }

    const recipientUserIds = dedupeFollowerIds((followRows as FollowRow[] | null) ?? [], user.id);
    console.log("[RecordQuest][edge-collection] follower count:", recipientUserIds.length);

    if (!recipientUserIds.length) {
      console.log("[RecordQuest][edge-collection] final sent:", false);
      console.log("[RecordQuest][edge-collection] safe reason:", "no_followers");
      return jsonResponse(200, {
        ok: true,
        sent: false,
        reason: "no_followers",
      });
    }

    const { data: tokenRows, error: tokenError } = await serviceClient
      .from("user_push_tokens")
      .select("user_id,expo_push_token,updated_at")
      .in("user_id", recipientUserIds)
      .order("updated_at", { ascending: false });

    if (tokenError) {
      console.error("[RecordQuest][edge-collection] recipient token lookup failed:", tokenError.message);
      return jsonResponse(500, {
        ok: false,
        sent: false,
        reason: "recipient_token_lookup_failed",
        detail: tokenError.message,
      });
    }

    const recipientTokens = dedupeLatestTokens((tokenRows as PushTokenRow[] | null) ?? []);
    console.log("[RecordQuest][edge-collection] recipient token count:", recipientTokens.length);

    if (!recipientTokens.length) {
      console.log("[RecordQuest][edge-collection] final sent:", false);
      console.log("[RecordQuest][edge-collection] safe reason:", "no_recipient_tokens");
      return jsonResponse(200, {
        ok: true,
        sent: false,
        reason: "no_recipient_tokens",
      });
    }

    const notificationBody = buildNotificationBody(
      actorName,
      typedCollectionRow.album ?? "",
      typedCollectionRow.artist ?? ""
    );

    let sentCount = 0;
    let failedCount = 0;

    const tokenBatches = chunk(recipientTokens, 100);

    for (const tokenBatch of tokenBatches) {
      try {
        const messages = tokenBatch.map((token) => ({
          to: token,
          title: "RecordQuest",
          body: notificationBody,
          sound: "default",
        }));

        const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messages),
        });

        const payload = (await expoResponse.json()) as {
          data?: ExpoPushTicket | ExpoPushTicket[];
          errors?: Array<{ message?: string }>;
        };

        const tickets = Array.isArray(payload.data)
          ? payload.data
          : payload.data
            ? [payload.data]
            : [];

        console.log("[RecordQuest][edge-collection] Expo HTTP status:", expoResponse.status);

        if (!expoResponse.ok) {
          console.log("[RecordQuest][edge-collection] Expo response status:", "http_error");
          failedCount += tokenBatch.length;
          console.warn("[RecordQuest][edge-collection] Expo push HTTP request failed");
          continue;
        }

        if (!tickets.length) {
          console.log("[RecordQuest][edge-collection] Expo response status:", "missing_tickets");
          failedCount += tokenBatch.length;
          console.warn("[RecordQuest][edge-collection] Expo push response did not include tickets");
          continue;
        }

        console.log(
          "[RecordQuest][edge-collection] Expo response status:",
          tickets.some((ticket) => ticket?.status === "ok") ? "ok_or_partial" : "not_ok"
        );

        for (let index = 0; index < tokenBatch.length; index += 1) {
          const ticket = tickets[index];
          if (ticket?.status === "ok") {
            sentCount += 1;
          } else {
            failedCount += 1;
          }
        }
      } catch (expoError) {
        failedCount += tokenBatch.length;
        console.error("[RecordQuest][edge-collection] Expo push batch send failed:", safeErrorDetail(expoError));
      }
    }

    console.log("[RecordQuest][edge-collection] final sent:", sentCount > 0);
    console.log(
      "[RecordQuest][edge-collection] safe reason:",
      sentCount > 0 ? "none" : "expo_all_failed"
    );

    return jsonResponse(200, {
      ok: true,
      sent: sentCount > 0,
      recipientCount: recipientTokens.length,
      sentCount,
      failedCount,
    });
  } catch (unexpectedError) {
    console.error("[RecordQuest][edge-collection] unexpected server error:", safeErrorDetail(unexpectedError));
    return jsonResponse(500, {
      ok: false,
      sent: false,
      reason: "unexpected_server_error",
      detail: safeErrorDetail(unexpectedError),
    });
  }
});
