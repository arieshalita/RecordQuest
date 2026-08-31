import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TopBar } from "../components/TopBar";
import { RecordQuestTheme } from "../constants/theme";
import {
  getCompetitionOverview,
  getCompetitionResults,
  getMyCompetitionEntry,
  getNextCompetitionMatchup,
  submitCompetitionVote,
  submitCompetitionEntry,
} from "../hooks/showdown-service";
import type { RecordItem } from "../hooks/types";
import type {
  ShowdownMatchup,
  ShowdownMyEntry,
  ShowdownOverview,
  ShowdownResultRow,
  ShowdownServiceError,
} from "../hooks/showdown-types";
import {
  ShowdownCompetitionCard,
  type ShowdownCardPhase,
} from "../components/showdown/ShowdownCompetitionCard";
import { ShowdownMatchupCard } from "../components/showdown/ShowdownMatchupCard";
import { ShowdownRecordPickerModal } from "../components/showdown/ShowdownRecordPickerModal";
import { ShowdownResultsList } from "../components/showdown/ShowdownResultsList";

type ShowdownScreenProps = {
  competitionId: string;
  records: RecordItem[];
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

function toLoadErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "userMessage" in error) {
    const serviceError = error as ShowdownServiceError;
    if (typeof serviceError.userMessage === "string" && serviceError.userMessage.trim()) {
      return serviceError.userMessage;
    }
  }

  return "Showdown is unavailable right now.";
}

function toSubmissionErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "userMessage" in error) {
    const serviceError = error as ShowdownServiceError;
    if (typeof serviceError.userMessage === "string" && serviceError.userMessage.trim()) {
      return serviceError.userMessage;
    }
  }

  return "Could not complete that action right now. Please try again.";
}

