import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type DeleteAccountResponse = {
  ok: boolean;
  deleted: boolean;
  reason?: string;
  detail?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(status: number, payload: DeleteAccountResponse): Response {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("[RecordQuest][edge-delete-account] missing required Supabase env vars");
      return jsonResponse(500, {
        ok: false,
        deleted: false,
        reason: "missing_supabase_env",
      });
    }

    if (!authHeader || !bearerToken) {
      return jsonResponse(401, {
        ok: false,
        deleted: false,
        reason: "unauthorized",
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
    } = await userClient.auth.getUser(bearerToken);

    if (authError || !user?.id) {
      return jsonResponse(401, {
        ok: false,
        deleted: false,
        reason: "unauthorized",
      });
    }

    const { data: cleanupResult, error: cleanupError } = await serviceClient.rpc(
      "delete_recordquest_account_data",
      {
        target_user_id: user.id,
      }
    );

    if (cleanupError) {
      console.error("[RecordQuest][edge-delete-account] cleanup failed:", cleanupError.message);
      return jsonResponse(500, {
        ok: false,
        deleted: false,
        reason: "cleanup_failed",
      });
    }

    console.log("[RecordQuest][edge-delete-account] cleanup result:", cleanupResult ?? null);

    const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      console.error("[RecordQuest][edge-delete-account] auth delete failed:", deleteUserError.message);
      return jsonResponse(500, {
        ok: false,
        deleted: false,
        reason: "auth_delete_failed",
      });
    }

    return jsonResponse(200, {
      ok: true,
      deleted: true,
    });
  } catch (error) {
    console.error("[RecordQuest][edge-delete-account] unexpected error:", safeErrorDetail(error));
    return jsonResponse(500, {
      ok: false,
      deleted: false,
      reason: "unexpected_server_error",
    });
  }
});