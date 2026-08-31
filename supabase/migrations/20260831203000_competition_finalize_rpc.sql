-- Showdowns Competition Engine V1.5
-- Trusted finalization RPC and frozen public results.

-- =====================================================
-- Frozen placement persistence
-- =====================================================
alter table public.competition_entries
  add column if not exists final_placement integer;

alter table public.competition_entries
  add constraint competition_entries_final_placement_chk
  check (final_placement is null or final_placement >= 1);

create index if not exists competition_entries_competition_final_placement_idx
  on public.competition_entries (competition_id, final_placement)
  where final_placement is not null;

-- =====================================================
-- Trusted finalization RPC (service role / admin context)
-- =====================================================
create or replace function public.finalize_competition(
  p_competition_id uuid
)
returns table (
  competition_id uuid,
  finalized_at timestamptz,
  active_entry_count bigint,
  award_created boolean,
  winner_entry_id uuid,
  winner_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();

  v_is_cancelled boolean;
  v_voting_ends_at timestamptz;
  v_existing_finalized_at timestamptz;
  v_minimum_entries_for_award integer;

  v_active_entry_count bigint;
  v_winner_entry_id uuid;
  v_winner_user_id uuid;
  v_award_created boolean := false;
begin
  if p_competition_id is null then
    raise exception 'Competition id is required';
  end if;

  select
    c.is_cancelled,
    c.voting_ends_at,
    c.finalized_at,
    c.minimum_entries_for_award
  into
    v_is_cancelled,
    v_voting_ends_at,
    v_existing_finalized_at,
    v_minimum_entries_for_award
  from public.competitions as c
  where c.id = p_competition_id
  for update;

  if not found then
    raise exception 'Competition not found';
  end if;

  if v_is_cancelled then
    raise exception 'Competition is cancelled';
  end if;

  if v_now < v_voting_ends_at then
    raise exception 'Voting has not ended yet';
  end if;

  -- Idempotent return for already-finalized competitions.
  if v_existing_finalized_at is not null then
    select
      ca.entry_id,
      ca.user_id
    into
      v_winner_entry_id,
      v_winner_user_id
    from public.competition_awards as ca
    where ca.competition_id = p_competition_id
      and ca.award_type = 'winner'
      and ca.placement = 1
    order by ca.awarded_at asc, ca.id asc
    limit 1;

    select count(*)
    into v_active_entry_count
    from public.competition_entries as ce
    where ce.competition_id = p_competition_id
      and ce.status = 'active';

    return query
    select
      p_competition_id,
      v_existing_finalized_at,
      v_active_entry_count,
      false,
      v_winner_entry_id,
      v_winner_user_id;

    return;
  end if;

  select count(*)
  into v_active_entry_count
  from public.competition_entries as ce
  where ce.competition_id = p_competition_id
    and ce.status = 'active';

  if exists (
    select 1
    from public.competition_entries as ce
    left join public.competition_entry_scores as ces
      on ces.competition_id = ce.competition_id
     and ces.entry_id = ce.id
    where ce.competition_id = p_competition_id
      and ce.status = 'active'
      and ces.entry_id is null
  ) then
    raise exception 'Competition score state is incomplete';
  end if;

  -- Persist deterministic frozen placements for all active entries exactly once.
  with ranked as (
    select
      ce.id as entry_id,
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
  update public.competition_entries as ce
  set final_placement = ranked.placement
  from ranked
  where ce.id = ranked.entry_id
    and ce.competition_id = p_competition_id;

  -- Ensure all active entries now have scores and frozen placements.
  if exists (
    select 1
    from public.competition_entries as ce
    where ce.competition_id = p_competition_id
      and ce.status = 'active'
      and ce.final_placement is null
  ) then
    raise exception 'Competition score state is incomplete';
  end if;

  if v_active_entry_count >= v_minimum_entries_for_award then
    select
      ce.id,
      ce.user_id
    into
      v_winner_entry_id,
      v_winner_user_id
    from public.competition_entries as ce
    where ce.competition_id = p_competition_id
      and ce.status = 'active'
      and ce.final_placement = 1
    order by ce.id asc
    limit 1;

    if v_winner_entry_id is null or v_winner_user_id is null then
      raise exception 'Competition score state is incomplete';
    end if;

    insert into public.competition_awards (
      competition_id,
      entry_id,
      user_id,
      award_type,
      placement,
      awarded_at
    )
    values (
      p_competition_id,
      v_winner_entry_id,
      v_winner_user_id,
      'winner',
      1,
      v_now
    );

    v_award_created := true;
  else
    v_winner_entry_id := null;
    v_winner_user_id := null;
    v_award_created := false;
  end if;

  update public.competitions as c
  set finalized_at = v_now
  where c.id = p_competition_id
    and c.finalized_at is null
  returning c.finalized_at into v_existing_finalized_at;

  if v_existing_finalized_at is null then
    raise exception 'Competition finalization failed';
  end if;

  return query
  select
    p_competition_id,
    v_existing_finalized_at,
    v_active_entry_count,
    v_award_created,
    v_winner_entry_id,
    v_winner_user_id;
end;
$$;

-- =====================================================
-- Vote submission update (coordinates with finalization lock)
-- =====================================================
create or replace function public.submit_competition_vote(
  p_competition_id uuid,
  p_entry_a_id uuid,
  p_entry_b_id uuid,
  p_winner_entry_id uuid
)
returns table (
  vote_id uuid,
  competition_id uuid,
  winner_entry_id uuid
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
  v_finalized_at timestamptz;

  v_entry_a_owner uuid;
  v_entry_b_owner uuid;

  v_score_row_count integer;
  v_score_row record;

  v_rating_a numeric;
  v_rating_b numeric;

  v_expected_a numeric;
  v_expected_b numeric;
  v_actual_a numeric;
  v_actual_b numeric;

  v_new_rating_a numeric;
  v_new_rating_b numeric;

  v_winner_id uuid;
  v_loser_id uuid;

  v_vote_id uuid;
  v_constraint_name text;

  v_k_factor numeric := 32;
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_competition_id is null then
    raise exception 'Competition id is required';
  end if;

  if p_entry_a_id is null or p_entry_b_id is null then
    raise exception 'Both entry ids are required';
  end if;

  if p_winner_entry_id is null then
    raise exception 'Winner entry id is required';
  end if;

  if p_entry_a_id = p_entry_b_id then
    raise exception 'Entry ids must be distinct';
  end if;

  if p_winner_entry_id <> p_entry_a_id and p_winner_entry_id <> p_entry_b_id then
    raise exception 'Winner entry id must match one of the matchup entries';
  end if;

  select
    c.is_cancelled,
    c.voting_starts_at,
    c.voting_ends_at,
    c.finalized_at
  into
    v_is_cancelled,
    v_voting_starts_at,
    v_voting_ends_at,
    v_finalized_at
  from public.competitions as c
  where c.id = p_competition_id
  for share;

  if not found then
    raise exception 'Competition not found';
  end if;

  if v_is_cancelled then
    raise exception 'Competition is cancelled';
  end if;

  if v_finalized_at is not null then
    raise exception 'Competition is already finalized';
  end if;

  if v_now < v_voting_starts_at or v_now >= v_voting_ends_at then
    raise exception 'Voting is not currently open';
  end if;

  select ce.user_id
  into v_entry_a_owner
  from public.competition_entries as ce
  where ce.id = p_entry_a_id
    and ce.competition_id = p_competition_id
    and ce.status = 'active';

  if not found then
    raise exception 'Entry A is invalid for this competition';
  end if;

  select ce.user_id
  into v_entry_b_owner
  from public.competition_entries as ce
  where ce.id = p_entry_b_id
    and ce.competition_id = p_competition_id
    and ce.status = 'active';

  if not found then
    raise exception 'Entry B is invalid for this competition';
  end if;

  if v_entry_a_owner = v_auth_user_id or v_entry_b_owner = v_auth_user_id then
    raise exception 'You cannot vote on your own entry';
  end if;

  if exists (
    select 1
    from public.competition_votes as cv
    where cv.competition_id = p_competition_id
      and cv.voter_user_id = v_auth_user_id
      and cv.normalized_entry_low_id = least(p_entry_a_id, p_entry_b_id)
      and cv.normalized_entry_high_id = greatest(p_entry_a_id, p_entry_b_id)
  ) then
    raise exception 'You already voted on this matchup';
  end if;

  v_score_row_count := 0;
  for v_score_row in
    select
      ces.entry_id,
      ces.rating
    from public.competition_entry_scores as ces
    where ces.competition_id = p_competition_id
      and ces.entry_id in (p_entry_a_id, p_entry_b_id)
    order by ces.entry_id asc
    for update
  loop
    v_score_row_count := v_score_row_count + 1;

    if v_score_row.entry_id = p_entry_a_id then
      v_rating_a := v_score_row.rating;
    elsif v_score_row.entry_id = p_entry_b_id then
      v_rating_b := v_score_row.rating;
    end if;
  end loop;

  if v_score_row_count <> 2 or v_rating_a is null or v_rating_b is null then
    raise exception 'Competition score state is missing';
  end if;

  if p_winner_entry_id = p_entry_a_id then
    v_actual_a := 1;
    v_actual_b := 0;
    v_winner_id := p_entry_a_id;
    v_loser_id := p_entry_b_id;
  else
    v_actual_a := 0;
    v_actual_b := 1;
    v_winner_id := p_entry_b_id;
    v_loser_id := p_entry_a_id;
  end if;

  -- Elo expected scores and updated ratings.
  v_expected_a := 1 / (1 + power(10::numeric, (v_rating_b - v_rating_a) / 400.0));
  v_expected_b := 1 / (1 + power(10::numeric, (v_rating_a - v_rating_b) / 400.0));

  v_new_rating_a := v_rating_a + v_k_factor * (v_actual_a - v_expected_a);
  v_new_rating_b := v_rating_b + v_k_factor * (v_actual_b - v_expected_b);

  begin
    insert into public.competition_votes (
      competition_id,
      voter_user_id,
      entry_a_id,
      entry_b_id,
      winner_entry_id
    )
    values (
      p_competition_id,
      v_auth_user_id,
      p_entry_a_id,
      p_entry_b_id,
      p_winner_entry_id
    )
    returning id into v_vote_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      if v_constraint_name = 'competition_votes_voter_pair_unique' then
        raise exception 'You already voted on this matchup';
      end if;

      raise;
  end;

  update public.competition_entry_scores as ces
  set
    rating = case
      when ces.entry_id = p_entry_a_id then v_new_rating_a
      when ces.entry_id = p_entry_b_id then v_new_rating_b
      else ces.rating
    end,
    wins = ces.wins + case when ces.entry_id = v_winner_id then 1 else 0 end,
    losses = ces.losses + case when ces.entry_id = v_loser_id then 1 else 0 end,
    appearances = ces.appearances + 1,
    updated_at = timezone('utc', now())
  where ces.competition_id = p_competition_id
    and ces.entry_id in (p_entry_a_id, p_entry_b_id);

  return query
  select
    v_vote_id,
    p_competition_id,
    p_winner_entry_id;
end;
$$;

-- =====================================================
-- Public results read boundary (finalized + frozen ordering)
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
  v_finalized_at timestamptz;
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  select
    c.is_cancelled,
    c.results_at,
    c.finalized_at
  into
    v_is_cancelled,
    v_results_at,
    v_finalized_at
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

  if v_finalized_at is null then
    raise exception 'Results are not finalized yet';
  end if;

  return query
  select
    ce.id as entry_id,
    ce.album_title,
    ce.artist_name,
    ce.cover_url,
    ce.release_year,
    ce.genre,
    ce.caption,
    ce.final_placement::bigint as placement,
    ce.user_id
  from public.competition_entries as ce
  where ce.competition_id = p_competition_id
    and ce.status = 'active'
    and ce.final_placement is not null
  order by ce.final_placement asc, ce.id asc;
end;
$$;

comment on function public.finalize_competition(uuid)
is 'Trusted server-side finalization for a competition: locks and finalizes once after voting ends, freezes deterministic final placements, creates the permanent winner award when minimum participation is met, and remains idempotent on repeated calls.';

comment on function public.submit_competition_vote(uuid, uuid, uuid, uuid)
is 'Validates authenticated pairwise voting, prevents self-votes and repeat pair votes, records the vote, atomically updates internal Elo and counters, and coordinates with competition finalization locks so frozen placements cannot be invalidated.';

comment on function public.get_competition_results(uuid)
is 'Returns public competition results only after results_at and finalization, using frozen final_placement ordering; internal Elo and counters are never exposed.';

revoke execute on function public.finalize_competition(uuid) from public;
revoke execute on function public.finalize_competition(uuid) from anon;
revoke execute on function public.finalize_competition(uuid) from authenticated;
grant execute on function public.finalize_competition(uuid) to service_role;

revoke execute on function public.submit_competition_vote(uuid, uuid, uuid, uuid) from public;
revoke execute on function public.submit_competition_vote(uuid, uuid, uuid, uuid) from anon;
grant execute on function public.submit_competition_vote(uuid, uuid, uuid, uuid) to authenticated;

revoke execute on function public.get_competition_results(uuid) from public;
revoke execute on function public.get_competition_results(uuid) from anon;
grant execute on function public.get_competition_results(uuid) to authenticated;

-- Manual validation cases (do not execute in migration):
-- 1) invalid competition rejected
-- 2) cancelled competition rejected
-- 3) finalization before voting_ends_at rejected
-- 4) authenticated client cannot execute finalize_competition
-- 5) valid trusted finalization succeeds
-- 6) competition row is locked during finalization
-- 7) fewer than minimum entries finalizes with no winner award
-- 8) minimum-entry threshold met creates exactly one winner award
-- 9) winner placement = 1
-- 10) all active entries receive deterministic final_placement
-- 11) missing score row causes rollback
-- 12) repeated finalization is idempotent
-- 13) concurrent finalization creates no duplicate awards
-- 14) finalized_at is set once
-- 15) results RPC rejects before results_at
-- 16) results RPC rejects after results_at if competition is not finalized
-- 17) results RPC uses frozen final_placement after finalization
-- 18) results RPC does not expose rating/wins/losses/appearances
-- 19) later changes to competition_entry_scores do not alter frozen result ordering
-- 20) winner award remains tied to winning entry and user
-- 21) vote started and completed before finalizer is included in frozen ranking
-- 22) finalizer waits for an in-progress vote holding the competition share lock
-- 23) vote cannot mutate scores after finalized_at is set
-- 24) vote started after finalization returns 'Competition is already finalized'
-- 25) first finalization overwrites any stray pre-finalization final_placement values with deterministic placements
-- 26) repeated finalization does not change frozen placements
