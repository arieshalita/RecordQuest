import { getCurrentSession, supabase } from "./supabase-client";

export const REPORT_USER_REASONS = [
  "Harassment or bullying",
  "Inappropriate content",
  "Spam",
  "Impersonation",
  "Other",
] as const;

export type ReportUserReason = (typeof REPORT_USER_REASONS)[number];

type ModerationMutationResult = {
  success: boolean;
  error?: string;
};

type BlockUserResult = ModerationMutationResult & {
  alreadyBlocked?: boolean;
};

type UserBlockRow = {
  blocker_user_id?: string | null;
  blocked_user_id?: string | null;
};

function readTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function getCurrentUserId(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.user?.id ?? null;
}

function normalizeReason(input: string): string {
  const normalized = input.trim();

  for (const reason of REPORT_USER_REASONS) {
    if (reason.toLowerCase() === normalized.toLowerCase()) {
      return reason;
    }
  }

  return "";
}

export async function getBlockedUserIdsForUser(currentUserId: string): Promise<Set<string>> {
  const userId = currentUserId.trim();
  if (!userId) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocker_user_id,blocked_user_id")
    .or(`blocker_user_id.eq.${userId},blocked_user_id.eq.${userId}`)
    .limit(2000);

  if (error) {
    throw new Error(error.message || "Could not load block list.");
  }

  const blockedIds = new Set<string>();

  for (const row of ((data as UserBlockRow[] | null) ?? [])) {
    const blockerUserId = readTrimmed(row.blocker_user_id);
    const blockedUserId = readTrimmed(row.blocked_user_id);

    if (!blockerUserId || !blockedUserId) {
      continue;
    }

    if (blockerUserId === userId) {
      blockedIds.add(blockedUserId);
      continue;
    }

    if (blockedUserId === userId) {
      blockedIds.add(blockerUserId);
    }
  }

  return blockedIds;
}

export async function isUserBlockedEitherDirection(
  currentUserId: string,
  targetUserId: string
): Promise<boolean> {
  const scopedCurrentUserId = currentUserId.trim();
  const scopedTargetUserId = targetUserId.trim();

  if (!scopedCurrentUserId || !scopedTargetUserId || scopedCurrentUserId === scopedTargetUserId) {
    return false;
  }

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocker_user_id,blocked_user_id")
    .or(
      `and(blocker_user_id.eq.${scopedCurrentUserId},blocked_user_id.eq.${scopedTargetUserId}),and(blocker_user_id.eq.${scopedTargetUserId},blocked_user_id.eq.${scopedCurrentUserId})`
    )
    .limit(1);

  if (error) {
    throw new Error(error.message || "Could not load block relationship.");
  }

  return (((data as UserBlockRow[] | null) ?? []).length > 0);
}

export async function submitUserReport(
  reportedUserId: string,
  reason: string,
  detailsInput = ""
): Promise<ModerationMutationResult> {
  const scopedReportedUserId = reportedUserId.trim();
  const normalizedReason = normalizeReason(reason);
  const details = detailsInput.trim();

  if (!scopedReportedUserId) {
    return {
      success: false,
      error: "Invalid user.",
    };
  }

  if (!normalizedReason) {
    return {
      success: false,
      error: "Please select a report reason.",
    };
  }

  if (details.length > 500) {
    return {
      success: false,
      error: "Details must be 500 characters or fewer.",
    };
  }

  const currentUserId = await getCurrentUserId();
  if (!currentUserId) {
    return {
      success: false,
      error: "You must be signed in to submit a report.",
    };
  }

  if (currentUserId === scopedReportedUserId) {
    return {
      success: false,
      error: "You cannot report yourself.",
    };
  }

  const { error } = await supabase.from("user_reports").insert({
    reporter_user_id: currentUserId,
    reported_user_id: scopedReportedUserId,
    reason: normalizedReason,
    details: details || null,
  });

  if (error) {
    return {
      success: false,
      error: "Could not submit your report right now.",
    };
  }

  return {
    success: true,
  };
}

export async function blockUser(targetUserId: string): Promise<BlockUserResult> {
  const scopedTargetUserId = targetUserId.trim();

  if (!scopedTargetUserId) {
    return {
      success: false,
      error: "Invalid user.",
    };
  }

  const currentUserId = await getCurrentUserId();
  if (!currentUserId) {
    return {
      success: false,
      error: "You must be signed in to block users.",
    };
  }

  if (currentUserId === scopedTargetUserId) {
    return {
      success: false,
      error: "You cannot block yourself.",
    };
  }

  const { data: existingRow, error: existingError } = await supabase
    .from("user_blocks")
    .select("blocker_user_id")
    .eq("blocker_user_id", currentUserId)
    .eq("blocked_user_id", scopedTargetUserId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return {
      success: false,
      error: "Could not block this user right now.",
    };
  }

  if (existingRow) {
    return {
      success: true,
      alreadyBlocked: true,
    };
  }

  const { error } = await supabase.from("user_blocks").insert({
    blocker_user_id: currentUserId,
    blocked_user_id: scopedTargetUserId,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        success: true,
        alreadyBlocked: true,
      };
    }

    return {
      success: false,
      error: "Could not block this user right now.",
    };
  }

  return {
    success: true,
    alreadyBlocked: false,
  };
}
