import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface EmptyStateProps {
  title: string;
  subtitle: string;
}

export function EmptyState({ title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.emptyFeatureCard}>
      <Text style={styles.emptyFeatureTitle}>{title}</Text>
      <Text style={styles.emptyFeatureText}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyFeatureCard: {
    backgroundColor: "rgba(18, 16, 38, 0.60)",
    borderRadius: 24,
    paddingVertical: 60,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 32,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.15)",
    borderStyle: "dashed",
  },
  emptyFeatureTitle: {
    color: "#d6c2a1",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyFeatureText: {
    color: "#a7a1bd",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
