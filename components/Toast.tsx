import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface ToastProps {
  message: string;
}

export function Toast({ message }: ToastProps) {
  return (
    <View style={styles.successMessageContainer}>
      <Text style={styles.successMessageText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  successMessageContainer: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "rgba(124, 58, 237, 0.95)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  successMessageText: {
    color: "#fff4d6",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
