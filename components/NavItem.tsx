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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  navItemActive: {
    backgroundColor: "rgba(124, 58, 237, 0.18)",
  },
  navDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#57516C",
  },
  navDotActive: {
    backgroundColor: "#d4af37",
  },
  navText: {
    color: "#a7a1bd",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 10,
  },
  navTextActive: {
    color: "#fff4d6",
  },
});
