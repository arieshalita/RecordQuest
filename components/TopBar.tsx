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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124, 58, 237, 0.10)",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(124, 58, 237, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: "#a7a1bd",
    fontSize: 18,
    fontWeight: "600",
  },
  topTitle: {
    color: "#fff4d6",
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
  },
});
