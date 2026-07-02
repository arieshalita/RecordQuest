import { supabase } from "./supabase-client";

export type DiscoverUser = {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
};

type ProfileRow = Record<string, unknown>;

const PROFILES_SELECT = "id,user_id,username,display_name,avatar_url" as const;

function readString(record: ProfileRow, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function rowToDiscoverUser(record: ProfileRow): DiscoverUser | null {
  const userId = readString(record, "user_id");
  if (!userId) {
    return null;
  }

  const username = readString(record, "username");
  const displayName =
    readString(record, "display_name") ||
    readString(record, "full_name") ||
    readString(record, "name") ||
    username ||
    "RecordQuest User";

  const avatarUrl =
    readString(record, "avatar_url") ||
    readString(record, "avatar") ||
    readString(record, "profile_image_url") ||
    undefined;

  return {
    userId,
    username,
    displayName,
    avatarUrl,
  };
}

function dedupeUsers(users: DiscoverUser[]): DiscoverUser[] {
  const seen = new Set<string>();
  const deduped: DiscoverUser[] = [];

  for (const user of users) {
    if (seen.has(user.userId)) continue;
    seen.add(user.userId);
    deduped.push(user);
  }

  return deduped;
}

export async function getDiscoverUsers(currentUserId: string): Promise<DiscoverUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILES_SELECT)
    .limit(200);

  if (error) {
    throw new Error(error.message || "Unable to load users.");
  }

  const rows = (Array.isArray(data) ? (data as unknown[]) : []).filter(
    (row): row is ProfileRow => typeof row === "object" && row !== null
  );

  const source = dedupeUsers(
    rows
      .map((row) => rowToDiscoverUser(row))
      .filter((user): user is DiscoverUser => !!user)
  );

  const filtered = source.filter((user) => user.userId !== currentUserId);

  return filtered.sort((a, b) => a.displayName.localeCompare(b.displayName));
}
