export type ShowdownNotificationAction = "submissions" | "voting" | "results";

export type ShowdownNotificationIntent = {
  type: "showdown";
  action: ShowdownNotificationAction;
  competitionId: string;
  receivedAtMs: number;
};

type ShowdownIntentListener = (intent: ShowdownNotificationIntent) => void;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_ACTIONS: ShowdownNotificationAction[] = ["submissions", "voting", "results"];

let pendingIntent: ShowdownNotificationIntent | null = null;
const listeners = new Set<ShowdownIntentListener>();

function isValidCompetitionId(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

function isValidAction(value: unknown): value is ShowdownNotificationAction {
  return typeof value === "string" && ALLOWED_ACTIONS.includes(value as ShowdownNotificationAction);
}

export function parseShowdownNotificationIntent(rawData: unknown): ShowdownNotificationIntent | null {
  if (!rawData || typeof rawData !== "object") {
    return null;
  }

  const data = rawData as {
    type?: unknown;
    action?: unknown;
    competitionId?: unknown;
  };

  if (data.type !== "showdown") {
    return null;
  }

  if (!isValidAction(data.action) || !isValidCompetitionId(data.competitionId)) {
    return null;
  }

  return {
    type: "showdown",
    action: data.action,
    competitionId: data.competitionId.trim(),
    receivedAtMs: Date.now(),
  };
}

export function setPendingShowdownNotificationIntent(intent: ShowdownNotificationIntent): void {
  pendingIntent = intent;
  for (const listener of listeners) {
    listener(intent);
  }
}

export function consumePendingShowdownNotificationIntent(): ShowdownNotificationIntent | null {
  const value = pendingIntent;
  pendingIntent = null;
  return value;
}

export function subscribeToShowdownNotificationIntent(listener: ShowdownIntentListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
