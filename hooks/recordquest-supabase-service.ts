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
  console.log("[RecordQuest][supabase] ensureUserProfile called for user:", scopedUserId);

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

  console.log("[RecordQuest][supabase] ensureUserProfile success");
}

export async function loadRecords(userId: string): Promise<RecordItem[]> {
  const scopedUserId = ensureUserId(userId);
  console.log("[RecordQuest][supabase] loadRecords called for user:", scopedUserId);

  const { data, error } = await supabase
    .from("records")
    .select(RECORD_COLUMNS)
    .eq("user_id", scopedUserId)
    .order("id", { ascending: false });

  if (error) {
    logSupabaseError("loadRecords", error);
    throw toServiceError("Failed to load records", error);
  }

  console.log("[RecordQuest][supabase] loadRecords success count:", data?.length ?? 0);

  return stripUserId((data as RecordRow[] | null) ?? []) as RecordItem[];
}

export async function saveRecords(
  userId: string,
  records: RecordItem[]
): Promise<void> {
  const scopedUserId = ensureUserId(userId);
  console.log(
    "[RecordQuest][supabase] saveRecords called for user:",
    scopedUserId,
    "count:",
    records.length
  );

  const { error: deleteError } = await supabase
    .from("records")
    .delete()
    .eq("user_id", scopedUserId);

  if (deleteError) {
    logSupabaseError("saveRecords delete", deleteError);
    throw toServiceError("Failed to clear records", deleteError);
  }

  console.log("[RecordQuest][supabase] saveRecords delete success");

  if (records.length === 0) {
    console.log("[RecordQuest][supabase] saveRecords nothing to insert after delete");
    return;
  }

  const rows: RecordRow[] = records.map((record) => ({
    user_id: scopedUserId,
    ...record,
  }));

  console.log("[RecordQuest][supabase] saveRecords insert payload:", JSON.stringify(rows, null, 2));

  const { error: insertError } = await supabase.from("records").insert(rows);

  if (insertError) {
    logSupabaseError("saveRecords insert", insertError);
    console.warn("[RecordQuest][supabase] saveRecords payload keys:", Object.keys(rows[0] ?? {}));
    console.warn("[RecordQuest][supabase] saveRecords payload sample:", rows[0] ?? null);
    throw toServiceError("Failed to save records", insertError);
  }

  console.log("[RecordQuest][supabase] saveRecords insert success count:", rows.length);
}

export async function loadWishlist(userId: string): Promise<RecordItem[]> {
  const scopedUserId = ensureUserId(userId);
  console.log("[RecordQuest][supabase] loadWishlist called for user:", scopedUserId);

  const { data, error } = await supabase
    .from("wishlist")
    .select(RECORD_COLUMNS)
    .eq("user_id", scopedUserId)
    .order("id", { ascending: false });

  if (error) {
    logSupabaseError("loadWishlist", error);
    throw toServiceError("Failed to load wishlist", error);
  }

  console.log("[RecordQuest][supabase] loadWishlist success count:", data?.length ?? 0);

  return stripUserId((data as WishlistRow[] | null) ?? []) as RecordItem[];
}

export async function saveWishlist(
  userId: string,
  wishlist: RecordItem[]
): Promise<void> {
  const scopedUserId = ensureUserId(userId);
  console.log(
    "[RecordQuest][supabase] saveWishlist called for user:",
    scopedUserId,
    "count:",
    wishlist.length
  );

  const { error: deleteError } = await supabase
    .from("wishlist")
    .delete()
    .eq("user_id", scopedUserId);

  if (deleteError) {
    logSupabaseError("saveWishlist delete", deleteError);
    throw toServiceError("Failed to clear wishlist", deleteError);
  }

  console.log("[RecordQuest][supabase] saveWishlist delete success");

  if (wishlist.length === 0) {
    console.log("[RecordQuest][supabase] saveWishlist nothing to insert after delete");
    return;
  }

  const rows: WishlistRow[] = wishlist.map((item) => ({
    user_id: scopedUserId,
    ...item,
  }));

  console.log("[RecordQuest][supabase] saveWishlist insert payload:", JSON.stringify(rows, null, 2));

  const { error: insertError } = await supabase.from("wishlist").insert(rows);

  if (insertError) {
    logSupabaseError("saveWishlist insert", insertError);
    throw toServiceError("Failed to save wishlist", insertError);
  }

  console.log("[RecordQuest][supabase] saveWishlist insert success count:", rows.length);
}

