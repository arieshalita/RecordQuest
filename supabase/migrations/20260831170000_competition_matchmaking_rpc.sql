-- Showdowns Competition Engine V1.3
-- Matchmaking read RPC for one anonymous competition matchup.

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
    where not exists (
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

comment on function public.get_next_competition_matchup(uuid)
is 'Returns one anonymous voting matchup, excludes caller own entry, prevents repeat exact pairings for that voter, and balances exposure and rating similarity internally.';

revoke execute on function public.get_next_competition_matchup(uuid) from public;
revoke execute on function public.get_next_competition_matchup(uuid) from anon;
grant execute on function public.get_next_competition_matchup(uuid) to authenticated;

-- Manual test cases (do not execute in migration):
-- 1) Unauthenticated caller is rejected.
-- 2) Invalid competition id is rejected.
-- 3) Cancelled competition is rejected.
-- 4) Call outside voting window is rejected.
-- 5) Caller own entry never appears.
-- 6) Matchup returns exactly two distinct active entries.
-- 7) No user_id or scores are exposed.
-- 8) Already-voted pair is excluded even if stored order was reversed.
-- 9) Lower-exposure entries are favored.
-- 10) Closer-rating pair wins only after exposure criteria.
-- 11) Display A/B orientation can vary.
-- 12) Fewer than two eligible entries returns zero rows.
-- 13) All pairs exhausted returns zero rows.
