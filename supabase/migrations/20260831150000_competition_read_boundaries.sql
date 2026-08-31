-- Showdowns Competition Engine V1.2
-- Read-boundary RPCs for safe competition data disclosure.

-- =====================================================
-- Remove overly broad direct read policies
-- =====================================================
drop policy if exists competition_entries_select_active
  on public.competition_entries;

drop policy if exists competition_entry_scores_select_all
  on public.competition_entry_scores;

-- =====================================================
-- Competition overview (safe aggregate only)
-- =====================================================
create or replace function public.get_competition_overview(
  p_competition_id uuid
)
returns table (
  competition_id uuid,
  template_id uuid,
  title text,
  description text,
  entry_mode text,
  scoring_method text,
  submission_starts_at timestamptz,
  submission_ends_at timestamptz,
  voting_starts_at timestamptz,
  voting_ends_at timestamptz,
  results_at timestamptz,
  minimum_entries_for_award integer,
  is_cancelled boolean,
  total_active_entries bigint,
  caller_has_entered boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid;
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.competitions as c
    where c.id = p_competition_id
  ) then
    raise exception 'Competition not found';
  end if;

  return query
  select
    c.id as competition_id,
    c.template_id,
    c.title,
    c.description,
    t.entry_mode,
    t.scoring_method,
    c.submission_starts_at,
    c.submission_ends_at,
    c.voting_starts_at,
    c.voting_ends_at,
    c.results_at,
    c.minimum_entries_for_award,
    c.is_cancelled,
    (
      select count(*)
      from public.competition_entries as ce_count
      where ce_count.competition_id = c.id
        and ce_count.status = 'active'
    ) as total_active_entries,
    exists (
      select 1
      from public.competition_entries as ce_me
      where ce_me.competition_id = c.id
        and ce_me.user_id = v_auth_user_id
    ) as caller_has_entered
  from public.competitions as c
  join public.competition_templates as t
    on t.id = c.template_id
  where c.id = p_competition_id;
end;
$$;

comment on function public.get_competition_overview(uuid)
is 'Returns safe competition overview data and caller entry presence without exposing entrant identities, scores, or vote totals.';

revoke execute on function public.get_competition_overview(uuid) from public;
revoke execute on function public.get_competition_overview(uuid) from anon;
grant execute on function public.get_competition_overview(uuid) to authenticated;

