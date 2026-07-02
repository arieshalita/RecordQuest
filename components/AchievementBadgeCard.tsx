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
      <Text
        style={[styles.badgeLabel, badge.unlocked ? styles.badgeLabelUnlocked : styles.badgeLabelLocked]}
        numberOfLines={2}
      >
        {badge.label}
      </Text>
      <Text
        style={[styles.badgeRequirement, badge.unlocked ? styles.badgeRequirementUnlocked : styles.badgeRequirementLocked]}
        numberOfLines={3}
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
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "space-between",
    width: 150,
    minHeight: 152,
    borderWidth: 2,
    marginBottom: 2,
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
    fontSize: 30,
    marginBottom: 6,
  },
  badgeEmojiUnlocked: {
    fontSize: 30,
  },
  badgeEmojiLocked: {
    fontSize: 30,
    opacity: 0.4,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 4,
    textAlign: "center",
    lineHeight: 14,
    width: "100%",
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
    marginBottom: 6,
    textAlign: "center",
    lineHeight: 13,
    width: "100%",
  },
  badgeRequirementUnlocked: {
    color: "#d6c2a1",
  },
  badgeRequirementLocked: {
    color: "#57516C",
  },
  badgeProgress: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
    lineHeight: 14,
  },
  badgeProgressUnlocked: {
    color: "#f2cc72",
  },
  badgeProgressLocked: {
    color: "#57516C",
  },
  badgeStatus: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    lineHeight: 12,
    marginTop: 0,
  },
  badgeStatusUnlocked: {
    color: "#d4af37",
  },
  badgeStatusLocked: {
    color: "#57516C",
  },
});
