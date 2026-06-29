import React from "react";
import { View, Text, StyleSheet } from "react-native";

export type AchievementBadge = {
  id: string;
  emoji: string;
  label: string;
  requirement: string;
  current: number;
  target: number;
  unlocked: boolean;
};

interface AchievementBadgeCardProps {
  badge: AchievementBadge;
}

export function AchievementBadgeCard({ badge }: AchievementBadgeCardProps) {
  return (
    <View style={[styles.badgeCard, badge.unlocked ? styles.badgeCardUnlocked : styles.badgeCardLocked]}>
      <Text style={[styles.badgeEmoji, badge.unlocked ? styles.badgeEmojiUnlocked : styles.badgeEmojiLocked]}>
        {badge.emoji}
      </Text>
      <Text style={[styles.badgeLabel, badge.unlocked ? styles.badgeLabelUnlocked : styles.badgeLabelLocked]}>
        {badge.label}
      </Text>
      <Text
        style={[styles.badgeRequirement, badge.unlocked ? styles.badgeRequirementUnlocked : styles.badgeRequirementLocked]}
      >
        {badge.requirement}
      </Text>
      <Text
        style={[styles.badgeProgress, badge.unlocked ? styles.badgeProgressUnlocked : styles.badgeProgressLocked]}
      >
        {`${Math.min(badge.current, badge.target)} / ${badge.target}`}
      </Text>
      <Text style={[styles.badgeStatus, badge.unlocked ? styles.badgeStatusUnlocked : styles.badgeStatusLocked]}>
        {badge.unlocked ? "Unlocked" : "Locked"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeCard: {
    backgroundColor: "rgba(18, 16, 38, 0.96)",
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    minHeight: 180,
    borderWidth: 2,
    marginBottom: 12,
  },
  badgeCardUnlocked: {
    borderColor: "rgba(212, 175, 55, 0.40)",
    backgroundColor: "rgba(18, 16, 38, 0.98)",
  },
  badgeCardLocked: {
    borderColor: "rgba(87, 81, 108, 0.20)",
    backgroundColor: "rgba(18, 16, 38, 0.60)",
  },
  badgeEmoji: {
    fontSize: 42,
    marginBottom: 8,
  },
  badgeEmojiUnlocked: {
    fontSize: 42,
  },
  badgeEmojiLocked: {
    fontSize: 42,
    opacity: 0.4,
  },
  badgeLabel: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  badgeLabelUnlocked: {
    color: "#fff4d6",
  },
  badgeLabelLocked: {
    color: "#57516C",
  },
  badgeRequirement: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  badgeRequirementUnlocked: {
    color: "#d6c2a1",
  },
  badgeRequirementLocked: {
    color: "#57516C",
  },
  badgeProgress: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  badgeProgressUnlocked: {
    color: "#d4af37",
  },
  badgeProgressLocked: {
    color: "#57516C",
  },
  badgeStatus: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  badgeStatusUnlocked: {
    color: "#d4af37",
  },
  badgeStatusLocked: {
    color: "#57516C",
  },
});
