import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "./supabase-client";
import type {
  ShowdownMatchup,
  ShowdownMatchupEntry,
  ShowdownMyEntry,
  ShowdownOverview,
  ShowdownResultRow,
  ShowdownServiceError,
  ShowdownSubmitEntryResult,
  ShowdownTrophyRow,
  ShowdownVoteResult,
} from "./showdown-types";

type ShowdownOverviewRpcRow = {
  competition_id?: unknown;
  template_id?: unknown;
  title?: unknown;
  description?: unknown;
  entry_mode?: unknown;
  scoring_method?: unknown;
  submission_starts_at?: unknown;
  submission_ends_at?: unknown;
  voting_starts_at?: unknown;
  voting_ends_at?: unknown;
  results_at?: unknown;
  minimum_entries_for_award?: unknown;
  is_cancelled?: unknown;
  total_active_entries?: unknown;
  caller_has_entered?: unknown;
};

type ShowdownMyEntryRpcRow = {
  id?: unknown;
  competition_id?: unknown;
  source_record_id?: unknown;
  album_title?: unknown;
  artist_name?: unknown;
  cover_url?: unknown;
  release_year?: unknown;
  genre?: unknown;
  release_id_snapshot?: unknown;
  release_group_id_snapshot?: unknown;
  caption?: unknown;
  status?: unknown;
  submitted_at?: unknown;
};

type ShowdownSubmitEntryRpcRow = ShowdownMyEntryRpcRow & {
  user_id?: unknown;
  final_placement?: unknown;
};

type ShowdownMatchupRpcRow = {
  entry_a_id?: unknown;
  entry_a_album_title?: unknown;
  entry_a_artist_name?: unknown;
  entry_a_cover_url?: unknown;
  entry_a_release_year?: unknown;
  entry_a_genre?: unknown;
  entry_a_caption?: unknown;
  entry_b_id?: unknown;
  entry_b_album_title?: unknown;
  entry_b_artist_name?: unknown;
  entry_b_cover_url?: unknown;
  entry_b_release_year?: unknown;
  entry_b_genre?: unknown;
  entry_b_caption?: unknown;
};

type ShowdownVoteRpcRow = {
  vote_id?: unknown;
  competition_id?: unknown;
  winner_entry_id?: unknown;
};

type ShowdownResultRpcRow = {
  entry_id?: unknown;
  album_title?: unknown;
  artist_name?: unknown;
  cover_url?: unknown;
  release_year?: unknown;
  genre?: unknown;
  caption?: unknown;
  placement?: unknown;
  user_id?: unknown;
};

type ShowdownTrophyRpcRow = {
  award_id?: unknown;
  competition_id?: unknown;
  entry_id?: unknown;
  award_type?: unknown;
  placement?: unknown;
  awarded_at?: unknown;
  competition_title?: unknown;
  album_title?: unknown;
  artist_name?: unknown;
  cover_url?: unknown;
  release_year?: unknown;
  genre?: unknown;
};

type RpcErrorLike = {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  status?: unknown;
};

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readBoolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function readNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function readNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = readNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) {
    return (data[0] as T | undefined) ?? null;
  }

  if (data && typeof data === "object") {
    return data as T;
  }

  return null;
}

function rows<T>(data: unknown): T[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data as T[];
}

function operationFallbackMessage(operation: string): string {
  switch (operation) {
    case "get_current_competition":
      return "We couldn't load Showdown right now.";
    case "get_competition_overview":
      return "We couldn't load this Showdown right now.";
    case "get_my_competition_entry":
      return "We couldn't load your Showdown entry right now.";
    case "submit_competition_entry":
      return "Your Showdown entry could not be submitted.";
    case "get_next_competition_matchup":
      return "We couldn't load a matchup right now.";
    case "submit_competition_vote":
      return "Your vote could not be submitted.";
    case "get_competition_results":
      return "Showdown results are unavailable right now.";
    case "get_user_competition_awards":
      return "Showdown trophies are unavailable right now.";
    default:
      return "Showdown is unavailable right now.";
  }
}