export function ShowdownScreen({ competitionId, records, onBack }: ShowdownScreenProps) {
  const [overview, setOverview] = useState<ShowdownOverview | null>(null);
  const [myEntry, setMyEntry] = useState<ShowdownMyEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRecordPickerOpen, setIsRecordPickerOpen] = useState(false);
  const [isSubmittingEntry, setIsSubmittingEntry] = useState(false);
  const [submissionErrorMessage, setSubmissionErrorMessage] = useState<string | null>(null);
  const [isVotingMode, setIsVotingMode] = useState(false);
  const [matchup, setMatchup] = useState<ShowdownMatchup | null>(null);
  const [hasLoadedFirstMatchup, setHasLoadedFirstMatchup] = useState(false);
  const [isMatchupLoading, setIsMatchupLoading] = useState(false);
  const [isVoteSubmitting, setIsVoteSubmitting] = useState(false);
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);
  const [votingErrorMessage, setVotingErrorMessage] = useState<string | null>(null);
  const [isResultsMode, setIsResultsMode] = useState(false);
  const [results, setResults] = useState<ShowdownResultRow[]>([]);
  const [isResultsLoading, setIsResultsLoading] = useState(false);
  const [resultsErrorMessage, setResultsErrorMessage] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState(0);
  const requestIdRef = useRef(0);
  const matchupRequestIdRef = useRef(0);
  const resultsRequestIdRef = useRef(0);
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
        setErrorMessage(toLoadErrorMessage(error));
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

  const hasEntered = myEntry !== null || overview?.caller_has_entered === true;

  const canEnterSubmissionFlow = viewModel?.phase === "submissions" && !hasEntered;
  const canEnterVotingFlow = viewModel?.phase === "voting";
  const canEnterResultsFlow = viewModel?.phase === "results";

  async function handleSubmitRecord(record: RecordItem) {
    if (isSubmittingEntry || !trimmedCompetitionId || hasEntered) {
      return;
    }

    setIsSubmittingEntry(true);
    setSubmissionErrorMessage(null);

    try {
      const createdEntry = await submitCompetitionEntry(trimmedCompetitionId, record.id, null);

      setMyEntry(createdEntry);
      setOverview((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          caller_has_entered: true,
          total_active_entries: current.caller_has_entered
            ? current.total_active_entries
            : current.total_active_entries + 1,
        };
      });

      setIsRecordPickerOpen(false);

      void loadShowdown(true);
    } catch (error) {
      setSubmissionErrorMessage(toSubmissionErrorMessage(error));
    } finally {
      setIsSubmittingEntry(false);
    }
  }

  async function loadNextMatchup(): Promise<void> {
    if (!trimmedCompetitionId) {
      setVotingErrorMessage("Voting is not available right now.");
      setIsMatchupLoading(false);
      return;
    }

    const requestId = matchupRequestIdRef.current + 1;
    matchupRequestIdRef.current = requestId;
    setIsMatchupLoading(true);
    setVotingErrorMessage(null);

    try {
      const nextMatchup = await getNextCompetitionMatchup(trimmedCompetitionId);

      if (requestId !== matchupRequestIdRef.current) {
        return;
      }

      setMatchup(nextMatchup);
      setHasLoadedFirstMatchup(true);
    } catch (error) {
      if (requestId !== matchupRequestIdRef.current) {
        return;
      }

      setVotingErrorMessage(toSubmissionErrorMessage(error));
      setHasLoadedFirstMatchup(true);
    } finally {
      if (requestId === matchupRequestIdRef.current) {
        setIsMatchupLoading(false);
      }
    }
  }

  async function loadResults(): Promise<void> {
    if (!trimmedCompetitionId) {
      setResultsErrorMessage("Results are unavailable right now.");
      setIsResultsLoading(false);
      return;
    }

    const requestId = resultsRequestIdRef.current + 1;
    resultsRequestIdRef.current = requestId;
    setIsResultsLoading(true);
    setResultsErrorMessage(null);

    try {
      const nextResults = await getCompetitionResults(trimmedCompetitionId);

      if (requestId !== resultsRequestIdRef.current) {
        return;
      }

      setResults(nextResults);
    } catch (error) {
      if (requestId !== resultsRequestIdRef.current) {
        return;
      }

      setResults([]);
      setResultsErrorMessage(toSubmissionErrorMessage(error));
    } finally {
      if (requestId === resultsRequestIdRef.current) {
        setIsResultsLoading(false);
      }
    }
  }

  async function handleVote(winnerEntryId: string): Promise<void> {
    if (!matchup || !trimmedCompetitionId || isVoteSubmitting) {
      return;
    }

    const activeMatchup = matchup;
    setSelectedWinnerId(winnerEntryId);
    setIsVoteSubmitting(true);
    setVotingErrorMessage(null);

    try {
      await submitCompetitionVote(
        trimmedCompetitionId,
        activeMatchup.entry_a.id,
        activeMatchup.entry_b.id,
        winnerEntryId
      );

      setSelectedWinnerId(null);
      setMatchup(null);
      await loadNextMatchup();
    } catch (error) {
      setSelectedWinnerId(null);
      setVotingErrorMessage(toSubmissionErrorMessage(error));
    } finally {
      setIsVoteSubmitting(false);
    }
  }

  function enterVotingMode() {
    if (!canEnterVotingFlow) {
      return;
    }

    setIsRecordPickerOpen(false);
    setSubmissionErrorMessage(null);
    setIsVotingMode(true);
    setMatchup(null);
    setHasLoadedFirstMatchup(false);
    setSelectedWinnerId(null);
    setVotingErrorMessage(null);
    void loadNextMatchup();
  }

  function leaveVotingMode() {
    setIsVotingMode(false);
    setMatchup(null);
    setHasLoadedFirstMatchup(false);
    setIsMatchupLoading(false);
    setIsVoteSubmitting(false);
    setSelectedWinnerId(null);
    setVotingErrorMessage(null);
  }

  function enterResultsMode() {
    if (!canEnterResultsFlow) {
      return;
    }

    setIsRecordPickerOpen(false);
    setSubmissionErrorMessage(null);
    leaveVotingMode();
    setIsResultsMode(true);
    setResults([]);
    setResultsErrorMessage(null);
    void loadResults();
  }

  function leaveResultsMode() {
    setIsResultsMode(false);
    setIsResultsLoading(false);
    setResults([]);
    setResultsErrorMessage(null);
  }

  function handlePressCta() {
    if (!viewModel) {
      return;
    }

    if (viewModel.phase === "submissions") {
      if (!canEnterSubmissionFlow) {
        return;
      }

      setSubmissionErrorMessage(null);
      setIsRecordPickerOpen(true);
      return;
    }

    if (viewModel.phase === "voting") {
      enterVotingMode();
      return;
    }

    if (viewModel.phase === "results") {
      enterResultsMode();
    }
  }

  function closePicker() {
    if (isSubmittingEntry) {
      return;
    }

    setSubmissionErrorMessage(null);
    setIsRecordPickerOpen(false);
  }

  function noopAction() {
    // Intentionally empty during shell-only integration.
  }

  return (
    <ScrollView contentContainerStyle={styles.page} testID="showdown-screen">
      <TopBar title="Showdown" back={onBack ?? noopAction} />

      {!isVotingMode && !isResultsMode ? <Text style={styles.kicker}>Weekly Challenge</Text> : null}

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

      {!isLoading && !errorMessage && overview && viewModel && !isVotingMode && !isResultsMode ? (
        <ShowdownCompetitionCard
          title={overview.title}
          description={cleanDescription(overview.description)}
          phase={viewModel.phase}
          phaseLabel={viewModel.phaseLabel}
          statusLine={viewModel.statusLine}
          timingLine={viewModel.timingLine}
          nextLine={viewModel.nextLine}
          ctaLabel={viewModel.ctaLabel}
          ctaDisabled={
            viewModel.ctaDisabled ||
            (viewModel.phase === "submissions"
              ? !canEnterSubmissionFlow
              : viewModel.phase === "voting"
                ? !canEnterVotingFlow
                : viewModel.phase === "results"
                  ? !canEnterResultsFlow
                  : true)
          }
          onPressCta={handlePressCta}
          entryCount={viewModel.showEntryCount ? overview.total_active_entries : null}
          hasEntered={hasEntered}
          enteredAlbumTitle={myEntry?.album_title ?? null}
          enteredArtistName={myEntry?.artist_name ?? null}
        />
      ) : null}

      {!isLoading && !errorMessage && overview && viewModel && isVotingMode ? (
        <View testID="showdown-voting-view">
          <View style={styles.votingHeaderCard}>
            <Text style={styles.votingTitle}>Showdown Voting</Text>
            <Text style={styles.votingSubtitle}>Tap the better cover. We&apos;ll bring up the next matchup automatically.</Text>
          </View>

          {isMatchupLoading && !matchup ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size="small" color={RecordQuestTheme.colors.accent} />
              <Text style={styles.stateTitle}>Loading matchup...</Text>
              <Text style={styles.stateText}>Finding your next pair.</Text>
            </View>
          ) : null}

          {!isMatchupLoading && votingErrorMessage && !matchup ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Couldn&apos;t load matchup</Text>
              <Text style={styles.stateText}>{votingErrorMessage}</Text>
              <Pressable
                style={({ pressed }) => [styles.retryButton, pressed ? styles.retryButtonPressed : null]}
                onPress={() => {
                  void loadNextMatchup();
                }}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          {matchup ? (
            <>
              <ShowdownMatchupCard
                matchup={matchup}
                transitionKey={`${matchup.entry_a.id}:${matchup.entry_b.id}`}
                selectedWinnerId={selectedWinnerId}
                disabled={isVoteSubmitting}
                onVoteLeft={() => {
                  void handleVote(matchup.entry_a.id);
                }}
                onVoteRight={() => {
                  void handleVote(matchup.entry_b.id);
                }}
              />

              {isVoteSubmitting ? <Text style={styles.voteStatusText}>Submitting vote...</Text> : null}
              {votingErrorMessage ? <Text style={styles.voteErrorText}>{votingErrorMessage}</Text> : null}
            </>
          ) : null}

          {!isMatchupLoading && !votingErrorMessage && !matchup && hasLoadedFirstMatchup ? (
            <View style={styles.stateCard} testID="showdown-empty-voting-state">
              <Text style={styles.stateTitle}>You&apos;re all caught up</Text>
              <Text style={styles.stateText}>You&apos;ve voted on every matchup available to you right now.</Text>
              <Text style={styles.stateText}>Check back later as more records enter.</Text>
              <Pressable
                style={({ pressed }) => [styles.retryButton, pressed ? styles.retryButtonPressed : null]}
                onPress={leaveVotingMode}
              >
                <Text style={styles.retryButtonText}>Back to Showdown</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {!isLoading && !errorMessage && overview && viewModel && isResultsMode ? (
        <View testID="showdown-results-view">
          <View style={styles.votingHeaderCard}>
            <Text style={styles.votingTitle}>Results</Text>
            <Text style={styles.votingSubtitle}>Final placements are locked in.</Text>
          </View>

          {isResultsLoading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size="small" color={RecordQuestTheme.colors.accent} />
              <Text style={styles.stateTitle}>Loading results...</Text>
              <Text style={styles.stateText}>Revealing this round&apos;s standings.</Text>
            </View>
          ) : null}

          {!isResultsLoading && resultsErrorMessage ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Couldn&apos;t load results</Text>
              <Text style={styles.stateText}>{resultsErrorMessage}</Text>
              <View style={styles.stateButtonRow}>
                <Pressable
                  style={({ pressed }) => [styles.retryButton, pressed ? styles.retryButtonPressed : null]}
                  onPress={() => {
                    void loadResults();
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.retryButton, pressed ? styles.retryButtonPressed : null]}
                  onPress={leaveResultsMode}
                >
                  <Text style={styles.retryButtonText}>Back to Showdown</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {!isResultsLoading && !resultsErrorMessage && results.length === 0 ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Results aren&apos;t ready yet</Text>
              <Text style={styles.stateText}>Check back shortly for final placements.</Text>
              <View style={styles.stateButtonRow}>
                <Pressable
                  style={({ pressed }) => [styles.retryButton, pressed ? styles.retryButtonPressed : null]}
                  onPress={() => {
                    void loadResults();
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.retryButton, pressed ? styles.retryButtonPressed : null]}
                  onPress={leaveResultsMode}
                >
                  <Text style={styles.retryButtonText}>Back to Showdown</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {!isResultsLoading && !resultsErrorMessage && results.length > 0 ? (
            <ShowdownResultsList
              results={results}
              myEntryId={myEntry?.id ?? null}
              minimumEntriesForAward={overview.minimum_entries_for_award}
              totalActiveEntries={overview.total_active_entries}
              transitionKey={results.map((row) => row.entry_id).join("|")}
              onBackToShowdown={leaveResultsMode}
            />
          ) : null}
        </View>
      ) : null}

      <ShowdownRecordPickerModal
        visible={isRecordPickerOpen && !isVotingMode && !isResultsMode}
        records={records}
        isSubmitting={isSubmittingEntry}
        errorMessage={submissionErrorMessage}
        onClose={closePicker}
        onSubmit={(selectedRecord) => {
          void handleSubmitRecord(selectedRecord);
        }}
      />
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
  votingHeaderCard: {
    marginTop: 2,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.32)",
    borderRadius: 18,
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  votingTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  votingSubtitle: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  voteStatusText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 2,
    fontWeight: "600",
  },
  voteErrorText: {
    color: "#FCA5A5",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 10,
  },
  stateButtonRow: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  retryButton: {
    flex: 1,
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
