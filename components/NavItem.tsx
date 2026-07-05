import React from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { RecordQuestTheme } from "../constants/theme";

interface NavItemProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function NavItem({ label, active, onPress }: NavItemProps) {
  const animatedValue = React.useRef(new Animated.Value(active ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: active ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [active, animatedValue]);

  const activeScale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1],
  });

  const activeOpacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const icon = label === "Home"
    ? "⌂"
    : label === "Library"
      ? "◉"
      : label === "Stores"
        ? "⌖"
        : label === "Wishlist"
          ? "♡"
          : "◌";

  return (
    <Pressable
      style={({ pressed }) => [styles.navItem, pressed ? styles.navItemPressed : null]}
      onPress={onPress}
    >
      <Animated.View style={{ transform: [{ scale: activeScale }], opacity: activeOpacity }}>
        <Text style={[styles.navIcon, active && styles.navIconActive]}>{icon}</Text>
      </Animated.View>
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
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 12,
    minWidth: 0,
    minHeight: 44,
  },
  navItemPressed: {
    opacity: 0.82,
  },
  navIcon: {
    color: "#605B70",
    fontSize: 15,
    lineHeight: 17,
    fontWeight: "600",
  },
  navIconActive: {
    color: RecordQuestTheme.colors.accent,
  },
  navText: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13,
    textAlign: "center",
  },
  navTextActive: {
    color: RecordQuestTheme.colors.accent,
  },
});