function mapShowdownUserMessage(operation: string, rawMessage: string): string {
  const message = rawMessage.toLowerCase();

  if (message.includes("authentication required")) {
    return "Sign in to continue.";
  }

  if (message.includes("competition not found")) {
    return "This Showdown is no longer available.";
  }

  if (message.includes("competition is cancelled")) {
    return "This Showdown has been cancelled.";
  }

  if (message.includes("submission window has not started")) {
    return "Entry is not open yet.";
  }

  if (message.includes("submission window has ended")) {
    return "Entry has closed for this Showdown.";
  }

  if (message.includes("already entered")) {
    return "You've already entered this Showdown.";
  }

  if (message.includes("source record not found") || message.includes("not owned by caller")) {
    return "Select a record from your own collection.";
  }

  if (message.includes("caption") && message.includes("not allowed")) {
    return "Captions are not allowed for this Showdown.";
  }

  if (message.includes("caption") && message.includes("280")) {
    return "Caption must be 280 characters or fewer.";
  }

  if (message.includes("record year") || message.includes("record genre")) {
    return "This record does not match Showdown entry rules.";
  }

  if (message.includes("voting is not currently open")) {
    return "Voting is not open right now.";
  }

  if (message.includes("already finalized")) {
    return "Voting has ended for this Showdown.";
  }

  if (message.includes("cannot vote on your own entry")) {
    return "You can't vote on your own entry.";
  }

  if (message.includes("already voted on this matchup")) {
    return "You've already voted on this matchup.";
  }

  if (message.includes("entry ids must be distinct")) {
    return "This matchup is invalid.";
  }

  if (message.includes("winner entry id must match one of the matchup entries")) {
    return "Pick a winner from the current matchup.";
  }

  if (message.includes("entry a is invalid") || message.includes("entry b is invalid")) {
    return "This matchup is no longer valid.";
  }

  if (message.includes("results are not available yet")) {
    return "Results are not available yet.";
  }

  if (message.includes("results are not finalized yet")) {
    return "Results are still being finalized.";
  }

  if (message.includes("user id is required")) {
    return "A valid user is required to load trophies.";
  }

  return operationFallbackMessage(operation);
}

function toShowdownServiceError(operation: string, error: RpcErrorLike): ShowdownServiceError {
  const message = readString(error.message, "Unknown Supabase RPC error");
  const code = typeof error.code === "string" ? error.code : undefined;
  const details = typeof error.details === "string" ? error.details : null;
  const hint = typeof error.hint === "string" ? error.hint : null;
  const status = typeof error.status === "number" ? error.status : undefined;

  const debugParts = [
    `operation=${operation}`,
    `code=${code ?? "none"}`,
    `status=${status ?? "none"}`,
    `message=${message}`,
    `details=${details ?? "none"}`,
    `hint=${hint ?? "none"}`,
  ];

  const normalizedError = new Error(mapShowdownUserMessage(operation, message)) as ShowdownServiceError;
  normalizedError.name = "ShowdownServiceError";
  normalizedError.operation = operation;
  normalizedError.code = code;
  normalizedError.details = details;
  normalizedError.hint = hint;
  normalizedError.status = status;
  normalizedError.userMessage = normalizedError.message;
  normalizedError.debugMessage = debugParts.join("; ");

  return normalizedError;
}

function toUnexpectedServiceError(operation: string): ShowdownServiceError {
  const normalizedError = new Error(operationFallbackMessage(operation)) as ShowdownServiceError;
  normalizedError.name = "ShowdownServiceError";
  normalizedError.operation = operation;
  normalizedError.userMessage = normalizedError.message;
  normalizedError.debugMessage = `operation=${operation}; message=Unexpected RPC response shape`;
  return normalizedError;
}

function mapOverviewRow(row: ShowdownOverviewRpcRow): ShowdownOverview {
  return {
    competition_id: readString(row.competition_id),
    template_id: readString(row.template_id),
    title: readString(row.title),
    description: readString(row.description),
    entry_mode: readString(row.entry_mode),
    scoring_method: readString(row.scoring_method),
    submission_starts_at: readString(row.submission_starts_at),
    submission_ends_at: readString(row.submission_ends_at),
    voting_starts_at: readString(row.voting_starts_at),
    voting_ends_at: readString(row.voting_ends_at),
    results_at: readString(row.results_at),
    minimum_entries_for_award: readNumber(row.minimum_entries_for_award),
    is_cancelled: readBoolean(row.is_cancelled),
    total_active_entries: readNumber(row.total_active_entries),
    caller_has_entered: readBoolean(row.caller_has_entered),
  };
}

