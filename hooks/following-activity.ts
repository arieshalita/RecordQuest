import { getCurrentSession, supabase } from "./supabase-client";

export type FollowingActivityItem = {
  id: string;
  actorUserId: string;
  actorDisplayName: string;
  actorUsername: string;
  entry: string;
  album?: string;
  artist?: string;
  cover?: string;
  createdAt: string;
};

export type FollowingActivityResult = {
  items: FollowingActivityItem[];
  blockedByPolicy: boolean;
  error?: string;
};

type ActivityRow = {
  id: string;
  user_id: string;
  entry: string;
  created_at: string;
};

type FollowRow = {
  following_id: string;
};

type ProfileRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
};

type RecordSourceRow = {
  user_id: string;
  album: string;
  artist: string;
  cover: string;
  created_at: string;
};

type AlbumMetadata = {
  artist?: string;
  cover?: string;
};

const DEFAULT_COVER = "https://upload.wikimedia.org/wikipedia/commons/3/3c/No-album-art.png";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function parseAlbumFromEntry(entry: string): string | undefined {
  const patterns = [
    /^Added\s+(.+?)\s+to\s+collection$/i,
    /^Added\s+(.+?)\s+to\s+wishlist$/i,
    /^Found\s+(.+)$/i,
    /^Updated\s+(.+)$/i,
    /^Removed\s+(.+?)\s+from\s+collection$/i,
    /^Removed\s+(.+?)\s+from\s+wishlist$/i,
    /^Deleted\s+(.+?)\s+from\s+collection$/i,
    /^Deleted\s+(.+?)\s+from\s+wishlist$/i,
  ];

  for (const pattern of patterns) {
    const match = entry.match(pattern);
    const album = match?.[1]?.trim();
    if (album) {
      return album;
    }
  }

  return undefined;
}

function metadataKey(userId: string, album: string): string {
  return `${userId}::${normalize(album)}`;
}

function maybePolicyBlocked(code: string | undefined, message: string): boolean {
  return code === "42501" || /permission denied|policy/i.test(message);
}

function pickProfileName(profile: ProfileRow | undefined): { displayName: string; username: string } {
  const username = (profile?.username ?? "").trim();
  const displayName = (profile?.display_name ?? "").trim() || username || "RecordQuest User";

  return { displayName, username };
}

function fillMetadataMap(
  rows: RecordSourceRow[],
  targetMap: Map<string, AlbumMetadata>
): void {
  for (const row of rows) {
    const album = row.album?.trim();
    if (!album) continue;

    const key = metadataKey(row.user_id, album);
    if (targetMap.has(key)) continue;

    targetMap.set(key, {
      artist: row.artist?.trim() || undefined,
      cover: row.cover?.trim() || undefined,
    });
  }
}

export async function loadFollowingActivity(limit = 25): Promise<FollowingActivityResult> {
  const session = await getCurrentSession();
  const currentUserId = session?.user?.id ?? null;

  if (!currentUserId) {
    return {
      items: [],
      blockedByPolicy: false,
      error: "You must be signed in to see following activity.",
    };
  }

  const { data: followsData, error: followsError } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", currentUserId)
    .limit(500);

  if (followsError) {
    const blockedByPolicy = maybePolicyBlocked(followsError.code, followsError.message);
    return {
      items: [],
      blockedByPolicy,
      error: blockedByPolicy
        ? "Following activity is currently unavailable due to RLS policy."
        : followsError.message,
    };
  }

  const followingIds = ((followsData as FollowRow[] | null) ?? [])
    .map((row) => row.following_id?.trim())
    .filter((id): id is string => !!id);

  if (followingIds.length === 0) {
    return {
      items: [],
      blockedByPolicy: false,
    };
  }

  const { data: activityData, error: activityError } = await supabase
    .from("activity")
    .select("id,user_id,entry,created_at")
    .in("user_id", followingIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (activityError) {
    const blockedByPolicy = maybePolicyBlocked(activityError.code, activityError.message);
    return {
      items: [],
      blockedByPolicy,
      error: blockedByPolicy
        ? "Following activity is currently unavailable due to RLS policy."
        : activityError.message,
    };
  }

  const activityRows = ((activityData as ActivityRow[] | null) ?? []).filter(
    (row) => !!row.id && !!row.user_id && !!row.entry
  );

  if (activityRows.length === 0) {
    return {
      items: [],
      blockedByPolicy: false,
    };
  }

  const [profilesResult, recordsResult, wishlistResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id,username,display_name")
      .in("user_id", followingIds),
    supabase
      .from("records")
      .select("user_id,album,artist,cover,created_at")
      .in("user_id", followingIds)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("wishlist")
      .select("user_id,album,artist,cover,created_at")
      .in("user_id", followingIds)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const profileMap = new Map<string, ProfileRow>();
  for (const row of ((profilesResult.data as ProfileRow[] | null) ?? [])) {
    const userId = row.user_id?.trim();
    if (!userId || profileMap.has(userId)) continue;
    profileMap.set(userId, row);
  }

  const metadataMap = new Map<string, AlbumMetadata>();
  fillMetadataMap(((recordsResult.data as RecordSourceRow[] | null) ?? []), metadataMap);
  fillMetadataMap(((wishlistResult.data as RecordSourceRow[] | null) ?? []), metadataMap);

  const items = activityRows.map((row) => {
    const profile = profileMap.get(row.user_id);
    const parsedAlbum = parseAlbumFromEntry(row.entry);
    const lookup = parsedAlbum ? metadataMap.get(metadataKey(row.user_id, parsedAlbum)) : undefined;

    const identity = pickProfileName(profile);

    return {
      id: row.id,
      actorUserId: row.user_id,
      actorDisplayName: identity.displayName,
      actorUsername: identity.username,
      entry: row.entry,
      album: parsedAlbum,
      artist: lookup?.artist,
      cover: lookup?.cover || (parsedAlbum ? DEFAULT_COVER : undefined),
      createdAt: row.created_at,
    } satisfies FollowingActivityItem;
  });

  return {
    items,
    blockedByPolicy: false,
  };
}
