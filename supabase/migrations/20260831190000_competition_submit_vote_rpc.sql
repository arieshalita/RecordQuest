-- Showdowns Competition Engine V1.4
-- Secure vote submission RPC with atomic Elo and counter updates.

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

comment on function public.submit_competition_vote(uuid, uuid, uuid, uuid)
is 'Validates authenticated pairwise voting, prevents self-votes and repeat pair votes, records the vote, and atomically updates internal Elo ratings and counters.';

revoke execute on function public.submit_competition_vote(uuid, uuid, uuid, uuid) from public;
revoke execute on function public.submit_competition_vote(uuid, uuid, uuid, uuid) from anon;
grant execute on function public.submit_competition_vote(uuid, uuid, uuid, uuid) to authenticated;

-- Manual test cases (do not execute in migration):
-- 1) Unauthenticated caller rejected.
-- 2) Invalid competition rejected.
-- 3) Cancelled competition rejected.
-- 4) Vote outside voting window rejected.
-- 5) Identical entry ids rejected.
-- 6) Winner not in matchup rejected.
-- 7) Entry from another competition rejected.
-- 8) Inactive entry rejected.
-- 9) Voter cannot vote on own entry.
-- 10) First valid vote succeeds.
-- 11) Vote row inserted.
-- 12) Winner wins incremented.
-- 13) Loser losses incremented.
-- 14) Both appearances incremented.
-- 15) Both ratings updated.
-- 16) Same voter same pair rejected if order is reversed.
-- 17) Concurrent duplicate does not double-count.
-- 18) Concurrent different voters serialize score updates correctly.
-- 19) Score-row-missing case rejected.
-- 20) Caller never receives rating/counter values.
