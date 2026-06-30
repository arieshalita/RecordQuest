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

function toServiceError(context: string, error: PostgrestError): Error {
  return new Error(`${context}: ${error.message}`);
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
    throw toServiceError("Failed to save store check-ins", insertError);
  }
}
