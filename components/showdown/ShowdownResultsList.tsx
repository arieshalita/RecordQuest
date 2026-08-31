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
import type { ShowdownResultRow } from "../../hooks/showdown-types";
import { AlbumArt } from "../AlbumArt";

type ShowdownResultsListProps = {
  results: ShowdownResultRow[];
  myEntryId?: string | null;
  minimumEntriesForAward?: number;
  totalActiveEntries?: number;
  onBackToShowdown: () => void;
  transitionKey?: string;
};

function isMyEntry(row: ShowdownResultRow, myEntryId?: string | null): boolean {
  if (!myEntryId) {
    return false;
  }

  return row.entry_id === myEntryId;
}

function toPlacementLabel(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${value}st`;
  }

  if (mod10 === 2 && mod100 !== 12) {
    return `${value}nd`;
  }

  if (mod10 === 3 && mod100 !== 13) {
    return `${value}rd`;
  }

  return `${value}th`;
}

export function ShowdownResultsList({
  results,
  myEntryId,
  minimumEntriesForAward,
  totalActiveEntries,
  onBackToShowdown,
  transitionKey,
}: ShowdownResultsListProps) {
  const winner = results[0];
  const remaining = results.slice(1);

  if (!winner) {
    return (
      <View testID="showdown-results-list">
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Results not available yet</Text>
          <Text style={styles.emptyText}>Try again shortly.</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}
          onPress={onBackToShowdown}
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>Back to Showdown</Text>
        </Pressable>
      </View>
    );
  }

  const [reduceMotionEnabled, setReduceMotionEnabled] = React.useState(false);
  const winnerOpacity = React.useRef(new Animated.Value(1)).current;
  const winnerScale = React.useRef(new Animated.Value(1)).current;
  const listOpacity = React.useRef(new Animated.Value(1)).current;
  const listTranslateY = React.useRef(new Animated.Value(0)).current;

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
      winnerOpacity.setValue(1);
      winnerScale.setValue(1);
      listOpacity.setValue(1);
      listTranslateY.setValue(0);
      return;
    }

    winnerOpacity.setValue(0.01);
    winnerScale.setValue(0.97);
    listOpacity.setValue(0.01);
    listTranslateY.setValue(6);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(winnerOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(winnerScale, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(listOpacity, {
          toValue: 1,
          duration: 210,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(listTranslateY, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [
    listOpacity,
    listTranslateY,
    reduceMotionEnabled,
    transitionKey,
    winnerOpacity,
    winnerScale,
  ]);

  const hasOfficialWinner =
    typeof minimumEntriesForAward === "number" &&
    minimumEntriesForAward > 0 &&
    typeof totalActiveEntries === "number" &&
    totalActiveEntries >= minimumEntriesForAward;

  const winnerIsMine = isMyEntry(winner, myEntryId);

  return (
    <View testID="showdown-results-list">
      <Animated.View
        testID="showdown-winner-card"
        style={[
          styles.winnerCard,
          {
            opacity: winnerOpacity,
            transform: [{ scale: winnerScale }],
          },
        ]}
        accessible
        accessibilityLabel={`${hasOfficialWinner ? "Winner" : "First place"}: ${winner.album_title} by ${winner.artist_name}${winnerIsMine ? ". Your entry." : ""}`}
      >
        <Text style={styles.winnerKicker}>Results are in</Text>

        <AlbumArt
          uri={winner.cover_url}
          style={styles.winnerCover}
          debugScreen="other"
          debugAlbum={winner.album_title}
          debugArtist={winner.artist_name}
          debugUriSource="supabase"
        />

        <Text style={styles.winnerPlacement}>
          {hasOfficialWinner ? "#1 Winner" : "#1 First Place"}
        </Text>

        <Text style={styles.winnerAlbum} numberOfLines={2}>
          {winner.album_title}
        </Text>
        <Text style={styles.winnerArtist} numberOfLines={1}>
          {winner.artist_name}
        </Text>

        {winnerIsMine ? (
          <View style={styles.minePill}>
            <Text style={styles.minePillText}>{hasOfficialWinner ? "You won" : "Your entry"}</Text>
          </View>
        ) : null}

        {!hasOfficialWinner ? (
          <Text style={styles.noteText}>
            Top placement is shown. Official winner trophy requires minimum entries.
          </Text>
        ) : null}
      </Animated.View>

      <Animated.View
        style={{
          opacity: listOpacity,
          transform: [{ translateY: listTranslateY }],
        }}
      >
        {remaining.map((row) => {
          const mine = isMyEntry(row, myEntryId);

          return (
            <View
              key={row.entry_id}
              testID={`showdown-result-row-${row.entry_id}`}
              style={[styles.resultRow, mine ? styles.resultRowMine : null]}
              accessible
              accessibilityLabel={`${toPlacementLabel(row.placement)} place: ${row.album_title} by ${row.artist_name}${mine ? ". Your entry." : ""}`}
            >
              <Text style={styles.rowPlacement}>{row.placement}</Text>
              <AlbumArt
                uri={row.cover_url}
                style={styles.rowCover}
                debugScreen="other"
                debugAlbum={row.album_title}
                debugArtist={row.artist_name}
                debugUriSource="supabase"
              />
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowAlbum} numberOfLines={1}>
                  {row.album_title}
                </Text>
                <Text style={styles.rowArtist} numberOfLines={1}>
                  {row.artist_name}
                </Text>
              </View>

              {mine ? <Text style={styles.rowMineText}>Your entry</Text> : null}
            </View>
          );
        })}
      </Animated.View>

      <Pressable
        style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}
        onPress={onBackToShowdown}
        accessibilityRole="button"
      >
        <Text style={styles.backButtonText}>Back to Showdown</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  winnerCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(246, 238, 220, 0.28)",
    backgroundColor: "rgba(34, 26, 10, 0.30)",
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 14,
  },
  winnerKicker: {
    color: RecordQuestTheme.colors.textMuted,
    textTransform: "uppercase",
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: "800",
    marginBottom: 10,
  },
  winnerCover: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    marginBottom: 14,
  },
  winnerPlacement: {
    color: "#FDE68A",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },
  winnerAlbum: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 29,
    marginBottom: 3,
  },
  winnerArtist: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
  minePill: {
    alignSelf: "flex-start",
    marginTop: 12,
    borderRadius: RecordQuestTheme.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.45)",
    backgroundColor: "rgba(139, 92, 246, 0.20)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  minePillText: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  noteText: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 11,
  },
  resultRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    backgroundColor: RecordQuestTheme.colors.bgCard,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 9,
  },
  resultRowMine: {
    borderColor: "rgba(139, 92, 246, 0.52)",
    backgroundColor: "rgba(139, 92, 246, 0.11)",
  },
  rowPlacement: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 19,
    fontWeight: "900",
    width: 24,
    textAlign: "center",
  },
  rowCover: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowAlbum: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  rowArtist: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  rowMineText: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
    borderRadius: RecordQuestTheme.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.45)",
    backgroundColor: "rgba(139, 92, 246, 0.16)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backButton: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.50)",
    backgroundColor: "rgba(139, 92, 246, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  backButtonPressed: {
    opacity: 0.9,
  },
  backButtonText: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    backgroundColor: RecordQuestTheme.colors.bgCard,
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  emptyText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 13,
  },
});
