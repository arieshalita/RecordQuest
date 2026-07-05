import React from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RecordQuestTheme } from "../constants/theme";

interface TopBarProps {
  title: string;
  back: () => void;
  rightIcon?: string;
  rightAction?: () => void;
  rightActionLabel?: string;
  rightActionDisabled?: boolean;
  rightActionLoading?: boolean;
}

export function TopBar({
  title,
  back,
  rightIcon = "◎",
  rightAction,
  rightActionLabel,
  rightActionDisabled = false,
  rightActionLoading = false,
}: TopBarProps) {
  const insets = useSafeAreaInsets();
  const safeTopOffset = Math.max(0, Math.min(8, insets.top - 20));
  const isRightActionInteractive = typeof rightAction === "function";
  const isRightActionBlocked = rightActionDisabled || rightActionLoading;

  return (
    <View style={[styles.topBar, { paddingTop: 8 + safeTopOffset }]}> 
      <Pressable style={({ pressed }) => [styles.iconCircle, pressed ? styles.iconCirclePressed : null]} onPress={back}>
        <Text style={styles.iconText}>‹</Text>
      </Pressable>
      <Text style={styles.topTitle}>{title}</Text>
      {isRightActionInteractive ? (
        <Pressable
          style={({ pressed }) => [
            styles.iconCircle,
            isRightActionBlocked ? styles.iconCircleDisabled : null,
            pressed && !isRightActionBlocked ? styles.iconCirclePressed : null,
          ]}
          onPress={rightAction}
          disabled={isRightActionBlocked}
          accessibilityRole="button"
          accessibilityLabel={rightActionLabel}
        >
          {rightActionLoading ? (
            <ActivityIndicator size="small" color={RecordQuestTheme.colors.textSecondary} />
          ) : (
            <Text style={styles.iconText}>{rightIcon}</Text>
          )}
        </Pressable>
      ) : (
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>{rightIcon}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingBottom: 10,
    marginBottom: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: RecordQuestTheme.colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
  },
  iconCirclePressed: {
    opacity: 0.85,
  },
  iconCircleDisabled: {
    opacity: 0.6,
  },
  iconText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 16,
    fontWeight: "700",
  },
  topTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 30,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
    letterSpacing: 0.2,
  },
});
