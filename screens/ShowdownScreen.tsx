import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TopBar } from "../components/TopBar";
import { RecordQuestTheme } from "../constants/theme";
import {
  getCompetitionOverview,
  getMyCompetitionEntry,
} from "../hooks/showdown-service";
import type {
  ShowdownMyEntry,
  ShowdownOverview,
  ShowdownServiceError,
} from "../hooks/showdown-types";
import {
  ShowdownCompetitionCard,
  type ShowdownCardPhase,
} from "../components/showdown/ShowdownCompetitionCard";

type ShowdownScreenProps = {
  competitionId: string;
  onBack?: () => void;
};

type ShowdownViewModel = {
  phase: ShowdownCardPhase;
  phaseLabel: string;
  statusLine: string;
  timingLine: string | null;
  nextLine: string | null;
  ctaLabel: string;
  ctaDisabled: boolean;
  showEntryCount: boolean;
};

function readDateMs(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatRelativeWindow(targetMs: number, nowMs: number): string {
  const deltaMs = targetMs - nowMs;
  const absMs = Math.abs(deltaMs);
  const absHours = Math.ceil(absMs / (60 * 60 * 1000));
  const absDays = Math.floor(absHours / 24);

  const amount =
    absDays >= 2
      ? `${absDays} days`
      : absDays === 1
        ? "1 day"
        : absHours >= 2
          ? `${absHours} hours`
          : "under an hour";

  if (deltaMs > 0) {
    return amount;
  }

  return `${amount} ago`;
}

function toUiPhase(overview: ShowdownOverview, nowMs: number): ShowdownCardPhase {
  if (overview.is_cancelled) {
    return "unavailable";
  }

  const submissionStartsAtMs = readDateMs(overview.submission_starts_at);
  const submissionEndsAtMs = readDateMs(overview.submission_ends_at);
  const votingStartsAtMs = readDateMs(overview.voting_starts_at);
  const votingEndsAtMs = readDateMs(overview.voting_ends_at);
  const resultsAtMs = readDateMs(overview.results_at);

  if (
    submissionStartsAtMs === null ||
    submissionEndsAtMs === null ||
    votingStartsAtMs === null ||
    votingEndsAtMs === null ||
    resultsAtMs === null
  ) {
    return "unavailable";
  }

  if (nowMs < submissionStartsAtMs) {
    return "upcoming";
  }

  if (nowMs < submissionEndsAtMs) {
    return "submissions";
  }

  if (nowMs >= votingStartsAtMs && nowMs < votingEndsAtMs) {
    return "voting";
  }

  if (nowMs >= resultsAtMs) {
    return "results";
  }

  return "upcoming";
}

function cleanDescription(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= 120) {
    return trimmed;
  }

  return `${trimmed.slice(0, 117).trimEnd()}...`;
}

function buildShowdownViewModel(
  overview: ShowdownOverview,
  myEntry: ShowdownMyEntry | null,
  nowMs: number
): ShowdownViewModel {
  const phase = toUiPhase(overview, nowMs);
  const hasEntered = myEntry !== null || overview.caller_has_entered;

  const submissionStartsAtMs = readDateMs(overview.submission_starts_at);
  const submissionEndsAtMs = readDateMs(overview.submission_ends_at);
  const votingStartsAtMs = readDateMs(overview.voting_starts_at);
  const votingEndsAtMs = readDateMs(overview.voting_ends_at);
  const resultsAtMs = readDateMs(overview.results_at);

  if (phase === "unavailable") {
    if (overview.is_cancelled) {
      return {
        phase,
        phaseLabel: "Cancelled",
        statusLine: "This Showdown was cancelled.",
        timingLine: null,
        nextLine: "A new round will appear soon.",
        ctaLabel: "Unavailable",
        ctaDisabled: true,
        showEntryCount: false,
      };
    }

    return {
      phase,
      phaseLabel: "Unavailable",
      statusLine: "This Showdown is unavailable right now.",
      timingLine: null,
      nextLine: "Please check back shortly.",
      ctaLabel: "Unavailable",
      ctaDisabled: true,
      showEntryCount: false,
    };
  }

  if (phase === "upcoming") {
    const waitingForVoting =
      submissionEndsAtMs !== null && votingStartsAtMs !== null && nowMs >= submissionEndsAtMs && nowMs < votingStartsAtMs;
    const waitingForResults =
      votingEndsAtMs !== null && resultsAtMs !== null && nowMs >= votingEndsAtMs && nowMs < resultsAtMs;

    const timingLine = waitingForVoting
      ? votingStartsAtMs !== null
        ? `Voting starts in ${formatRelativeWindow(votingStartsAtMs, nowMs)}`
        : "Voting starts soon"
      : waitingForResults
        ? resultsAtMs !== null
          ? `Results available in ${formatRelativeWindow(resultsAtMs, nowMs)}`
          : "Results available soon"
        : submissionStartsAtMs !== null
          ? `Entries open in ${formatRelativeWindow(submissionStartsAtMs, nowMs)}`
          : "Entries open soon";

    return {
      phase,
      phaseLabel: "Coming soon",
      statusLine: waitingForVoting
        ? "Entries are closed for now."
        : waitingForResults
          ? "Voting has wrapped up."
          : "A new round is almost here.",
      timingLine,
      nextLine: waitingForVoting
        ? "Next: vote on head-to-head matchups."
        : waitingForResults
          ? "Next: final placements reveal."
          : "Next: enter one record.",
      ctaLabel: "Coming Soon",
      ctaDisabled: true,
      showEntryCount: false,
    };
  }

  if (phase === "submissions") {
    const timingLine =
      submissionEndsAtMs !== null
        ? `Entries close in ${formatRelativeWindow(submissionEndsAtMs, nowMs)}`
        : "Entries are open now";

    return {
      phase,
      phaseLabel: "Entries open",
      statusLine: hasEntered ? "You're entered." : "Pick one record and join this round.",
      timingLine,
      nextLine: hasEntered ? "Next: voting opens after entries close." : "Next: voting opens after entries close.",
      ctaLabel: hasEntered ? "You're Entered" : "Enter a Record",
      ctaDisabled: hasEntered,
      showEntryCount: true,
    };
  }

  if (phase === "voting") {
    const timingLine =
      votingEndsAtMs !== null
        ? `Voting ends in ${formatRelativeWindow(votingEndsAtMs, nowMs)}`
        : "Voting is live now";

    return {
      phase,
      phaseLabel: "Voting live",
      statusLine: "Help decide this week's winner.",
      timingLine,
      nextLine: "Next: final results reveal.",
      ctaLabel: "Start Voting",
      ctaDisabled: false,
      showEntryCount: true,
    };
  }

  const timingLine =
    resultsAtMs !== null
      ? `Results opened ${formatRelativeWindow(resultsAtMs, nowMs)}`
      : "Results are available now";

  return {
    phase,
    phaseLabel: "Results live",
    statusLine: "The round is complete.",
    timingLine,
    nextLine: "See where each entry landed.",
    ctaLabel: "View Results",
    ctaDisabled: false,
    showEntryCount: true,
  };
}

function toErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "userMessage" in error) {
    const serviceError = error as ShowdownServiceError;
    if (typeof serviceError.userMessage === "string" && serviceError.userMessage.trim()) {
      return serviceError.userMessage;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Showdown is unavailable right now.";
}

export function ShowdownScreen({ competitionId, onBack }: ShowdownScreenProps) {
  const [overview, setOverview] = useState<ShowdownOverview | null>(null);
  const [myEntry, setMyEntry] = useState<ShowdownMyEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState(0);
  const requestIdRef = useRef(0);
  const trimmedCompetitionId = competitionId.trim();

  const loadShowdown = useCallback(
    async (refresh = false) => {
      if (!trimmedCompetitionId) {
        setOverview(null);
        setMyEntry(null);
        setErrorMessage("Showdown is unavailable right now.");
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      try {
        const [nextOverview, nextMyEntry] = await Promise.all([
          getCompetitionOverview(trimmedCompetitionId),
          getMyCompetitionEntry(trimmedCompetitionId),
        ]);

        if (requestId !== requestIdRef.current) {
          return;
        }

        setOverview(nextOverview);
        setMyEntry(nextMyEntry);
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setOverview(null);
        setMyEntry(null);
        setErrorMessage(toErrorMessage(error));
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [trimmedCompetitionId]
  );

  useEffect(() => {
    void loadShowdown(false);
  }, [loadShowdown]);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockTick((value) => value + 1);
    }, 60000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const viewModel = useMemo(() => {
    if (!overview) {
      return null;
    }

    return buildShowdownViewModel(overview, myEntry, Date.now());
  }, [overview, myEntry, clockTick]);

  function noopAction() {
    // Intentionally empty during shell-only integration.
  }

  return (
    <ScrollView contentContainerStyle={styles.page} testID="showdown-screen">
      <TopBar title="Showdown" back={onBack ?? noopAction} />

      <Text style={styles.kicker}>Weekly Challenge</Text>

      {isLoading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="small" color={RecordQuestTheme.colors.accent} />
          <Text style={styles.stateTitle}>Loading this week&apos;s Showdown...</Text>
          <Text style={styles.stateText}>Getting the latest round details.</Text>
        </View>
      ) : null}

      {!isLoading && errorMessage ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Couldn&apos;t load Showdown</Text>
          <Text style={styles.stateText}>{errorMessage}</Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed ? styles.retryButtonPressed : null]}
            onPress={() => {
              void loadShowdown(true);
            }}
          >
            <Text style={styles.retryButtonText}>{isRefreshing ? "Refreshing..." : "Retry"}</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !errorMessage && overview && viewModel ? (
        <ShowdownCompetitionCard
          title={overview.title}
          description={cleanDescription(overview.description)}
          phase={viewModel.phase}
          phaseLabel={viewModel.phaseLabel}
          statusLine={viewModel.statusLine}
          timingLine={viewModel.timingLine}
          nextLine={viewModel.nextLine}
          ctaLabel={viewModel.ctaLabel}
          ctaDisabled={viewModel.ctaDisabled}
          onPressCta={noopAction}
          entryCount={viewModel.showEntryCount ? overview.total_active_entries : null}
          hasEntered={myEntry !== null || overview.caller_has_entered}
          enteredAlbumTitle={myEntry?.album_title ?? null}
          enteredArtistName={myEntry?.artist_name ?? null}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: RecordQuestTheme.colors.bg,
    paddingHorizontal: RecordQuestTheme.spacing.pageHorizontal,
    paddingTop: RecordQuestTheme.spacing.pageVertical,
    paddingBottom: 160,
  },
  kicker: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 12,
    paddingLeft: 2,
  },
  stateCard: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    borderRadius: 20,
    backgroundColor: RecordQuestTheme.colors.bgCard,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
    gap: 10,
  },
  stateTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  stateText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 6,
    minHeight: 40,
    paddingHorizontal: 16,
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
    fontSize: 13,
    fontWeight: "800",
  },
});
