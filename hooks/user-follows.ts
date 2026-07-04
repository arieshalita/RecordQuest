import { getCurrentSession, supabase } from "./supabase-client";

type FollowResult = {
  success: boolean;
  error?: string;
};

type ResolvedFollowTarget = {
  authUserId: string | null;
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveFollowTargetAuthUserId(targetRef: string): Promise<ResolvedFollowTarget> {
  const trimmedTarget = targetRef.trim();
  if (!trimmedTarget) {
    return {
      authUserId: null,
    };
  }

  if (isUuid(trimmedTarget)) {
    return {
      authUserId: trimmedTarget,
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,user_id")
    .eq("id", trimmedTarget)
    .maybeSingle();

  if (error) {
    return {
      authUserId: null,
    };
  }

  const resolvedUserId = typeof data?.user_id === "string" ? data.user_id.trim() : "";

  return {
    authUserId: resolvedUserId || null,
  };
}


async function notifyFollowTarget(
  followerUserId: string,
  followedUserId: string
): Promise<void> {
  if (!followedUserId) {
    return;
  }

  if (followerUserId === followedUserId) {
    return;
  }

  // Target push tokens are server-only. The client cannot securely read another user's token.
  // We delegate follow-notification delivery to the Edge Function.
  const { data, error } = await supabase.functions.invoke("send-follow-notification", {
    body: {
      followedUserId,
    },
  });

  if (error) {
    console.warn(
      "[RecordQuest][push] edge follow notification invoke failed:",
      error.message
    );
    return;
  }

  const sent = Boolean((data as { sent?: boolean } | null)?.sent);
  const reason = (data as { reason?: string } | null)?.reason ?? "none";

  if (!sent) {
    console.warn("[RecordQuest][push] edge follow notification not sent:", reason);
  }
}

export async function followUser(targetUserId: string): Promise<FollowResult> {
  const trimmedTarget = targetUserId.trim();
  if (!trimmedTarget) {
    return invalidTargetResult();
  }

  const resolvedTarget = await resolveFollowTargetAuthUserId(trimmedTarget);
  const resolvedAuthUserId = resolvedTarget.authUserId;

  if (!resolvedAuthUserId) {
    return {
      success: false,
      error: "Invalid target user.",
    };
  }

  const currentUserId = await getCurrentUserId();
  if (!currentUserId) {
    return {
      success: false,
      error: "You must be signed in to follow users.",
    };
  }

  if (currentUserId === resolvedAuthUserId) {
    return {
      success: false,
      error: "You cannot follow yourself.",
    };
  }

  const { data: existingFollow, error: existingError } = await supabase
    .from("user_follows")
    .select("id")
    .eq("follower_id", currentUserId)
    .eq("following_id", resolvedAuthUserId)
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
    following_id: resolvedAuthUserId,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  void notifyFollowTarget(currentUserId, resolvedAuthUserId).catch((notifyError) => {
    console.warn(
      "[RecordQuest][push] follow notification error:",
      notifyError instanceof Error ? notifyError.message : "unknown error"
    );
  });

  return { success: true };
}

export async function unfollowUser(targetUserId: string): Promise<FollowResult> {
  const trimmedTarget = targetUserId.trim();
  if (!trimmedTarget) {
    return invalidTargetResult();
  }

  const resolvedTarget = await resolveFollowTargetAuthUserId(trimmedTarget);
  const resolvedAuthUserId = resolvedTarget.authUserId;

  if (!resolvedAuthUserId) {
    return {
      success: false,
      error: "Invalid target user.",
    };
  }

  const currentUserId = await getCurrentUserId();
  if (!currentUserId) {
    return {
      success: false,
      error: "You must be signed in to unfollow users.",
    };
  }

  if (currentUserId === resolvedAuthUserId) {
    return {
      success: false,
      error: "You cannot unfollow yourself.",
    };
  }

  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", currentUserId)
    .eq("following_id", resolvedAuthUserId);

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

  const resolvedTarget = await resolveFollowTargetAuthUserId(trimmedTarget);
  const resolvedAuthUserId = resolvedTarget.authUserId;

  if (!resolvedAuthUserId) {
    return false;
  }

  const currentUserId = await getCurrentUserId();
  if (!currentUserId || currentUserId === resolvedAuthUserId) {
    return false;
  }

  const { data, error } = await supabase
    .from("user_follows")
    .select("id")
    .eq("follower_id", currentUserId)
    .eq("following_id", resolvedAuthUserId)
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
