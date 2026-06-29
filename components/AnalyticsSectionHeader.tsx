import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface AnalyticsSectionHeaderProps {
  title: string;
  icon?: string;
}

export function AnalyticsSectionHeader({ title, icon = "📈" }: AnalyticsSectionHeaderProps) {
  return (
    <View style={styles.analyticsSectionHeader}>
      <Text style={styles.analyticsSectionIcon}>{icon}</Text>
      <Text style={styles.analyticsSectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  analyticsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 20,
  },
  analyticsSectionIcon: {
    fontSize: 19,
    marginRight: 8,
  },
  analyticsSectionTitle: {
    color: "#d6c2a1",
    fontSize: 14,
    fontWeight: "800",
  },
});
