import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "./supabase-client";
import type { RecordItem } from "./types";

type RecordRow = RecordItem & {
  user_id: string;
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

  const { error: insertError } = await supabase.from("records").insert(rows);

  if (insertError) {
    logSupabaseError("saveRecords insert", insertError);
    throw toServiceError("Failed to save records", insertError);
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
