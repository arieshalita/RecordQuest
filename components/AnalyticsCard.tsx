import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface AnalyticsCardProps {
  value: string | number;
  label: string;
  icon?: string;
}

export function AnalyticsCard({ value, label, icon = "📊" }: AnalyticsCardProps) {
  // Auto-scale font size based on value length
  const valueStr = String(value);
  let valueFontSize = 16;
  if (valueStr.length > 15) valueFontSize = 10;
  else if (valueStr.length > 12) valueFontSize = 11;
  else if (valueStr.length > 8) valueFontSize = 13;

  return (
    <View style={styles.analyticsCard}>
      <Text style={styles.analyticsCardIcon}>{icon}</Text>
      <Text
        style={[styles.analyticsCardValue, { fontSize: valueFontSize }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {value}
      </Text>
      <Text style={styles.analyticsCardLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  analyticsCard: {
    backgroundColor: "rgba(18, 16, 38, 0.96)",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.20)",
    flex: 1,
    minWidth: "48%",
    minHeight: 140,
  },
  analyticsCardIcon: {
    fontSize: 26,
    marginBottom: 10,
  },
  analyticsCardValue: {
    color: "#fff4d6",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 6,
    textAlign: "center",
    maxWidth: "100%",
    flex: 1,
  },
  analyticsCardLabel: {
    color: "#a7a1bd",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 12,
    fontWeight: "600",
    marginTop: 4,
    maxWidth: "100%",
  },
});
