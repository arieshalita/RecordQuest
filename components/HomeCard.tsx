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
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 90,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 1,
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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(248, 238, 220, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconText: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 15,
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
    fontSize: 12,
    lineHeight: 16,
  },
  arrowWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
