import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "./supabase-client";
import type { RecordItem } from "./types";

type RecordRow = RecordItem & {
  user_id: string;
};

type RecordIdRow = {
  id: number | string;
};

type CollectionNotificationInvokeErrorDetails = {
  message: string;
  status?: number;
  contextStatus?: number;
  contextData?: unknown;
};

type WishlistRow = RecordItem & {
  user_id: string;
};

type ActivityRow = {
  user_id: string;
  entry: string;
};

type StoreCheckInRow = {
  user_id: string;
  store_id: string;
  count: number;
};

type UserPushTokenRow = {
  id: number;
  user_id: string;
  expo_push_token: string;
  device_platform: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
};

const RECORD_COLUMNS =
  "id, album, artist, year, genre, cover, purchasedAt, purchaseDate, condition, price, notes, favoriteTrack, rating";

const collectionNotificationInFlight = new Set<number>();
const collectionNotificationCompleted = new Set<number>();

function logSupabaseError(context: string, error: PostgrestError): void {
  console.warn(`[RecordQuest][supabase] ${context} code:`, error.code);
  console.warn(`[RecordQuest][supabase] ${context} message:`, error.message);
  console.warn(`[RecordQuest][supabase] ${context} details:`, error.details);
  console.warn(`[RecordQuest][supabase] ${context} hint:`, error.hint);
  console.warn(`[RecordQuest][supabase] ${context} full error:`, error);
}

function toServiceError(context: string, error: PostgrestError): Error {
  const details = [
    `code=${error.code}`,
    `message=${error.message}`,
    `details=${error.details ?? "none"}`,
    `hint=${error.hint ?? "none"}`,
  ].join("; ");

  return new Error(`${context}: ${details}`);
}

function stripUserId<T extends { user_id: string }>(rows: T[]): Omit<T, "user_id">[] {
  return rows.map(({ user_id: _userId, ...rest }) => rest);
}

function ensureUserId(userId: string): string {
  const trimmed = userId.trim();
  if (!trimmed) {
    throw new Error("A valid userId is required for Supabase queries.");
  }
  return trimmed;
}

function isValidCollectionItemId(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function toCollectionItemId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

async function readInvokeErrorContext(context: unknown): Promise<{ status?: number; data?: unknown }> {
  if (!context || typeof context !== "object") {
    return {};
  }

  const contextRecord = context as {
    status?: unknown;
    clone?: () => unknown;
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
  };

  const out: { status?: number; data?: unknown } = {};

  if (typeof contextRecord.status === "number") {
    out.status = contextRecord.status;
  }

  try {
    const readable = typeof contextRecord.clone === "function" ? contextRecord.clone() : contextRecord;
    const readableRecord = readable as {
      json?: () => Promise<unknown>;
      text?: () => Promise<string>;
    };

    if (typeof readableRecord.json === "function") {
      out.data = await readableRecord.json();
      return out;
    }

    if (typeof readableRecord.text === "function") {
      const rawText = await readableRecord.text();
      out.data = rawText.length > 300 ? `${rawText.slice(0, 300)}...` : rawText;
      return out;
    }
  } catch {
    out.data = "unreadable_error_context";
  }

  return out;
}

async function extractInvokeErrorDetails(error: unknown): Promise<CollectionNotificationInvokeErrorDetails> {
  const errorRecord = (error ?? {}) as {
    message?: unknown;
    status?: unknown;
    context?: unknown;
  };

  const details: CollectionNotificationInvokeErrorDetails = {
    message:
      typeof errorRecord.message === "string"
        ? errorRecord.message
        : "unknown_collection_invoke_error",
  };

  if (typeof errorRecord.status === "number") {
    details.status = errorRecord.status;
  }

  const contextInfo = await readInvokeErrorContext(errorRecord.context);

  if (typeof contextInfo.status === "number") {
    details.contextStatus = contextInfo.status;
  }

  if (contextInfo.data !== undefined) {
    details.contextData = contextInfo.data;
  }

  return details;
}

function scheduleCollectionNotification(collectionItemId: number): void {
  console.log("[RecordQuest][push] collection notification invoke attempted:", true);
  console.log("[RecordQuest][push] collection item id sent to function:", collectionItemId);

  if (!isValidCollectionItemId(collectionItemId)) {
    console.warn("[RecordQuest][push] collection notification invoke attempted:", false);
    return;
  }

  if (
    collectionNotificationInFlight.has(collectionItemId) ||
    collectionNotificationCompleted.has(collectionItemId)
  ) {
    console.warn("[RecordQuest][push] collection notification invoke attempted:", false);
    return;
  }

  collectionNotificationInFlight.add(collectionItemId);

  void supabase.functions
    .invoke("send-collection-notification", {
      body: {
        collectionItemId,
      },
    })
    .then(async ({ data, error }) => {
      if (error) {
        const errorDetails = await extractInvokeErrorDetails(error);
        console.warn("[RecordQuest][push] collection notification invoke failed:", errorDetails.message);
        if (typeof errorDetails.status === "number") {
          console.warn("[RecordQuest][push] collection notification invoke status:", errorDetails.status);
        }
        if (typeof errorDetails.contextStatus === "number") {
          console.warn(
            "[RecordQuest][push] collection notification invoke context status:",
            errorDetails.contextStatus
          );
        }
        if (errorDetails.contextData !== undefined) {
          console.warn(
            "[RecordQuest][push] collection notification invoke response body:",
            errorDetails.contextData
          );
        }
        return;
      }

      const sent = Boolean((data as { sent?: boolean } | null)?.sent);
      const reason = (data as { reason?: string } | null)?.reason ?? "none";

      console.log("[RecordQuest][push] collection notification sent:", sent);

      if (!sent) {
        console.warn("[RecordQuest][push] collection notification not sent:", reason);
      }
    })
    .catch((invokeError) => {
      console.warn(
        "[RecordQuest][push] collection notification invoke error:",
        invokeError instanceof Error ? invokeError.message : "unknown error"
      );
    })
    .finally(() => {
      collectionNotificationInFlight.delete(collectionItemId);
      collectionNotificationCompleted.add(collectionItemId);
    });
}

export async function ensureUserProfile(userId: string): Promise<void> {
  const scopedUserId = ensureUserId(userId);

  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: scopedUserId,
      },
      { onConflict: "user_id" }
    );

  if (error) {
    logSupabaseError("ensureUserProfile", error);
    throw toServiceError("Failed to ensure user profile", error);
  }
}

