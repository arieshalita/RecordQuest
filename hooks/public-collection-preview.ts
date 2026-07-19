import { supabase } from "./supabase-client";
import { isValidAlbumArtUrl, normalizeAlbumArtUrlOrNull } from "../utils/album-art";

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
  errorCode?: string;
  errorMessage?: string;
  isTransientFailure?: boolean;
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

function isTransientSupabaseError(code: string | undefined, message: string): boolean {
  const normalized = message.toLowerCase();

  if (code === "42501" || /permission denied|policy/i.test(normalized)) {
    return false;
  }

  if (code && /^5\d\d$/.test(code)) {
    return true;
  }

  return /network|timeout|timed out|failed to fetch|temporar|unavailable|connection/i.test(normalized);
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
    const transientFailure = isTransientSupabaseError(error.code, error.message);

    return {
      records: [],
      blockedByPolicy,
      error: blockedByPolicy
        ? "Public collection preview is currently unavailable."
        : "We couldn't load this collection preview right now.",
      errorCode: error.code,
      errorMessage: error.message,
      isTransientFailure: transientFailure,
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
      cover: normalizeAlbumArtUrlOrNull(readString(row.cover)) ?? "",
      year: readString(row.year) || undefined,
      addedAt: readString(row.added_at) || undefined,
    });

    if (__DEV__) {
      console.log("[RecordQuest][public-collection] mapped artwork", {
        recordId: id,
        hasRawCoverField: Object.prototype.hasOwnProperty.call(row, "cover"),
        hasRawCoverValue: Boolean(readString(row.cover)),
        mappedCoverValid: isValidAlbumArtUrl(records[records.length - 1].cover),
      });
    }
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