function mapMyEntryRow(row: ShowdownMyEntryRpcRow): ShowdownMyEntry {
  return {
    id: readString(row.id),
    competition_id: readString(row.competition_id),
    source_record_id: readNullableNumber(row.source_record_id),
    album_title: readString(row.album_title),
    artist_name: readString(row.artist_name),
    cover_url: readString(row.cover_url),
    release_year: readString(row.release_year),
    genre: readString(row.genre),
    release_id_snapshot: readNullableString(row.release_id_snapshot),
    release_group_id_snapshot: readNullableString(row.release_group_id_snapshot),
    caption: readNullableString(row.caption),
    status: readString(row.status),
    submitted_at: readString(row.submitted_at),
  };
}

function mapMatchupEntry(prefix: "entry_a" | "entry_b", row: ShowdownMatchupRpcRow): ShowdownMatchupEntry {
  return {
    id: readString(row[`${prefix}_id`]),
    album_title: readString(row[`${prefix}_album_title`]),
    artist_name: readString(row[`${prefix}_artist_name`]),
    cover_url: readString(row[`${prefix}_cover_url`]),
    release_year: readString(row[`${prefix}_release_year`]),
    genre: readString(row[`${prefix}_genre`]),
    caption: readNullableString(row[`${prefix}_caption`]),
  };
}

function mapMatchupRow(row: ShowdownMatchupRpcRow): ShowdownMatchup {
  return {
    entry_a: mapMatchupEntry("entry_a", row),
    entry_b: mapMatchupEntry("entry_b", row),
  };
}

function mapVoteRow(row: ShowdownVoteRpcRow): ShowdownVoteResult {
  return {
    vote_id: readString(row.vote_id),
    competition_id: readString(row.competition_id),
    winner_entry_id: readString(row.winner_entry_id),
  };
}

function mapResultRow(row: ShowdownResultRpcRow): ShowdownResultRow {
  return {
    entry_id: readString(row.entry_id),
    album_title: readString(row.album_title),
    artist_name: readString(row.artist_name),
    cover_url: readString(row.cover_url),
    release_year: readString(row.release_year),
    genre: readString(row.genre),
    caption: readNullableString(row.caption),
    placement: readNumber(row.placement),
    user_id: readString(row.user_id),
  };
}

function mapTrophyRow(row: ShowdownTrophyRpcRow): ShowdownTrophyRow {
  return {
    award_id: readString(row.award_id),
    competition_id: readString(row.competition_id),
    entry_id: readString(row.entry_id),
    award_type: readString(row.award_type),
    placement: readNullableNumber(row.placement),
    awarded_at: readString(row.awarded_at),
    competition_title: readString(row.competition_title),
    album_title: readString(row.album_title),
    artist_name: readString(row.artist_name),
    cover_url: readString(row.cover_url),
    release_year: readString(row.release_year),
    genre: readString(row.genre),
  };
}

function assertOverviewRow(row: ShowdownOverview): void {
  if (!row.competition_id || !row.template_id) {
    throw toUnexpectedServiceError("get_competition_overview");
  }
}

function assertMyEntryRow(row: ShowdownMyEntry, operation: string): void {
  if (!row.id || !row.competition_id || !row.album_title || !row.artist_name || !row.status) {
    throw toUnexpectedServiceError(operation);
  }
}

function assertMatchupRow(row: ShowdownMatchup): void {
  if (!row.entry_a.id || !row.entry_b.id || row.entry_a.id === row.entry_b.id) {
    throw toUnexpectedServiceError("get_next_competition_matchup");
  }
}

function assertVoteRow(row: ShowdownVoteResult): void {
  if (!row.vote_id || !row.competition_id || !row.winner_entry_id) {
    throw toUnexpectedServiceError("submit_competition_vote");
  }
}

function assertResultRow(row: ShowdownResultRow): void {
  if (!row.entry_id || !row.user_id || row.placement <= 0) {
    throw toUnexpectedServiceError("get_competition_results");
  }
}

function assertTrophyRow(row: ShowdownTrophyRow): void {
  if (!row.award_id || !row.competition_id || !row.entry_id || !row.award_type || !row.competition_title) {
    throw toUnexpectedServiceError("get_user_competition_awards");
  }
}

export async function getCompetitionOverview(competitionId: string): Promise<ShowdownOverview> {
  const { data, error } = await supabase.rpc("get_competition_overview", {
    p_competition_id: competitionId,
  });

  if (error) {
    throw toShowdownServiceError("get_competition_overview", error as PostgrestError);
  }

  const row = firstRow<ShowdownOverviewRpcRow>(data);
  if (!row) {
    throw toUnexpectedServiceError("get_competition_overview");
  }

  const mapped = mapOverviewRow(row);
  assertOverviewRow(mapped);
  return mapped;
}

