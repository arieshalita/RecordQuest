import type { AchievementBadge } from "../hooks/types";

function parseDate(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function formatAchievementEarnedDate(value?: string | null): string | null {
  const timestamp = parseDate(value);
  if (timestamp === null) {
    return null;
  }

  return `Earned ${new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function getAchievementProgressText(badge: Pick<AchievementBadge, "current" | "target">): string {
  const target = Math.max(0, badge.target);
  const current = Math.max(0, badge.current);

  if (target <= 0) {
    return "Not yet earned";
  }

  return `${Math.min(current, target)} of ${target}`;
}

function getBadgeEarnedTimestamp(badge: AchievementBadge): number | null {
  if (!badge.unlocked) {
    return null;
  }

  return parseDate(badge.earned_at);
}

export function compareAchievementBadges(a: AchievementBadge, b: AchievementBadge): number {
  const aEarned = a.unlocked;
  const bEarned = b.unlocked;

  if (aEarned !== bEarned) {
    return aEarned ? -1 : 1;
  }

  const aTimestamp = getBadgeEarnedTimestamp(a);
  const bTimestamp = getBadgeEarnedTimestamp(b);

  if (aEarned && bEarned) {
    if (aTimestamp !== null && bTimestamp !== null && aTimestamp !== bTimestamp) {
      return bTimestamp - aTimestamp;
    }

    if (aTimestamp !== null && bTimestamp === null) {
      return -1;
    }

    if (aTimestamp === null && bTimestamp !== null) {
      return 1;
    }
  }

  const aRemaining = Math.max(0, a.target - a.current);
  const bRemaining = Math.max(0, b.target - b.current);

  if (aRemaining !== bRemaining) {
    return aRemaining - bRemaining;
  }

  const aRatio = a.target > 0 ? a.current / a.target : 0;
  const bRatio = b.target > 0 ? b.current / b.target : 0;

  if (aRatio !== bRatio) {
    return bRatio - aRatio;
  }

  return a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
}

export function sortAchievementBadges(badges: AchievementBadge[]): AchievementBadge[] {
  return [...badges].sort(compareAchievementBadges);
}

export function buildAchievementPreviewBadges(
  badges: AchievementBadge[],
  minimumPreviewCount = 3
): AchievementBadge[] {
  const sortedBadges = sortAchievementBadges(badges);
  const earnedBadges = sortedBadges.filter((badge) => badge.unlocked);

  if (earnedBadges.length >= minimumPreviewCount) {
    return earnedBadges;
  }

  const previewBadges = [...earnedBadges];

  for (const badge of sortedBadges) {
    if (previewBadges.length >= minimumPreviewCount) {
      break;
    }

    if (!badge.unlocked) {
      previewBadges.push(badge);
    }
  }

  return previewBadges;
}