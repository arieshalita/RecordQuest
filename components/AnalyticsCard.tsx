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
  let valueFontSize = 18;
  if (valueStr.length > 15) valueFontSize = 11;
  else if (valueStr.length > 12) valueFontSize = 12;
  else if (valueStr.length > 8) valueFontSize = 15;

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
    borderRadius: 22,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.22)",
    flex: 1,
    minWidth: "48%",
    minHeight: 155,
  },
  analyticsCardIcon: {
    fontSize: 28,
    marginBottom: 12,
  },
  analyticsCardValue: {
    color: "#fff4d6",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
    maxWidth: "100%",
    flex: 1,
  },
  analyticsCardLabel: {
    color: "#a7a1bd",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 13,
    fontWeight: "600",
    marginTop: 2,
    maxWidth: "100%",
  },
});
