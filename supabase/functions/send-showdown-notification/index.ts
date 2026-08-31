import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ShowdownAction = "submissions" | "voting" | "results";

type CompetitionRow = {
  id: string;
  title: string | null;
  is_cancelled: boolean | null;
  submission_starts_at: string | null;
  voting_starts_at: string | null;
  results_at: string | null;
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

type ShowdownNotificationResponse = {
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(status: number, payload: ShowdownNotificationResponse): Response {
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

function parseAction(value: unknown): ShowdownAction | null {
  if (value === "submissions" || value === "voting" || value === "results") {
    return value;
  }

  return null;
}

function parseCompetitionId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!UUID_REGEX.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function readRequestBody(body: unknown): { competitionId: string | null; action: ShowdownAction | null } {
  if (!body || typeof body !== "object") {
    return {
      competitionId: null,
      action: null,
    };
  }

  const bodyRecord = body as {
    competitionId?: unknown;
    action?: unknown;
  };

  return {
    competitionId: parseCompetitionId(bodyRecord.competitionId),
    action: parseAction(bodyRecord.action),
  };
}

function toEpochMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function isTimingAllowed(action: ShowdownAction, competition: CompetitionRow): boolean {
  const nowMs = Date.now();

  if (action === "submissions") {
    const startsAtMs = toEpochMs(competition.submission_starts_at);
    return startsAtMs !== null && nowMs >= startsAtMs;
  }

  if (action === "voting") {
    const startsAtMs = toEpochMs(competition.voting_starts_at);
    return startsAtMs !== null && nowMs >= startsAtMs;
  }

  const startsAtMs = toEpochMs(competition.results_at);
  return startsAtMs !== null && nowMs >= startsAtMs;
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

function chunk<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function buildNotificationCopy(action: ShowdownAction, competitionTitle: string): { title: string; body: string } {
  const safeTitle = competitionTitle.trim() || "This Showdown";

  if (action === "submissions") {
    return {
      title: "🏆 New Showdown",
      body: `${safeTitle} is open. Enter a record from your collection.`,
    };
  }

  if (action === "voting") {
    return {
      title: "🗳 Voting is open",
      body: "Help choose this week's Showdown winner.",
    };
  }

  return {
    title: "🏆 Results are in",
    body: `See which record won ${safeTitle}.`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[RecordQuest][edge-showdown] missing required Supabase env vars");
      return jsonResponse(500, {
        ok: false,
        sent: false,
        reason: "missing_supabase_env",
        detail: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing",
      });
    }

    if (!authHeader) {
      return jsonResponse(401, {
        ok: false,
        sent: false,
        reason: "missing_authorization",
      });
    }

    const expectedAuthHeader = `Bearer ${serviceRoleKey}`;
    if (authHeader !== expectedAuthHeader) {
      return jsonResponse(401, {
        ok: false,
        sent: false,
        reason: "unauthorized_caller",
      });
    }

    let parsedBody: { competitionId: string | null; action: ShowdownAction | null } = {
      competitionId: null,
      action: null,
    };

    try {
      const body = (await req.json()) as unknown;
      parsedBody = readRequestBody(body);
    } catch {
      parsedBody = {
        competitionId: null,
        action: null,
      };
    }

    if (!parsedBody.competitionId) {
      return jsonResponse(200, {
        ok: true,
        sent: false,
        reason: "invalid_competition_id",
      });
    }

    if (!parsedBody.action) {
      return jsonResponse(200, {
        ok: true,
        sent: false,
        reason: "invalid_action",
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: competitionRow, error: competitionError } = await serviceClient
      .from("competitions")
      .select("id,title,is_cancelled,submission_starts_at,voting_starts_at,results_at")
      .eq("id", parsedBody.competitionId)
      .limit(1)
      .maybeSingle();

    if (competitionError) {
      console.error("[RecordQuest][edge-showdown] competition lookup failed:", competitionError.message);
      return jsonResponse(500, {
        ok: false,
        sent: false,
        reason: "competition_lookup_failed",
        detail: competitionError.message,
      });
    }

    if (!competitionRow) {
      return jsonResponse(200, {
        ok: true,
        sent: false,
        reason: "competition_not_found",
      });
    }

    const competition = competitionRow as CompetitionRow;

    if (competition.is_cancelled) {
      return jsonResponse(200, {
        ok: true,
        sent: false,
        reason: "competition_cancelled",
      });
    }

    if (!isTimingAllowed(parsedBody.action, competition)) {
      return jsonResponse(200, {
        ok: true,
        sent: false,
        reason: "phase_not_open",
      });
    }

    const { data: tokenRows, error: tokenError } = await serviceClient
      .from("user_push_tokens")
      .select("user_id,expo_push_token,updated_at")
      .order("updated_at", { ascending: false });

    if (tokenError) {
      console.error("[RecordQuest][edge-showdown] token lookup failed:", tokenError.message);
      return jsonResponse(500, {
        ok: false,
        sent: false,
        reason: "token_lookup_failed",
        detail: tokenError.message,
      });
    }

    const recipientTokens = dedupeLatestTokens((tokenRows as PushTokenRow[] | null) ?? []);

    if (!recipientTokens.length) {
      return jsonResponse(200, {
        ok: true,
        sent: false,
        reason: "no_recipient_tokens",
      });
    }

    const copy = buildNotificationCopy(parsedBody.action, competition.title ?? "");

    let sentCount = 0;
    let failedCount = 0;

    const tokenBatches = chunk(recipientTokens, 100);

    for (const tokenBatch of tokenBatches) {
      try {
        const messages = tokenBatch.map((token) => ({
          to: token,
          title: copy.title,
          body: copy.body,
          sound: "default",
          data: {
            type: "showdown",
            action: parsedBody.action,
            competitionId: competition.id,
          },
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

        if (!expoResponse.ok) {
          failedCount += tokenBatch.length;
          console.warn("[RecordQuest][edge-showdown] Expo push HTTP request failed");
          continue;
        }

        if (!tickets.length) {
          failedCount += tokenBatch.length;
          console.warn("[RecordQuest][edge-showdown] Expo push response did not include tickets");
          continue;
        }

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
        console.error("[RecordQuest][edge-showdown] Expo push batch send failed:", safeErrorDetail(expoError));
      }
    }

    return jsonResponse(200, {
      ok: true,
      sent: sentCount > 0,
      recipientCount: recipientTokens.length,
      sentCount,
      failedCount,
    });
  } catch (unexpectedError) {
    console.error("[RecordQuest][edge-showdown] unexpected server error:", safeErrorDetail(unexpectedError));
    return jsonResponse(500, {
      ok: false,
      sent: false,
      reason: "unexpected_server_error",
      detail: safeErrorDetail(unexpectedError),
    });
  }
});
