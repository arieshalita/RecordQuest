import { supabase } from "./supabase-client";
import { resolveAlbumArtUrl } from "../utils/album-art";

export type PublicRecordPreview = {
  id: number;
  album: string;
  artist: string;
  cover: string;
  year?: string;
  addedAt?: string;
};

export type PublicCollectionPreviewResult = {
  records: PublicRecordPreview[];
  blockedByPolicy: boolean;
  error?: string;
};

export type PublicCollectionCountResult = {
  count: number;
  blockedByPolicy: boolean;
  error?: string;
};

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function loadPublicCollectionPreview(
  profileUserId: string,
  limit = 8
): Promise<PublicCollectionPreviewResult> {
  const trimmedUserId = profileUserId.trim();
  if (!trimmedUserId) {
    return { records: [], blockedByPolicy: false };
  }

  const { data, error } = await supabase
    .from("records")
    .select("id,user_id,album,artist,cover,year,added_at")
    .eq("user_id", trimmedUserId)
    .order("added_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    const blockedByPolicy = error.code === "42501" || /permission denied|policy/i.test(error.message);

    return {
      records: [],
      blockedByPolicy,
      error: blockedByPolicy
        ? "Public collection preview is currently unavailable."
        : "We couldn't load this collection preview right now.",
    };
  }

  const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;

  const records: PublicRecordPreview[] = [];

  for (const row of rows) {
    const id = readNumber(row.id);
    if (id === null) {
      continue;
    }

    records.push({
      id,
      album: readString(row.album, "Untitled Album"),
      artist: readString(row.artist, "Unknown Artist"),
      cover: resolveAlbumArtUrl(readString(row.cover), "thumb"),
      year: readString(row.year) || undefined,
      addedAt: readString(row.added_at) || undefined,
    });
  }

  return {
    records,
    blockedByPolicy: false,
  };
}

export async function loadPublicCollectionCount(
  profileUserId: string
): Promise<PublicCollectionCountResult> {
  const trimmedUserId = profileUserId.trim();
  if (!trimmedUserId) {
    return { count: 0, blockedByPolicy: false };
  }

  const { count, error } = await supabase
    .from("records")
    .select("id", { count: "exact", head: true })
    .eq("user_id", trimmedUserId);

  if (error) {
    const blockedByPolicy = error.code === "42501" || /permission denied|policy/i.test(error.message);

    return {
      count: 0,
      blockedByPolicy,
      error: blockedByPolicy
        ? "Public collection is currently unavailable."
        : "We couldn't load this collection count right now.",
    };
  }

  return {
    count: count ?? 0,
    blockedByPolicy: false,
  };
}
