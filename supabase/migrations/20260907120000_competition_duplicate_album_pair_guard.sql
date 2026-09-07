-- Showdowns Competition Engine V1.5
-- Prevents matchups between entries that normalize to the same album+artist.

create or replace function public.get_next_competition_matchup(
  p_competition_id uuid
)
returns table (
  entry_a_id uuid,
  entry_a_album_title text,
  entry_a_artist_name text,
  entry_a_cover_url text,
  entry_a_release_year text,
  entry_a_genre text,
  entry_a_caption text,
  entry_b_id uuid,
  entry_b_album_title text,
  entry_b_artist_name text,
  entry_b_cover_url text,
  entry_b_release_year text,
  entry_b_genre text,
  entry_b_caption text
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
  with eligible_entries as (
    select
      ce.id as entry_id,
      ce.album_title,
      ce.artist_name,
      ce.cover_url,
      ce.release_year,
      ce.genre,
      ce.caption,
      ces.appearances,
      ces.rating
    from public.competition_entries as ce
    join public.competition_entry_scores as ces
      on ces.competition_id = ce.competition_id
     and ces.entry_id = ce.id
    where ce.competition_id = p_competition_id
      and ce.status = 'active'
      and ce.user_id <> v_auth_user_id
  ),
  unseen_pairs as (
    select
      a.entry_id as entry_1_id,
      a.album_title as entry_1_album_title,
      a.artist_name as entry_1_artist_name,
      a.cover_url as entry_1_cover_url,
      a.release_year as entry_1_release_year,
      a.genre as entry_1_genre,
      a.caption as entry_1_caption,
      a.appearances as entry_1_appearances,
      a.rating as entry_1_rating,
      b.entry_id as entry_2_id,
      b.album_title as entry_2_album_title,
      b.artist_name as entry_2_artist_name,
      b.cover_url as entry_2_cover_url,
      b.release_year as entry_2_release_year,
      b.genre as entry_2_genre,
      b.caption as entry_2_caption,
      b.appearances as entry_2_appearances,
      b.rating as entry_2_rating
    from eligible_entries as a
    join eligible_entries as b
      on a.entry_id < b.entry_id
    where not (
      lower(trim(a.album_title)) = lower(trim(b.album_title))
      and lower(trim(a.artist_name)) = lower(trim(b.artist_name))
    )
      and not exists (
        select 1
        from public.competition_votes as cv
        where cv.competition_id = p_competition_id
          and cv.voter_user_id = v_auth_user_id
          and cv.normalized_entry_low_id = a.entry_id
          and cv.normalized_entry_high_id = b.entry_id
      )
  ),
  selected_pair as (
    select
      up.*
    from unseen_pairs as up
    order by
      greatest(up.entry_1_appearances, up.entry_2_appearances) asc,
      (up.entry_1_appearances + up.entry_2_appearances) asc,
      abs(up.entry_1_rating - up.entry_2_rating) asc,
      random()
    limit 1
  ),
  oriented_pair as (
    select
      sp.*,
      (random() < 0.5) as flip
    from selected_pair as sp
  )
  select
    case when op.flip then op.entry_2_id else op.entry_1_id end as entry_a_id,
    case when op.flip then op.entry_2_album_title else op.entry_1_album_title end as entry_a_album_title,
    case when op.flip then op.entry_2_artist_name else op.entry_1_artist_name end as entry_a_artist_name,
    case when op.flip then op.entry_2_cover_url else op.entry_1_cover_url end as entry_a_cover_url,
    case when op.flip then op.entry_2_release_year else op.entry_1_release_year end as entry_a_release_year,
    case when op.flip then op.entry_2_genre else op.entry_1_genre end as entry_a_genre,
    case when op.flip then op.entry_2_caption else op.entry_1_caption end as entry_a_caption,
    case when op.flip then op.entry_1_id else op.entry_2_id end as entry_b_id,
    case when op.flip then op.entry_1_album_title else op.entry_2_album_title end as entry_b_album_title,
    case when op.flip then op.entry_1_artist_name else op.entry_2_artist_name end as entry_b_artist_name,
    case when op.flip then op.entry_1_cover_url else op.entry_2_cover_url end as entry_b_cover_url,
    case when op.flip then op.entry_1_release_year else op.entry_2_release_year end as entry_b_release_year,
    case when op.flip then op.entry_1_genre else op.entry_2_genre end as entry_b_genre,
    case when op.flip then op.entry_1_caption else op.entry_2_caption end as entry_b_caption
  from oriented_pair as op;
end;
$$;

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
  v_entry_a_album_title text;
  v_entry_b_album_title text;
  v_entry_a_artist_name text;
  v_entry_b_artist_name text;

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

  select
    ce.user_id,
    ce.album_title,
    ce.artist_name
  into
    v_entry_a_owner,
    v_entry_a_album_title,
    v_entry_a_artist_name
  from public.competition_entries as ce
  where ce.id = p_entry_a_id
    and ce.competition_id = p_competition_id
    and ce.status = 'active';

  if not found then
    raise exception 'Entry A is invalid for this competition';
  end if;

  select
    ce.user_id,
    ce.album_title,
    ce.artist_name
  into
    v_entry_b_owner,
    v_entry_b_album_title,
    v_entry_b_artist_name
  from public.competition_entries as ce
  where ce.id = p_entry_b_id
    and ce.competition_id = p_competition_id
    and ce.status = 'active';

  if not found then
    raise exception 'Entry B is invalid for this competition';
  end if;

  if lower(trim(v_entry_a_album_title)) = lower(trim(v_entry_b_album_title))
    and lower(trim(v_entry_a_artist_name)) = lower(trim(v_entry_b_artist_name)) then
    raise exception 'Identical albums cannot be matched against each other';
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
