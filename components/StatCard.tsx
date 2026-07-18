import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { RecordQuestTheme } from "../constants/theme";

interface StatCardProps {
  value: number;
  label: string;
  onPress?: () => void;
}

export function StatCard({ value, label, onPress }: StatCardProps) {
  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.statCard, pressed ? styles.statCardPressed : null]}
        onPress={onPress}
      >
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    backgroundColor: RecordQuestTheme.colors.bgCard,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  statValue: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 4,
  },
  statLabel: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