export async function loadRecords(userId: string): Promise<RecordItem[]> {
  const scopedUserId = ensureUserId(userId);

  const { data, error } = await supabase
    .from("records")
    .select(RECORD_COLUMNS)
    .eq("user_id", scopedUserId)
    .order("id", { ascending: false });

  if (error) {
    logSupabaseError("loadRecords", error);
    throw toServiceError("Failed to load records", error);
  }

  return stripUserId((data as RecordRow[] | null) ?? []) as RecordItem[];
}

export async function saveRecords(
  userId: string,
  records: RecordItem[]
): Promise<void> {
  const scopedUserId = ensureUserId(userId);

  const { data: existingRows, error: existingRowsError } = await supabase
    .from("records")
    .select("id")
    .eq("user_id", scopedUserId);

  if (existingRowsError) {
    logSupabaseError("saveRecords preselect", existingRowsError);
    throw toServiceError("Failed to load existing records", existingRowsError);
  }

  const existingIds = new Set(
    ((existingRows as RecordIdRow[] | null) ?? [])
      .map((row) => toCollectionItemId(row.id))
      .filter((id): id is number => typeof id === "number")
  );

  const newlyInsertedCollectionItemIds = records
    .map((record) => toCollectionItemId(record.id))
    .filter((id): id is number => typeof id === "number" && !existingIds.has(id));

  const { error: deleteError } = await supabase
    .from("records")
    .delete()
    .eq("user_id", scopedUserId);

  if (deleteError) {
    logSupabaseError("saveRecords delete", deleteError);
    throw toServiceError("Failed to clear records", deleteError);
  }

  if (records.length === 0) {
    return;
  }

  const rows: RecordRow[] = records.map((record) => ({
    user_id: scopedUserId,
    ...record,
  }));

  const { data: insertedRows, error: insertError } = await supabase
    .from("records")
    .insert(rows)
    .select("id");

  if (insertError) {
    console.warn("[RecordQuest][push] collection insert succeeded:", false);
    logSupabaseError("saveRecords insert", insertError);
    throw toServiceError("Failed to save records", insertError);
  }

  console.log("[RecordQuest][push] collection insert succeeded:", true);

  const insertedIds = new Set(
    ((insertedRows as RecordIdRow[] | null) ?? [])
      .map((row) => toCollectionItemId(row.id))
      .filter((id): id is number => typeof id === "number")
  );

  const insertedNewCollectionItemIds = newlyInsertedCollectionItemIds.filter((id) => insertedIds.has(id));
  console.log(
    "[RecordQuest][push] inserted/new collection item id present:",
    insertedNewCollectionItemIds.length > 0
  );

  for (const collectionItemId of insertedNewCollectionItemIds) {
    scheduleCollectionNotification(collectionItemId);
  }
}

export async function loadWishlist(userId: string): Promise<RecordItem[]> {
  const scopedUserId = ensureUserId(userId);

  const { data, error } = await supabase
    .from("wishlist")
    .select(RECORD_COLUMNS)
    .eq("user_id", scopedUserId)
    .order("id", { ascending: false });

  if (error) {
    logSupabaseError("loadWishlist", error);
    throw toServiceError("Failed to load wishlist", error);
  }

  return stripUserId((data as WishlistRow[] | null) ?? []) as RecordItem[];
}

export async function saveWishlist(
  userId: string,
  wishlist: RecordItem[]
): Promise<void> {
  const scopedUserId = ensureUserId(userId);

  const { error: deleteError } = await supabase
    .from("wishlist")
    .delete()
    .eq("user_id", scopedUserId);

  if (deleteError) {
    logSupabaseError("saveWishlist delete", deleteError);
    throw toServiceError("Failed to clear wishlist", deleteError);
  }

  if (wishlist.length === 0) {
    return;
  }

  const rows: WishlistRow[] = wishlist.map((item) => ({
    user_id: scopedUserId,
    ...item,
  }));

  const { error: insertError } = await supabase.from("wishlist").insert(rows);

  if (insertError) {
    logSupabaseError("saveWishlist insert", insertError);
    throw toServiceError("Failed to save wishlist", insertError);
  }
}

