import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RecordQuestTheme } from "../../constants/theme";

export type ShowdownCardPhase =
  | "upcoming"
  | "submissions"
  | "voting"
  | "results"
  | "unavailable";

type ShowdownCompetitionCardProps = {
  title: string;
  description?: string | null;
  phase: ShowdownCardPhase;
  phaseLabel: string;
  statusLine: string;
  timingLine?: string | null;
  nextLine?: string | null;
  ctaLabel: string;
  ctaDisabled?: boolean;
  onPressCta?: () => void;
  entryCount?: number | null;
  hasEntered?: boolean;
  enteredAlbumTitle?: string | null;
  enteredArtistName?: string | null;
};

function getPhasePillStyle(phase: ShowdownCardPhase) {
  if (phase === "submissions") {
    return {
      backgroundColor: "rgba(34, 197, 94, 0.14)",
      borderColor: "rgba(34, 197, 94, 0.35)",
      textColor: "#A7F3D0",
    };
  }

  if (phase === "voting") {
    return {
      backgroundColor: "rgba(139, 92, 246, 0.20)",
      borderColor: "rgba(139, 92, 246, 0.44)",
      textColor: "#DDD6FE",
    };
  }

  if (phase === "results") {
    return {
      backgroundColor: "rgba(245, 158, 11, 0.18)",
      borderColor: "rgba(245, 158, 11, 0.38)",
      textColor: "#FDE68A",
    };
  }

  if (phase === "unavailable") {
    return {
      backgroundColor: "rgba(156, 149, 178, 0.18)",
      borderColor: "rgba(156, 149, 178, 0.34)",
      textColor: "#D6D3E1",
    };
  }

  return {
    backgroundColor: "rgba(167, 139, 250, 0.16)",
    borderColor: "rgba(167, 139, 250, 0.35)",
    textColor: "#E9D5FF",
  };
}

function getCtaTestId(phase: ShowdownCardPhase): string | undefined {
  if (phase === "submissions") {
    return "showdown-entry-cta";
  }

  if (phase === "voting") {
    return "showdown-voting-cta";
  }

  if (phase === "results") {
    return "showdown-results-cta";
  }

  return undefined;
}

export function ShowdownCompetitionCard({
  title,
  description,
  phase,
  phaseLabel,
  statusLine,
  timingLine,
  nextLine,
  ctaLabel,
  ctaDisabled = false,
  onPressCta,
  entryCount,
  hasEntered = false,
  enteredAlbumTitle,
  enteredArtistName,
}: ShowdownCompetitionCardProps) {
  const phasePill = getPhasePillStyle(phase);
  const ctaTestId = getCtaTestId(phase);
  const isCtaDisabled = ctaDisabled || typeof onPressCta !== "function";
  const hasEntryCount = typeof entryCount === "number" && entryCount > 0;
  const hasEntryPreview =
    hasEntered &&
    typeof enteredAlbumTitle === "string" &&
    enteredAlbumTitle.trim().length > 0 &&
    typeof enteredArtistName === "string" &&
    enteredArtistName.trim().length > 0;

  return (
    <View style={styles.card} testID="showdown-competition-card">
      <View style={styles.topRow}>
        <View
          style={[
            styles.phasePill,
            {
              backgroundColor: phasePill.backgroundColor,
              borderColor: phasePill.borderColor,
            },
          ]}
        >
          <Text style={[styles.phasePillText, { color: phasePill.textColor }]}>{phaseLabel}</Text>
        </View>

        {hasEntered ? (
          <View style={styles.enteredPill}>
            <Text style={styles.enteredPillText}>You&apos;re entered</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title}>{title}</Text>

      {description ? (
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
      ) : null}

      <Text style={styles.statusLine}>{statusLine}</Text>

      {timingLine ? <Text style={styles.timingLine}>{timingLine}</Text> : null}
      {nextLine ? <Text style={styles.nextLine}>{nextLine}</Text> : null}

      {hasEntryCount ? <Text style={styles.entryCount}>{`${entryCount} collectors in this round`}</Text> : null}

      {hasEntryPreview ? (
        <View style={styles.entryPreviewCard}>
          <Text style={styles.entryPreviewLabel}>Your pick</Text>
          <Text style={styles.entryPreviewTitle} numberOfLines={1}>
            {enteredAlbumTitle}
          </Text>
          <Text style={styles.entryPreviewSubtitle} numberOfLines={1}>
            {enteredArtistName}
          </Text>
        </View>
      ) : null}

      <Pressable
        testID={ctaTestId}
        style={({ pressed }) => [
          styles.ctaButton,
          isCtaDisabled ? styles.ctaButtonDisabled : null,
          pressed && !isCtaDisabled ? styles.ctaPressed : null,
        ]}
        onPress={onPressCta}
        disabled={isCtaDisabled}
        accessibilityRole="button"
      >
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: RecordQuestTheme.colors.bgCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  phasePill: {
    borderWidth: 1,
    borderRadius: RecordQuestTheme.radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  phasePillText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  enteredPill: {
    borderRadius: RecordQuestTheme.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(246, 238, 220, 0.24)",
    backgroundColor: "rgba(246, 238, 220, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  enteredPillText: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  title: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
    marginBottom: 8,
  },
  description: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  statusLine: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  timingLine: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  nextLine: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  entryCount: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 12,
    marginBottom: 2,
    fontWeight: "600",
  },
  entryPreviewCard: {
    marginTop: 14,
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.34)",
    backgroundColor: "rgba(139, 92, 246, 0.10)",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  entryPreviewLabel: {
    color: "#D8C4FF",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  entryPreviewTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  entryPreviewSubtitle: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  ctaButton: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: RecordQuestTheme.colors.accent,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaButtonDisabled: {
    backgroundColor: "rgba(139, 92, 246, 0.28)",
    borderColor: "rgba(139, 92, 246, 0.28)",
    opacity: 0.72,
  },
  ctaPressed: {
    transform: [{ scale: 0.99 }],
  },
  ctaText: {
    color: "#FFF4D6",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