export async function getCurrentCompetition(): Promise<ShowdownOverview | null> {
  const { data, error } = await supabase.rpc("get_current_competition");

  if (error) {
    throw toShowdownServiceError("get_current_competition", error as PostgrestError);
  }

  const row = firstRow<ShowdownOverviewRpcRow>(data);
  if (!row) {
    return null;
  }

  const mapped = mapOverviewRow(row);
  assertOverviewRow(mapped);
  return mapped;
}

export async function getMyCompetitionEntry(competitionId: string): Promise<ShowdownMyEntry | null> {
  const { data, error } = await supabase.rpc("get_my_competition_entry", {
    p_competition_id: competitionId,
  });

  if (error) {
    throw toShowdownServiceError("get_my_competition_entry", error as PostgrestError);
  }

  const row = firstRow<ShowdownMyEntryRpcRow>(data);
  if (!row) {
    return null;
  }

  const mapped = mapMyEntryRow(row);
  assertMyEntryRow(mapped, "get_my_competition_entry");
  return mapped;
}

export async function submitCompetitionEntry(
  competitionId: string,
  sourceRecordId: number,
  caption: string | null = null
): Promise<ShowdownSubmitEntryResult> {
  const { data, error } = await supabase.rpc("submit_competition_entry", {
    p_competition_id: competitionId,
    p_source_record_id: sourceRecordId,
    p_caption: caption,
  });

  if (error) {
    throw toShowdownServiceError("submit_competition_entry", error as PostgrestError);
  }

  const row = firstRow<ShowdownSubmitEntryRpcRow>(data);
  if (!row) {
    throw toUnexpectedServiceError("submit_competition_entry");
  }

  const mapped = mapMyEntryRow(row);
  assertMyEntryRow(mapped, "submit_competition_entry");
  return mapped;
}

export async function getNextCompetitionMatchup(competitionId: string): Promise<ShowdownMatchup | null> {
  const { data, error } = await supabase.rpc("get_next_competition_matchup", {
    p_competition_id: competitionId,
  });

  if (error) {
    throw toShowdownServiceError("get_next_competition_matchup", error as PostgrestError);
  }

  const row = firstRow<ShowdownMatchupRpcRow>(data);
  if (!row) {
    return null;
  }

  const mapped = mapMatchupRow(row);
  assertMatchupRow(mapped);
  return mapped;
}

export async function submitCompetitionVote(
  competitionId: string,
  entryAId: string,
  entryBId: string,
  winnerEntryId: string
): Promise<ShowdownVoteResult> {
  const { data, error } = await supabase.rpc("submit_competition_vote", {
    p_competition_id: competitionId,
    p_entry_a_id: entryAId,
    p_entry_b_id: entryBId,
    p_winner_entry_id: winnerEntryId,
  });

  if (error) {
    throw toShowdownServiceError("submit_competition_vote", error as PostgrestError);
  }

  const row = firstRow<ShowdownVoteRpcRow>(data);
  if (!row) {
    throw toUnexpectedServiceError("submit_competition_vote");
  }

  const mapped = mapVoteRow(row);
  assertVoteRow(mapped);
  return mapped;
}

export async function getCompetitionResults(competitionId: string): Promise<ShowdownResultRow[]> {
  const { data, error } = await supabase.rpc("get_competition_results", {
    p_competition_id: competitionId,
  });

  if (error) {
    throw toShowdownServiceError("get_competition_results", error as PostgrestError);
  }

  const mapped = rows<ShowdownResultRpcRow>(data).map((row) => mapResultRow(row));
  for (const row of mapped) {
    assertResultRow(row);
  }

  return mapped;
}

export async function getUserCompetitionAwards(userId: string): Promise<ShowdownTrophyRow[]> {
  const { data, error } = await supabase.rpc("get_user_competition_awards", {
    p_user_id: userId,
  });

  if (error) {
    throw toShowdownServiceError("get_user_competition_awards", error as PostgrestError);
  }

  const mapped = rows<ShowdownTrophyRpcRow>(data).map((row) => mapTrophyRow(row));
  for (const row of mapped) {
    assertTrophyRow(row);
  }

  return mapped;
}
