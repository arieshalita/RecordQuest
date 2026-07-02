import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

interface TopBarProps {
  title: string;
  back: () => void;
}

export function TopBar({ title, back }: TopBarProps) {
  return (
    <View style={styles.topBar}>
      <Pressable style={styles.iconCircle} onPress={back}>
        <Text style={styles.iconText}>‹</Text>
      </Pressable>
      <Text style={styles.topTitle}>{title}</Text>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>♪</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginBottom: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(18, 16, 38, 0.94)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.26)",
  },
  iconText: {
    color: "#d5c6ff",
    fontSize: 17,
    fontWeight: "700",
  },
  topTitle: {
    color: "#f8efd5",
    fontSize: 34,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
    letterSpacing: 0.3,
  },
});
