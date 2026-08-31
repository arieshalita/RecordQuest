import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AlbumArt } from "../AlbumArt";
import { RecordQuestTheme } from "../../constants/theme";
import { getUserCompetitionAwards } from "../../hooks/showdown-service";
import type { ShowdownServiceError, ShowdownTrophyRow } from "../../hooks/showdown-types";

type ProfileTrophySectionProps = {
  userId: string | null;
  isOwnProfile: boolean;
};

function toTrophyErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "userMessage" in error) {
    const serviceError = error as ShowdownServiceError;
    if (typeof serviceError.userMessage === "string" && serviceError.userMessage.trim()) {
      return serviceError.userMessage;
    }
  }

  return "Could not load Showdown trophies right now.";
}

function formatTrophyDate(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return "Date unavailable";
  }

  return new Date(parsed).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function toPlacementLabel(placement: number | null): string {
  if (placement === 1) {
    return "Winner";
  }

  if (typeof placement !== "number" || placement <= 0) {
    return "Showdown award";
  }

  return `Placed #${placement}`;
}

export function ProfileTrophySection({ userId, isOwnProfile }: ProfileTrophySectionProps) {
  const [trophies, setTrophies] = useState<ShowdownTrophyRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(userId);

  useEffect(() => {
    activeUserIdRef.current = userId;
  }, [userId]);

  const loadTrophies = useCallback(async () => {
    const targetUserId = userId?.trim() ?? "";

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!targetUserId) {
      setTrophies([]);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const rows = await getUserCompetitionAwards(targetUserId);

      if (requestId !== requestIdRef.current || targetUserId !== (activeUserIdRef.current ?? "")) {
        return;
      }

      setTrophies(rows);
    } catch (error) {
      if (requestId !== requestIdRef.current || targetUserId !== (activeUserIdRef.current ?? "")) {
        return;
      }

      setTrophies([]);
      setErrorMessage(toTrophyErrorMessage(error));
    } finally {
      if (requestId === requestIdRef.current && targetUserId === (activeUserIdRef.current ?? "")) {
        setIsLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    void loadTrophies();
  }, [loadTrophies]);

  const hasTrophies = trophies.length > 0;
  const visibleTrophies = useMemo(() => trophies.slice(0, 10), [trophies]);

  if (!userId) {
    return null;
  }

  if (!isOwnProfile && !isLoading && !errorMessage && !hasTrophies) {
    return null;
  }

  return (
    <View style={styles.sectionWrap} testID="showdown-trophy-section">
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Showdown Trophies</Text>
        {hasTrophies ? <Text style={styles.sectionCount}>{trophies.length}</Text> : null}
      </View>

      {isLoading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="small" color={RecordQuestTheme.colors.accent} />
          <Text style={styles.stateText}>Loading trophies...</Text>
        </View>
      ) : null}

      {!isLoading && errorMessage ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>{errorMessage}</Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed ? styles.retryButtonPressed : null]}
            onPress={() => {
              void loadTrophies();
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading Showdown trophies"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !errorMessage && !hasTrophies && isOwnProfile ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>Win a Showdown to add trophies here.</Text>
        </View>
      ) : null}

      {!isLoading && !errorMessage && hasTrophies ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {visibleTrophies.map((trophy) => (
            <View
              key={trophy.award_id}
              testID={`showdown-trophy-card-${trophy.award_id}`}
              style={styles.card}
              accessible
              accessibilityLabel={`Showdown trophy. ${trophy.competition_title}. ${toPlacementLabel(trophy.placement)} with ${trophy.album_title} by ${trophy.artist_name}.`}
            >
              <AlbumArt
                uri={trophy.cover_url}
                style={styles.cover}
                debugScreen="other"
                debugAlbum={trophy.album_title}
                debugArtist={trophy.artist_name}
                debugUriSource="supabase"
              />
              <Text style={styles.cardKicker} numberOfLines={1}>
                {toPlacementLabel(trophy.placement)}
              </Text>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {trophy.competition_title}
              </Text>
              <Text style={styles.cardAlbum} numberOfLines={2}>
                {trophy.album_title}
              </Text>
              <Text style={styles.cardArtist} numberOfLines={1}>
                {trophy.artist_name}
              </Text>
              <Text style={styles.cardDate} numberOfLines={1}>
                {formatTrophyDate(trophy.awarded_at)}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionWrap: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 19,
    fontWeight: "900",
  },
  sectionCount: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    borderRadius: RecordQuestTheme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: RecordQuestTheme.colors.bgCard,
  },
  stateCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    backgroundColor: RecordQuestTheme.colors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  stateText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 10,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: RecordQuestTheme.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.46)",
    backgroundColor: "rgba(139, 92, 246, 0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonPressed: {
    opacity: 0.9,
  },
  retryButtonText: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  row: {
    paddingRight: 8,
    gap: 10,
  },
  card: {
    width: 190,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.36)",
    backgroundColor: "rgba(17, 19, 26, 0.95)",
    padding: 11,
  },
  cover: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 11,
    marginBottom: 10,
  },
  cardKicker: {
    color: "#FDE68A",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 4,
  },
  cardTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
    marginBottom: 6,
  },
  cardAlbum: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
  },
  cardArtist: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  cardDate: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 8,
  },
});
