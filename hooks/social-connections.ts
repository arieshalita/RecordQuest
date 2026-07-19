import { supabase } from "./supabase-client";

export type SocialConnectionsMode = "followers" | "following";

export type SocialConnectionUser = {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  isFollowingByCurrentUser: boolean;
};

export type SocialConnectionsResult = {
  users: SocialConnectionUser[];
  blockedByPolicy: boolean;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
  errorStage?: "relation" | "profiles";
  isTransientFailure?: boolean;
  isInvalidTarget?: boolean;
};

type FollowRow = {
  follower_id?: string | null;
  following_id?: string | null;
};

type ProfileRow = {
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapLoadError(mode: SocialConnectionsMode): string {
  return mode === "followers"
    ? "Could not load followers right now."
    : "Could not load following right now.";
}

function mapRlsError(mode: SocialConnectionsMode): string {
  return mode === "followers"
    ? "Followers are currently unavailable."
    : "Following is currently unavailable.";
}

function maybePolicyBlocked(code: string | undefined, message: string): boolean {
  return code === "42501" || /permission denied|policy/i.test(message);
}

function isTransientFailure(code: string | undefined, message: string): boolean {
  const normalized = message.toLowerCase();

  if (maybePolicyBlocked(code, message)) {
    return false;
  }

  if (!code) {
    return /network|offline|timeout|timed out|failed to fetch|connection|temporar|gateway|unavailable|socket/i.test(normalized);
  }

  if (/^5\d\d$/.test(code)) {
    return true;
  }

  return false;
}

export async function loadSocialConnections(
  viewedUserId: string,
  mode: SocialConnectionsMode,
  currentUserId: string | null,
  limit = 150
): Promise<SocialConnectionsResult> {
  const trimmedViewedUserId = viewedUserId.trim();

  if (!trimmedViewedUserId) {
    return {
      users: [],
      blockedByPolicy: false,
      isInvalidTarget: true,
    };
  }

  const relationColumn = mode === "followers" ? "following_id" : "follower_id";
  const memberColumn = mode === "followers" ? "follower_id" : "following_id";

  const { data: relationData, error: relationError } = await supabase
    .from("user_follows")
    .select("follower_id,following_id")
    .eq(relationColumn, trimmedViewedUserId)
    .limit(limit);

  if (relationError) {
    const blockedByPolicy = maybePolicyBlocked(relationError.code, relationError.message);

    if (__DEV__) {
      console.warn("[RecordQuest][social] relation query failed", {
        mode,
        viewedUserId: trimmedViewedUserId,
        relationColumn,
        memberColumn,
        code: relationError.code,
        message: relationError.message,
        details: relationError.details,
        hint: relationError.hint,
      });
    }

    return {
      users: [],
      blockedByPolicy,
      error: blockedByPolicy ? mapRlsError(mode) : mapLoadError(mode),
      errorCode: relationError.code,
      errorMessage: relationError.message,
      errorStage: "relation",
      isTransientFailure: isTransientFailure(relationError.code, relationError.message),
    };
  }

  const memberIds = (((relationData as FollowRow[] | null) ?? [])
    .map((row) => readTrimmedString(row[memberColumn as keyof FollowRow]))
    .filter((value) => value.length > 0));

  const uniqueMemberIds = Array.from(new Set(memberIds));

  if (uniqueMemberIds.length === 0) {
    return {
      users: [],
      blockedByPolicy: false,
    };
  }

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id,username,display_name,avatar_url")
    .in("user_id", uniqueMemberIds)
    .limit(uniqueMemberIds.length);

  if (profilesError) {
    const blockedByPolicy = maybePolicyBlocked(profilesError.code, profilesError.message);

    if (__DEV__) {
      console.warn("[RecordQuest][social] profile enrichment query failed", {
        mode,
        viewedUserId: trimmedViewedUserId,
        code: profilesError.code,
        message: profilesError.message,
        details: profilesError.details,
        hint: profilesError.hint,
      });
    }

    return {
      users: [],
      blockedByPolicy,
      error: blockedByPolicy ? mapRlsError(mode) : mapLoadError(mode),
      errorCode: profilesError.code,
      errorMessage: profilesError.message,
      errorStage: "profiles",
      isTransientFailure: isTransientFailure(profilesError.code, profilesError.message),
    };
  }

  const profileMap = new Map<string, ProfileRow>();

  for (const profile of ((profilesData as ProfileRow[] | null) ?? [])) {
    const userId = readTrimmedString(profile.user_id);
    if (!userId) {
      continue;
    }

    if (!profileMap.has(userId)) {
      profileMap.set(userId, profile);
    }
  }

  const followingByCurrentUser = new Set<string>();

  if (currentUserId && uniqueMemberIds.length > 0) {
    const { data: followingData, error: followingError } = await supabase
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", currentUserId)
      .in("following_id", uniqueMemberIds)
      .limit(uniqueMemberIds.length);

    if (followingError) {
      if (__DEV__) {
        console.warn("[RecordQuest][social] following-state query failed", {
          mode,
          currentUserId,
          viewedUserId: trimmedViewedUserId,
          code: followingError.code,
          message: followingError.message,
          details: followingError.details,
          hint: followingError.hint,
        });
      }
    } else {
      for (const row of ((followingData as Array<{ following_id?: string | null }> | null) ?? [])) {
        const followingId = readTrimmedString(row.following_id);
        if (followingId) {
          followingByCurrentUser.add(followingId);
        }
      }
    }
  }

  const users: SocialConnectionUser[] = uniqueMemberIds.map((memberId) => {
    const profile = profileMap.get(memberId);
    const username = readTrimmedString(profile?.username);
    const displayName =
      readTrimmedString(profile?.display_name) ||
      username ||
      "RecordQuest User";
    const avatarUrl = readTrimmedString(profile?.avatar_url) || undefined;

    return {
      userId: memberId,
      displayName,
      username,
      avatarUrl,
      isFollowingByCurrentUser: followingByCurrentUser.has(memberId),
    };
  });

  users.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return {
    users,
    blockedByPolicy: false,
  };
}
