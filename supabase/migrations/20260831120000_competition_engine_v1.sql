-- Showdowns Competition Engine V1
-- Creates schema-only competition primitives with conservative RLS.
-- No changes to existing RecordQuest tables or app behavior.

create extension if not exists pgcrypto;

-- =====================================================
-- 1) competition_templates
-- =====================================================
create table public.competition_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  entry_mode text not null default 'album_only',
  scoring_method text not null default 'elo',
  min_year integer null,
  max_year integer null,
  genre text null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint competition_templates_entry_mode_chk
    check (entry_mode in ('album_only', 'album_plus_caption', 'album_plus_purchase_info')),
  constraint competition_templates_scoring_method_chk
    check (scoring_method in ('elo')),
  constraint competition_templates_year_range_chk
    check (min_year is null or max_year is null or min_year <= max_year)
);

-- =====================================================
-- 2) competitions
-- =====================================================
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  title text not null,
  description text not null default '',
  submission_starts_at timestamptz not null,
  submission_ends_at timestamptz not null,
  voting_starts_at timestamptz not null,
  voting_ends_at timestamptz not null,
  results_at timestamptz not null,
  minimum_entries_for_award integer not null default 3,
  is_cancelled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  finalized_at timestamptz null,
  constraint competitions_template_id_fkey
    foreign key (template_id)
    references public.competition_templates(id)
    on delete restrict,
  constraint competitions_submission_window_chk
    check (submission_starts_at < submission_ends_at),
  constraint competitions_submission_to_voting_chk
    check (submission_ends_at <= voting_starts_at),
  constraint competitions_voting_window_chk
    check (voting_starts_at < voting_ends_at),
  constraint competitions_voting_to_results_chk
    check (voting_ends_at <= results_at),
  constraint competitions_minimum_entries_for_award_chk
    check (minimum_entries_for_award >= 1)
);

-- =====================================================
-- 3) competition_entries
-- Permanent snapshot of submitted collection data.
-- source_record_id intentionally has no FK to public.records.
-- =====================================================
create table public.competition_entries (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,
  user_id uuid not null,
  source_record_id bigint null,
  album_title text not null,
  artist_name text not null,
  cover_url text not null default '',
  release_year text not null default '',
  genre text not null default '',
  release_id_snapshot text null,
  release_group_id_snapshot text null,
  caption text null,
  status text not null default 'active',
  submitted_at timestamptz not null default timezone('utc', now()),
  constraint competition_entries_competition_id_fkey
    foreign key (competition_id)
    references public.competitions(id)
    on delete cascade,
  constraint competition_entries_user_id_fkey
    foreign key (user_id)
    references auth.users(id)
    on delete cascade,
  constraint competition_entries_id_competition_id_unique
    unique (id, competition_id),
  constraint competition_entries_competition_user_unique
    unique (competition_id, user_id),
  constraint competition_entries_status_chk
    check (status in ('active', 'withdrawn', 'disqualified'))
);

-- =====================================================
-- 4) competition_entry_scores
-- Clients can read scores but cannot mutate directly.
-- =====================================================
create table public.competition_entry_scores (
  competition_id uuid not null,
  entry_id uuid not null,
  rating numeric not null default 1500,
  wins integer not null default 0,
  losses integer not null default 0,
  appearances integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint competition_entry_scores_pkey
    primary key (competition_id, entry_id),
  constraint competition_entry_scores_competition_id_fkey
    foreign key (competition_id)
    references public.competitions(id)
    on delete cascade,
  constraint competition_entry_scores_entry_id_competition_id_fkey
    foreign key (entry_id, competition_id)
    references public.competition_entries(id, competition_id)
    on delete cascade,
  constraint competition_entry_scores_rating_positive_chk
    check (rating > 0),
  constraint competition_entry_scores_wins_nonnegative_chk
    check (wins >= 0),
  constraint competition_entry_scores_losses_nonnegative_chk
    check (losses >= 0),
  constraint competition_entry_scores_appearances_nonnegative_chk
    check (appearances >= 0)
);

