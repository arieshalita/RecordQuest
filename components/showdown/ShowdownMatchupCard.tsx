import React from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { RecordQuestTheme } from "../../constants/theme";
import type { ShowdownMatchup, ShowdownMatchupEntry } from "../../hooks/showdown-types";
import { AlbumArt } from "../AlbumArt";

type ShowdownMatchupCardProps = {
  matchup: ShowdownMatchup;
  disabled?: boolean;
  selectedWinnerId?: string | null;
  transitionKey?: string;
  onVoteLeft: () => void;
  onVoteRight: () => void;
};

function getOptionStyle(
  entry: ShowdownMatchupEntry,
  selectedWinnerId: string | null | undefined,
  disabled: boolean
) {
  const isSelected = selectedWinnerId === entry.id;
  const isDimmed = Boolean(selectedWinnerId) && selectedWinnerId !== entry.id;

  return {
    isSelected,
    isDimmed,
    styles: [
      styles.optionCard,
      isSelected ? styles.optionCardSelected : null,
      isDimmed ? styles.optionCardDimmed : null,
      disabled ? styles.optionCardDisabled : null,
    ],
  };
}

function VoteOption({
  entry,
  side,
  selectedWinnerId,
  disabled = false,
  onVote,
}: {
  entry: ShowdownMatchupEntry;
  side: "left" | "right";
  selectedWinnerId?: string | null;
  disabled?: boolean;
  onVote: () => void;
}) {
  const optionStyle = getOptionStyle(entry, selectedWinnerId, disabled);

  return (
    <Pressable
      testID={side === "left" ? "showdown-vote-left" : "showdown-vote-right"}
      style={({ pressed }) => [optionStyle.styles, pressed && !disabled ? styles.optionCardPressed : null]}
      onPress={onVote}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Vote for ${entry.album_title} by ${entry.artist_name}`}
      accessibilityState={{ disabled, selected: optionStyle.isSelected }}
    >
      <AlbumArt
        uri={entry.cover_url}
        style={styles.cover}
        debugScreen="other"
        debugAlbum={entry.album_title}
        debugArtist={entry.artist_name}
        debugUriSource="supabase"
      />

      <Text style={styles.albumTitle} numberOfLines={2}>
        {entry.album_title}
      </Text>
      <Text style={styles.artistName} numberOfLines={1}>
        {entry.artist_name}
      </Text>

      {entry.caption ? (
        <Text style={styles.caption} numberOfLines={2}>
          {entry.caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function ShowdownMatchupCard({
  matchup,
  disabled = false,
  selectedWinnerId,
  transitionKey,
  onVoteLeft,
  onVoteRight,
}: ShowdownMatchupCardProps) {
  const [reduceMotionEnabled, setReduceMotionEnabled] = React.useState(false);
  const leftScale = React.useRef(new Animated.Value(1)).current;
  const rightScale = React.useRef(new Animated.Value(1)).current;
  const leftOpacity = React.useRef(new Animated.Value(1)).current;
  const rightOpacity = React.useRef(new Animated.Value(1)).current;
  const entranceOpacity = React.useRef(new Animated.Value(1)).current;
  const entranceY = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    let isMounted = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (isMounted) {
        setReduceMotionEnabled(Boolean(value));
      }
    });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      setReduceMotionEnabled(Boolean(value));
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  React.useEffect(() => {
    if (reduceMotionEnabled) {
      entranceOpacity.setValue(1);
      entranceY.setValue(0);
      return;
    }

    entranceOpacity.setValue(0.01);
    entranceY.setValue(8);
    Animated.parallel([
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 130,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(entranceY, {
        toValue: 0,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [entranceOpacity, entranceY, reduceMotionEnabled, transitionKey]);

  React.useEffect(() => {
    if (!selectedWinnerId) {
      if (reduceMotionEnabled) {
        leftScale.setValue(1);
        rightScale.setValue(1);
        leftOpacity.setValue(1);
        rightOpacity.setValue(1);
        return;
      }

      Animated.parallel([
        Animated.timing(leftScale, {
          toValue: 1,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(rightScale, {
          toValue: 1,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(leftOpacity, {
          toValue: 1,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(rightOpacity, {
          toValue: 1,
          duration: 90,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    const leftSelected = selectedWinnerId === matchup.entry_a.id;

    if (reduceMotionEnabled) {
      leftScale.setValue(leftSelected ? 1.02 : 1);
      rightScale.setValue(leftSelected ? 1 : 1.02);
      leftOpacity.setValue(leftSelected ? 1 : 0.7);
      rightOpacity.setValue(leftSelected ? 0.7 : 1);
      return;
    }

    Animated.parallel([
      Animated.timing(leftScale, {
        toValue: leftSelected ? 1.02 : 1,
        duration: 115,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(rightScale, {
        toValue: leftSelected ? 1 : 1.02,
        duration: 115,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(leftOpacity, {
        toValue: leftSelected ? 1 : 0.66,
        duration: 105,
        useNativeDriver: true,
      }),
      Animated.timing(rightOpacity, {
        toValue: leftSelected ? 0.66 : 1,
        duration: 105,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    leftOpacity,
    leftScale,
    matchup.entry_a.id,
    reduceMotionEnabled,
    rightOpacity,
    rightScale,
    selectedWinnerId,
  ]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: entranceOpacity,
          transform: [{ translateY: entranceY }],
        },
      ]}
      testID="showdown-next-matchup"
    >
      <Text style={styles.heading}>Which one wins?</Text>

      <View style={styles.optionsRow}>
        <Animated.View style={{ flex: 1, opacity: leftOpacity, transform: [{ scale: leftScale }] }}>
          <VoteOption
            side="left"
            entry={matchup.entry_a}
            selectedWinnerId={selectedWinnerId}
            disabled={disabled}
            onVote={onVoteLeft}
          />
        </Animated.View>

        <View style={styles.vsWrap} pointerEvents="none">
          <Text style={styles.vsText}>VS</Text>
        </View>

        <Animated.View style={{ flex: 1, opacity: rightOpacity, transform: [{ scale: rightScale }] }}>
          <VoteOption
            side="right"
            entry={matchup.entry_b}
            selectedWinnerId={selectedWinnerId}
            disabled={disabled}
            onVote={onVoteRight}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 4,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    backgroundColor: RecordQuestTheme.colors.bgCard,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  heading: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 14,
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 10,
  },
  optionCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    backgroundColor: "rgba(16, 18, 26, 0.95)",
    padding: 10,
    minHeight: 220,
  },
  optionCardSelected: {
    borderColor: RecordQuestTheme.colors.borderStrong,
    backgroundColor: "rgba(139, 92, 246, 0.18)",
  },
  optionCardDimmed: {
    opacity: 0.72,
  },
  optionCardDisabled: {
    opacity: 0.9,
  },
  optionCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cover: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 10,
  },
  albumTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
    minHeight: 36,
  },
  artistName: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  caption: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 8,
  },
  vsWrap: {
    position: "absolute",
    left: "50%",
    top: "42%",
    transform: [{ translateX: -16 }],
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6, 7, 11, 0.86)",
    borderWidth: 1,
    borderColor: "rgba(246, 238, 220, 0.16)",
  },
  vsText: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
