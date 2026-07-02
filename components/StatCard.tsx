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
    backgroundColor: "rgba(20, 18, 38, 0.90)",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.26)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 7,
  },
  statValue: {
    color: "#f8efd5",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 4,
  },
  statLabel: {
    color: "#c7c2db",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