export async function loadActivity(userId: string): Promise<string[]> {
  const scopedUserId = ensureUserId(userId);
  console.log("[RecordQuest][supabase] loadActivity called for user:", scopedUserId);

  const { data, error } = await supabase
    .from("activity")
    .select("entry")
    .eq("user_id", scopedUserId);

  if (error) {
    logSupabaseError("loadActivity", error);
    throw toServiceError("Failed to load activity", error);
  }

  console.log("[RecordQuest][supabase] loadActivity success count:", data?.length ?? 0);

  const rows = (data as Pick<ActivityRow, "entry">[] | null) ?? [];
  return rows.map((row) => row.entry).filter((entry) => typeof entry === "string");
}

export async function saveActivity(
  userId: string,
  activity: string[]
): Promise<void> {
  const scopedUserId = ensureUserId(userId);
  console.log(
    "[RecordQuest][supabase] saveActivity called for user:",
    scopedUserId,
    "count:",
    activity.length
  );

  const { error: deleteError } = await supabase
    .from("activity")
    .delete()
    .eq("user_id", scopedUserId);

  if (deleteError) {
    logSupabaseError("saveActivity delete", deleteError);
    throw toServiceError("Failed to clear activity", deleteError);
  }

  console.log("[RecordQuest][supabase] saveActivity delete success");

  if (activity.length === 0) {
    console.log("[RecordQuest][supabase] saveActivity nothing to insert after delete");
    return;
  }

  const rows: ActivityRow[] = activity.map((entry) => ({
    user_id: scopedUserId,
    entry,
  }));

  console.log("[RecordQuest][supabase] saveActivity insert payload:", JSON.stringify(rows, null, 2));

  const { error: insertError } = await supabase.from("activity").insert(rows);

  if (insertError) {
    logSupabaseError("saveActivity insert", insertError);
    throw toServiceError("Failed to save activity", insertError);
  }

  console.log("[RecordQuest][supabase] saveActivity insert success count:", rows.length);
}

export async function loadStoreCheckins(
  userId: string
): Promise<Record<string, number>> {
  const scopedUserId = ensureUserId(userId);
  console.log("[RecordQuest][supabase] loadStoreCheckins called for user:", scopedUserId);

  const { data, error } = await supabase
    .from("store_checkins")
    .select("store_id, count")
    .eq("user_id", scopedUserId);

  if (error) {
    logSupabaseError("loadStoreCheckins", error);
    throw toServiceError("Failed to load store check-ins", error);
  }

  console.log("[RecordQuest][supabase] loadStoreCheckins success count:", data?.length ?? 0);

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
  console.log(
    "[RecordQuest][supabase] saveStoreCheckins called for user:",
    scopedUserId,
    "count:",
    Object.keys(checkins).length
  );

  const { error: deleteError } = await supabase
    .from("store_checkins")
    .delete()
    .eq("user_id", scopedUserId);

  if (deleteError) {
    logSupabaseError("saveStoreCheckins delete", deleteError);
    throw toServiceError("Failed to clear store check-ins", deleteError);
  }

  console.log("[RecordQuest][supabase] saveStoreCheckins delete success");

  const rows: StoreCheckInRow[] = Object.entries(checkins).map(([storeId, count]) => ({
    user_id: scopedUserId,
    store_id: storeId,
    count,
  }));

  console.log("[RecordQuest][supabase] saveStoreCheckins insert payload:", JSON.stringify(rows, null, 2));

  if (rows.length === 0) {
    console.log("[RecordQuest][supabase] saveStoreCheckins nothing to insert after delete");
    return;
  }

  const { error: insertError } = await supabase
    .from("store_checkins")
    .insert(rows);

  if (insertError) {
    logSupabaseError("saveStoreCheckins insert", insertError);
    throw toServiceError("Failed to save store check-ins", insertError);
  }

  console.log("[RecordQuest][supabase] saveStoreCheckins insert success count:", rows.length);
}