-- =====================================================
-- 5) competition_votes
-- Prevent duplicate pair voting by normalized UUID pair.
-- =====================================================
create table public.competition_votes (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,
  voter_user_id uuid not null,
  entry_a_id uuid not null,
  entry_b_id uuid not null,
  winner_entry_id uuid not null,
  normalized_entry_low_id uuid generated always as (least(entry_a_id, entry_b_id)) stored,
  normalized_entry_high_id uuid generated always as (greatest(entry_a_id, entry_b_id)) stored,
  created_at timestamptz not null default timezone('utc', now()),
  constraint competition_votes_competition_id_fkey
    foreign key (competition_id)
    references public.competitions(id)
    on delete cascade,
  constraint competition_votes_voter_user_id_fkey
    foreign key (voter_user_id)
    references auth.users(id)
    on delete cascade,
  constraint competition_votes_entry_a_id_competition_id_fkey
    foreign key (entry_a_id, competition_id)
    references public.competition_entries(id, competition_id)
    on delete cascade,
  constraint competition_votes_entry_b_id_competition_id_fkey
    foreign key (entry_b_id, competition_id)
    references public.competition_entries(id, competition_id)
    on delete cascade,
  constraint competition_votes_winner_entry_id_competition_id_fkey
    foreign key (winner_entry_id, competition_id)
    references public.competition_entries(id, competition_id)
    on delete cascade,
  constraint competition_votes_entries_distinct_chk
    check (entry_a_id <> entry_b_id),
  constraint competition_votes_winner_in_pair_chk
    check (winner_entry_id = entry_a_id or winner_entry_id = entry_b_id),
  constraint competition_votes_voter_pair_unique
    unique (competition_id, voter_user_id, normalized_entry_low_id, normalized_entry_high_id)
);

-- =====================================================
-- 6) competition_awards
-- =====================================================
create table public.competition_awards (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,
  entry_id uuid not null,
  user_id uuid not null,
  award_type text not null,
  placement integer null,
  awarded_at timestamptz not null default timezone('utc', now()),
  constraint competition_awards_competition_id_fkey
    foreign key (competition_id)
    references public.competitions(id)
    on delete cascade,
  constraint competition_awards_entry_id_competition_id_fkey
    foreign key (entry_id, competition_id)
    references public.competition_entries(id, competition_id)
    on delete cascade,
  constraint competition_awards_user_id_fkey
    foreign key (user_id)
    references auth.users(id)
    on delete cascade,
  constraint competition_awards_award_type_chk
    check (award_type in ('winner', 'runner_up', 'finalist', 'season_champion')),
  constraint competition_awards_placement_chk
    check (placement is null or placement >= 1),
  constraint competition_awards_competition_entry_award_type_unique
    unique (competition_id, entry_id, award_type)
);

-- =====================================================
-- Indexes
-- =====================================================
create index competition_templates_is_active_idx
  on public.competition_templates (is_active);

create index competitions_template_id_idx
  on public.competitions (template_id);

create index competitions_submission_starts_at_idx
  on public.competitions (submission_starts_at);

create index competitions_submission_ends_at_idx
  on public.competitions (submission_ends_at);

create index competitions_voting_starts_at_idx
  on public.competitions (voting_starts_at);

create index competitions_voting_ends_at_idx
  on public.competitions (voting_ends_at);

create index competitions_results_at_idx
  on public.competitions (results_at);

create index competition_entries_competition_id_idx
  on public.competition_entries (competition_id);

create index competition_entries_user_id_idx
  on public.competition_entries (user_id);

create index competition_entries_status_idx
  on public.competition_entries (status);

create index competition_entry_scores_competition_rating_idx
  on public.competition_entry_scores (competition_id, rating desc);

create index competition_votes_competition_id_idx
  on public.competition_votes (competition_id);

create index competition_votes_voter_user_id_idx
  on public.competition_votes (voter_user_id);

create index competition_awards_user_id_idx
  on public.competition_awards (user_id);

create index competition_awards_competition_id_idx
  on public.competition_awards (competition_id);

-- =====================================================
-- Row Level Security
-- =====================================================
alter table public.competition_templates enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_entries enable row level security;
alter table public.competition_entry_scores enable row level security;
alter table public.competition_votes enable row level security;
alter table public.competition_awards enable row level security;

-- competition_templates: authenticated users may SELECT active templates.
create policy competition_templates_select_active
  on public.competition_templates
  for select
  to authenticated
  using (is_active = true);

-- competitions: authenticated users may SELECT non-cancelled competitions.
create policy competitions_select_not_cancelled
  on public.competitions
  for select
  to authenticated
  using (is_cancelled = false);

-- competition_entries: authenticated users may SELECT active entries only.
-- No direct client INSERT/UPDATE/DELETE policies are defined here.
create policy competition_entries_select_active
  on public.competition_entries
  for select
  to authenticated
  using (status = 'active');

-- competition_entry_scores: authenticated users may SELECT scores.
create policy competition_entry_scores_select_all
  on public.competition_entry_scores
  for select
  to authenticated
  using (true);

-- competition_votes: authenticated users may SELECT only their own votes.
create policy competition_votes_select_own
  on public.competition_votes
  for select
  to authenticated
  using (voter_user_id = auth.uid());

-- competition_awards: authenticated users may SELECT awards.
create policy competition_awards_select_all
  on public.competition_awards
  for select
  to authenticated
  using (true);
