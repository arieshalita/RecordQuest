import { supabase } from "./supabase-client";

export type PublicRecordPreview = {
  id: number;
  album: string;
  artist: string;
  cover: string;
};

export type PublicCollectionPreviewResult = {
  records: PublicRecordPreview[];
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
    .select("id,user_id,album,artist,cover")
    .eq("user_id", trimmedUserId)
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    const blockedByPolicy = error.code === "42501" || /permission denied|policy/i.test(error.message);

    return {
      records: [],
      blockedByPolicy,
      error: blockedByPolicy
        ? "Public collection preview is currently unavailable due to RLS policy."
        : error.message,
    };
  }

  const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;

  const records = rows
    .map((row) => {
      const id = readNumber(row.id);
      if (id === null) return null;

      return {
        id,
        album: readString(row.album, "Untitled Album"),
        artist: readString(row.artist, "Unknown Artist"),
        cover: readString(row.cover, "https://upload.wikimedia.org/wikipedia/commons/3/3c/No-album-art.png"),
      } satisfies PublicRecordPreview;
    })
    .filter((record): record is PublicRecordPreview => !!record);

  return {
    records,
    blockedByPolicy: false,
  };
}
