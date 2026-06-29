import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

interface HomeCardProps {
  title: string;
  subtitle: string;
  onPress: () => void;
}

export function HomeCard({ title, subtitle, onPress }: HomeCardProps) {
  return (
    <Pressable style={styles.homeCard} onPress={onPress}>
      <View>
        <Text style={styles.homeCardTitle}>{title}</Text>
        <Text style={styles.homeCardSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.homeArrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  homeCard: {
    backgroundColor: "rgba(18, 16, 38, 0.60)",
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.10)",
  },
  homeCardTitle: {
    color: "#fff4d6",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  homeCardSubtitle: {
    color: "#a7a1bd",
    fontSize: 12,
  },
  homeArrow: {
    color: "#d4af37",
    fontSize: 24,
    fontWeight: "600",
  },
});
