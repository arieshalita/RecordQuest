import React from "react";
import { View, Text, StyleSheet } from "react-native";

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
    backgroundColor: "rgba(18, 16, 38, 0.80)",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.20)",
  },
  statValue: {
    color: "#fff4d6",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 4,
  },
  statLabel: {
    color: "#a7a1bd",
    fontSize: 11,
    fontWeight: "600",
  },
});
