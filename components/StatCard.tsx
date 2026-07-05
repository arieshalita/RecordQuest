import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { RecordQuestTheme } from "../constants/theme";

interface StatCardProps {
  value: number;
  label: string;
}

export function StatCard({ value, label }: StatCardProps) {
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