export async function loadActivity(userId: string): Promise<string[]> {
  const scopedUserId = ensureUserId(userId);

  const { data, error } = await supabase
    .from("activity")
    .select("entry")
    .eq("user_id", scopedUserId);

  if (error) {
    logSupabaseError("loadActivity", error);
    throw toServiceError("Failed to load activity", error);
  }

  const rows = (data as Pick<ActivityRow, "entry">[] | null) ?? [];
  return rows.map((row) => row.entry).filter((entry) => typeof entry === "string");
}

export async function saveActivity(
  userId: string,
  activity: string[]
): Promise<void> {
  const scopedUserId = ensureUserId(userId);

  const { error: deleteError } = await supabase
    .from("activity")
    .delete()
    .eq("user_id", scopedUserId);

  if (deleteError) {
    logSupabaseError("saveActivity delete", deleteError);
    throw toServiceError("Failed to clear activity", deleteError);
  }

  if (activity.length === 0) {
    return;
  }

  const rows: ActivityRow[] = activity.map((entry) => ({
    user_id: scopedUserId,
    entry,
  }));

  const { error: insertError } = await supabase.from("activity").insert(rows);

  if (insertError) {
    logSupabaseError("saveActivity insert", insertError);
    throw toServiceError("Failed to save activity", insertError);
  }
}

export async function loadStoreCheckins(
  userId: string
): Promise<Record<string, number>> {
  const scopedUserId = ensureUserId(userId);

  const { data, error } = await supabase
    .from("store_checkins")
    .select("store_id, count")
    .eq("user_id", scopedUserId);

  if (error) {
    logSupabaseError("loadStoreCheckins", error);
    throw toServiceError("Failed to load store check-ins", error);
  }

  const rows = (data as Pick<StoreCheckInRow, "store_id" | "count">[] | null) ?? [];

  return rows.reduce<Record<string, number>>((acc, row) => {
    if (row.store_id) {
      acc[row.store_id] = Number.isFinite(row.count) ? row.count : 0;
    }
    return acc;
  }, {});
}

export async function saveStoreCheckins(
  userId: string,
  checkins: Record<string, number>
): Promise<void> {
  const scopedUserId = ensureUserId(userId);

  const { error: deleteError } = await supabase
    .from("store_checkins")
    .delete()
    .eq("user_id", scopedUserId);

  if (deleteError) {
    logSupabaseError("saveStoreCheckins delete", deleteError);
    throw toServiceError("Failed to clear store check-ins", deleteError);
  }

  const rows: StoreCheckInRow[] = Object.entries(checkins).map(([storeId, count]) => ({
    user_id: scopedUserId,
    store_id: storeId,
    count,
  }));

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("store_checkins")
    .insert(rows);

  if (insertError) {
    logSupabaseError("saveStoreCheckins insert", insertError);
    throw toServiceError("Failed to save store check-ins", insertError);
  }
}

export async function upsertUserPushToken(
  userId: string,
  expoPushToken: string,
  devicePlatform: string
): Promise<boolean> {
  const scopedUserId = ensureUserId(userId);
  const scopedToken = expoPushToken.trim();

  if (!scopedToken) {
    return false;
  }

  const now = new Date().toISOString();

  const { data: existing, error: selectError } = await supabase
    .from("user_push_tokens")
    .select("id")
    .eq("user_id", scopedUserId)
    .eq("expo_push_token", scopedToken)
    .limit(1)
    .maybeSingle();

  if (selectError) {
    logSupabaseError("upsertUserPushToken select", selectError);
    throw toServiceError("Failed to query push token", selectError);
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("user_push_tokens")
      .update({
        device_platform: devicePlatform,
        last_seen_at: now,
        updated_at: now,
      })
      .eq("id", existing.id);

    if (updateError) {
      logSupabaseError("upsertUserPushToken update", updateError);
      throw toServiceError("Failed to update push token", updateError);
    }

    return true;
  }

  const { error: insertError } = await supabase
    .from("user_push_tokens")
    .insert({
      user_id: scopedUserId,
      expo_push_token: scopedToken,
      device_platform: devicePlatform,
      last_seen_at: now,
      updated_at: now,
    });

  if (insertError) {
    logSupabaseError("upsertUserPushToken insert", insertError);
    throw toServiceError("Failed to insert push token", insertError);
  }

  return true;
}

export async function getLatestUserPushToken(userId: string): Promise<string | null> {
  const scopedUserId = ensureUserId(userId);

  const { data, error } = await supabase
    .from("user_push_tokens")
    .select("expo_push_token, updated_at")
    .eq("user_id", scopedUserId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logSupabaseError("getLatestUserPushToken", error);
    throw toServiceError("Failed to load latest user push token", error);
  }

  const token = data?.expo_push_token?.trim();
  return token ? token : null;
}
