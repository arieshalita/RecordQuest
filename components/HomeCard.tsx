import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

interface HomeCardProps {
  title: string;
  subtitle: string;
  onPress: () => void;
  accentColor?: string;
}

export function HomeCard({ title, subtitle, onPress, accentColor }: HomeCardProps) {
  return (
    <Pressable
      style={[
        styles.homeCard,
        accentColor
          ? {
              borderColor: accentColor,
              backgroundColor: `${accentColor}22`,
            }
          : null,
      ]}
      onPress={onPress}
    >
      <View>
        <Text style={styles.homeCardTitle}>{title}</Text>
        <Text style={styles.homeCardSubtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.arrowWrap, accentColor ? { backgroundColor: `${accentColor}33` } : null]}>
        <Text style={styles.homeArrow}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  homeCard: {
    backgroundColor: "rgba(20, 18, 38, 0.88)",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.24)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  homeCardTitle: {
    color: "#fff4d6",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  homeCardSubtitle: {
    color: "#c7c2db",
    fontSize: 11,
    maxWidth: 180,
  },
  arrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124, 58, 237, 0.20)",
  },
  homeArrow: {
    color: "#fff4d6",
    fontSize: 20,
    fontWeight: "700",
  },
});
