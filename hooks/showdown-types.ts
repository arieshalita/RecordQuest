export type ShowdownPhase = "enter" | "voting" | "results" | "unavailable";

export type ShowdownServiceError = Error & {
  name: "ShowdownServiceError";
  operation: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
  userMessage: string;
  debugMessage: string;
};

export type ShowdownOverview = {
  competition_id: string;
  template_id: string;
  title: string;
  description: string;
  entry_mode: string;
  scoring_method: string;
  submission_starts_at: string;
  submission_ends_at: string;
  voting_starts_at: string;
  voting_ends_at: string;
  results_at: string;
  minimum_entries_for_award: number;
  is_cancelled: boolean;
  total_active_entries: number;
  caller_has_entered: boolean;
};

export type ShowdownMyEntry = {
  id: string;
  competition_id: string;
  source_record_id: number | null;
  album_title: string;
  artist_name: string;
  cover_url: string;
  release_year: string;
  genre: string;
  release_id_snapshot: string | null;
  release_group_id_snapshot: string | null;
  caption: string | null;
  status: string;
  submitted_at: string;
};

export type ShowdownMatchupEntry = {
  id: string;
  album_title: string;
  artist_name: string;
  cover_url: string;
  release_year: string;
  genre: string;
  caption: string | null;
};

export type ShowdownMatchup = {
  entry_a: ShowdownMatchupEntry;
  entry_b: ShowdownMatchupEntry;
};

export type ShowdownResultRow = {
  entry_id: string;
  album_title: string;
  artist_name: string;
  cover_url: string;
  release_year: string;
  genre: string;
  caption: string | null;
  placement: number;
  user_id: string;
};

export type ShowdownTrophyRow = {
  award_id: string;
  competition_id: string;
  entry_id: string;
  award_type: string;
  placement: number | null;
  awarded_at: string;
  competition_title: string;
  album_title: string;
  artist_name: string;
  cover_url: string;
  release_year: string;
  genre: string;
};

export type ShowdownVoteResult = {
  vote_id: string;
  competition_id: string;
  winner_entry_id: string;
};

export type ShowdownSubmitEntryResult = ShowdownMyEntry;
