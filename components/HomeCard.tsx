import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { RecordQuestTheme } from "../constants/theme";

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
      style={({ pressed }) => [
        styles.homeCard,
        accentColor
          ? {
              borderColor: `${accentColor}66`,
              backgroundColor: `${accentColor}16`,
            }
          : null,
        pressed ? styles.homeCardPressed : null,
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
    backgroundColor: RecordQuestTheme.colors.bgCard,
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 16,
    minHeight: 86,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.10)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  homeCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
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
    backgroundColor: "rgba(248, 238, 220, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconText: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 14,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  homeCardTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
  },
  homeCardSubtitle: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  arrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248, 238, 220, 0.08)",
  },
  homeArrow: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
});