-- =====================================================
-- Caller own entry (no user_id returned)
-- =====================================================
create or replace function public.get_my_competition_entry(
  p_competition_id uuid
)
returns table (
  id uuid,
  competition_id uuid,
  source_record_id bigint,
  album_title text,
  artist_name text,
  cover_url text,
  release_year text,
  genre text,
  release_id_snapshot text,
  release_group_id_snapshot text,
  caption text,
  status text,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid;
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    ce.id,
    ce.competition_id,
    ce.source_record_id,
    ce.album_title,
    ce.artist_name,
    ce.cover_url,
    ce.release_year,
    ce.genre,
    ce.release_id_snapshot,
    ce.release_group_id_snapshot,
    ce.caption,
    ce.status,
    ce.submitted_at
  from public.competition_entries as ce
  where ce.competition_id = p_competition_id
    and ce.user_id = v_auth_user_id;
end;
$$;

comment on function public.get_my_competition_entry(uuid)
is 'Returns only the caller own competition entry fields without exposing user_id.';

revoke execute on function public.get_my_competition_entry(uuid) from public;
revoke execute on function public.get_my_competition_entry(uuid) from anon;
grant execute on function public.get_my_competition_entry(uuid) to authenticated;

-- =====================================================
-- Anonymous voting-safe entry list (not matchmaking)
-- =====================================================
create or replace function public.get_competition_voting_entries(
  p_competition_id uuid
)
returns table (
  entry_id uuid,
  album_title text,
  artist_name text,
  cover_url text,
  release_year text,
  genre text,
  caption text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid;
  v_now timestamptz := now();
  v_is_cancelled boolean;
  v_voting_starts_at timestamptz;
  v_voting_ends_at timestamptz;
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  select
    c.is_cancelled,
    c.voting_starts_at,
    c.voting_ends_at
  into
    v_is_cancelled,
    v_voting_starts_at,
    v_voting_ends_at
  from public.competitions as c
  where c.id = p_competition_id;

  if not found then
    raise exception 'Competition not found';
  end if;

  if v_is_cancelled then
    raise exception 'Competition is cancelled';
  end if;

  if v_now < v_voting_starts_at or v_now >= v_voting_ends_at then
    raise exception 'Voting is not currently open';
  end if;

  return query
  select
    ce.id as entry_id,
    ce.album_title,
    ce.artist_name,
    ce.cover_url,
    ce.release_year,
    ce.genre,
    ce.caption
  from public.competition_entries as ce
  where ce.competition_id = p_competition_id
    and ce.status = 'active'
    and ce.user_id <> v_auth_user_id
  order by ce.submitted_at asc, ce.id asc;
end;
$$;

comment on function public.get_competition_voting_entries(uuid)
is 'Returns anonymous voting-safe active entries during the voting window, excluding caller own entry and hiding entrant identity and scoring.';

revoke execute on function public.get_competition_voting_entries(uuid) from public;
revoke execute on function public.get_competition_voting_entries(uuid) from anon;
grant execute on function public.get_competition_voting_entries(uuid) to authenticated;

-- =====================================================
-- Results read boundary (reveals identity only after results_at)
-- =====================================================
create or replace function public.get_competition_results(
  p_competition_id uuid
)
returns table (
  entry_id uuid,
  album_title text,
  artist_name text,
  cover_url text,
  release_year text,
  genre text,
  caption text,
  placement bigint,
  user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid;
  v_now timestamptz := now();
  v_is_cancelled boolean;
  v_results_at timestamptz;
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  select
    c.is_cancelled,
    c.results_at
  into
    v_is_cancelled,
    v_results_at
  from public.competitions as c
  where c.id = p_competition_id;

  if not found then
    raise exception 'Competition not found';
  end if;

  if v_is_cancelled then
    raise exception 'Competition is cancelled';
  end if;

  if v_now < v_results_at then
    raise exception 'Results are not available yet';
  end if;

  return query
  with ranked as (
    select
      ce.id as entry_id,
      ce.album_title,
      ce.artist_name,
      ce.cover_url,
      ce.release_year,
      ce.genre,
      ce.caption,
      ces.rating,
      ces.wins,
      ces.losses,
      ces.appearances,
      ce.user_id,
      row_number() over (
        order by
          ces.rating desc,
          ces.wins desc,
          ces.appearances desc,
          ce.submitted_at asc,
          ce.id asc
      ) as placement
    from public.competition_entries as ce
    join public.competition_entry_scores as ces
      on ces.competition_id = ce.competition_id
     and ces.entry_id = ce.id
    where ce.competition_id = p_competition_id
      and ce.status = 'active'
  )
  select
    ranked.entry_id,
    ranked.album_title,
    ranked.artist_name,
    ranked.cover_url,
    ranked.release_year,
    ranked.genre,
    ranked.caption,
    ranked.placement,
    ranked.user_id
  from ranked
  order by ranked.placement asc;
end;
$$;

comment on function public.get_competition_results(uuid)
is 'Returns ranked competition results only after results_at with submitter user_id; internal scoring is used for ranking but not returned.';

revoke execute on function public.get_competition_results(uuid) from public;
revoke execute on function public.get_competition_results(uuid) from anon;
grant execute on function public.get_competition_results(uuid) to authenticated;

-- Manual test cases (do not execute in migration):
-- 1) Direct SELECT from competition_entries as authenticated is denied.
-- 2) Direct SELECT from competition_entry_scores as authenticated is denied.
-- 3) get_competition_overview returns safe aggregate data only.
-- 4) get_my_competition_entry returns only caller own entry.
-- 5) get_competition_voting_entries hides user_id and excludes caller own entry.
-- 6) get_competition_voting_entries rejects outside voting window.
-- 7) get_competition_results rejects before results_at.
-- 8) get_competition_results reveals ranked entries and submitter user_id only after results_at, while internal scoring fields remain hidden.
-- 9) Unauthenticated RPC calls are rejected.
