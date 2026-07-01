import { getCurrentSession, supabase } from "./supabase-client";

type FollowResult = {
  success: boolean;
  error?: string;
};

async function getCurrentUserId(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.user?.id ?? null;
}

function invalidTargetResult(): FollowResult {
  return {
    success: false,
    error: "Invalid target user.",
  };
}

export async function followUser(targetUserId: string): Promise<FollowResult> {
  const trimmedTarget = targetUserId.trim();
  if (!trimmedTarget) {
    return invalidTargetResult();
  }

  const currentUserId = await getCurrentUserId();
  if (!currentUserId) {
    return {
      success: false,
      error: "You must be signed in to follow users.",
    };
  }

  if (currentUserId === trimmedTarget) {
    return {
      success: false,
      error: "You cannot follow yourself.",
    };
  }

  const { data: existingFollow, error: existingError } = await supabase
    .from("user_follows")
    .select("id")
    .eq("follower_id", currentUserId)
    .eq("following_id", trimmedTarget)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return {
      success: false,
      error: existingError.message,
    };
  }

  if (existingFollow) {
    return { success: true };
  }

  const { error } = await supabase.from("user_follows").insert({
    follower_id: currentUserId,
    following_id: trimmedTarget,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return { success: true };
}

export async function unfollowUser(targetUserId: string): Promise<FollowResult> {
  const trimmedTarget = targetUserId.trim();
  if (!trimmedTarget) {
    return invalidTargetResult();
  }

  const currentUserId = await getCurrentUserId();
  if (!currentUserId) {
    return {
      success: false,
      error: "You must be signed in to unfollow users.",
    };
  }

  if (currentUserId === trimmedTarget) {
    return {
      success: false,
      error: "You cannot unfollow yourself.",
    };
  }

  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", currentUserId)
    .eq("following_id", trimmedTarget);

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return { success: true };
}

export async function isFollowing(targetUserId: string): Promise<boolean> {
  const trimmedTarget = targetUserId.trim();
  if (!trimmedTarget) {
    return false;
  }

  const currentUserId = await getCurrentUserId();
  if (!currentUserId || currentUserId === trimmedTarget) {
    return false;
  }

  const { data, error } = await supabase
    .from("user_follows")
    .select("id")
    .eq("follower_id", currentUserId)
    .eq("following_id", trimmedTarget)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[RecordQuest][follows] isFollowing failed:", error.message);
    return false;
  }

  return !!data;
}

export async function getFollowerCount(userId: string): Promise<number> {
  const trimmedUserId = userId.trim();
  if (!trimmedUserId) {
    return 0;
  }

  const { count, error } = await supabase
    .from("user_follows")
    .select("id", { count: "exact", head: true })
    .eq("following_id", trimmedUserId);

  if (error) {
    console.warn("[RecordQuest][follows] getFollowerCount failed:", error.message);
    return 0;
  }

  return count ?? 0;
}

export async function getFollowingCount(userId: string): Promise<number> {
  const trimmedUserId = userId.trim();
  if (!trimmedUserId) {
    return 0;
  }

  const { count, error } = await supabase
    .from("user_follows")
    .select("id", { count: "exact", head: true })
    .eq("follower_id", trimmedUserId);

  if (error) {
    console.warn("[RecordQuest][follows] getFollowingCount failed:", error.message);
    return 0;
  }

  return count ?? 0;
}
