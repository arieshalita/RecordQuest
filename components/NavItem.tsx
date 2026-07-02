import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

interface NavItemProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function NavItem({ label, active, onPress }: NavItemProps) {
  return (
    <Pressable style={[styles.navItem, active && styles.navItemActive]} onPress={onPress}>
      <View style={[styles.navDot, active && styles.navDotActive]} />
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  navItem: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    minWidth: 0,
  },
  navItemActive: {
    backgroundColor: "rgba(124, 58, 237, 0.24)",
  },
  navDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#57516C",
  },
  navDotActive: {
    backgroundColor: "#d4af37",
  },
  navText: {
    color: "#a7a1bd",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 13,
    textAlign: "center",
  },
  navTextActive: {
    color: "#fff4d6",
  },
});
