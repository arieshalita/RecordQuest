import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

interface HomeCardProps {
  title: string;
  subtitle: string;
  onPress: () => void;
  accentColor?: string;
  icon?: string;
}

export function HomeCard({ title, subtitle, onPress, accentColor, icon = "♪" }: HomeCardProps) {
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
      <View style={styles.leftRow}>
        <View style={[styles.iconWrap, accentColor ? { backgroundColor: `${accentColor}30` } : null]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.homeCardTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.homeCardSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 84,
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
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(124, 58, 237, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconText: {
    color: "#f5e9cc",
    fontSize: 15,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  homeCardTitle: {
    color: "#fff4d6",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
  },
  homeCardSubtitle: {
    color: "#c7c2db",
    fontSize: 11,
    lineHeight: 15,
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
