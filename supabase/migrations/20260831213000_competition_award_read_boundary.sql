-- Showdowns Competition Engine V1.6
-- Award read-boundary fix: remove direct award table reads and expose safe trophy RPC.

-- NOTE:
-- In finalize_competition idempotent responses, active_entry_count is operational metadata,
-- not frozen public result history. Frozen history is represented by final_placement and
-- competition_awards.

-- =====================================================
-- Remove direct authenticated reads on competition_awards
-- =====================================================
drop policy if exists competition_awards_select_all
on public.competition_awards;

-- =====================================================
-- Public/profile-safe trophy history RPC
-- =====================================================
create or replace function public.get_user_competition_awards(
  p_user_id uuid
)
returns table (
  award_id uuid,
  competition_id uuid,
  entry_id uuid,
  award_type text,
  placement integer,
  awarded_at timestamptz,
  competition_title text,
  album_title text,
  artist_name text,
  cover_url text,
  release_year text,
  genre text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid;
  v_now timestamptz := now();
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  return query
  select
    ca.id as award_id,
    ca.competition_id,
    ca.entry_id,
    ca.award_type,
    ca.placement,
    ca.awarded_at,
    c.title as competition_title,
    ce.album_title,
    ce.artist_name,
    ce.cover_url,
    ce.release_year,
    ce.genre
  from public.competition_awards as ca
  join public.competitions as c
    on c.id = ca.competition_id
  join public.competition_entries as ce
    on ce.id = ca.entry_id
   and ce.competition_id = ca.competition_id
   and ce.user_id = ca.user_id
  where ca.user_id = p_user_id
    and c.is_cancelled = false
    and c.finalized_at is not null
    and v_now >= c.results_at
  order by ca.awarded_at desc, ca.id desc;
end;
$$;

comment on function public.get_user_competition_awards(uuid)
is 'Returns public/profile-safe competition trophy history for a target user to authenticated callers; only awards from non-cancelled competitions are visible after both finalization and results_at, and internal scoring fields are never exposed.';

revoke execute on function public.get_user_competition_awards(uuid) from public;
revoke execute on function public.get_user_competition_awards(uuid) from anon;
grant execute on function public.get_user_competition_awards(uuid) to authenticated;

-- Manual validation cases (do not execute in migration):
-- 1) anon cannot execute trophy RPC
-- 2) unauthenticated caller rejected
-- 3) null p_user_id rejected
-- 4) authenticated caller can request own trophies
-- 5) authenticated caller can request another user's public trophies
-- 6) award before results_at is hidden
-- 7) award before finalization is hidden
-- 8) cancelled competition award is hidden
-- 9) visible winner award returns correct competition metadata
-- 10) visible award returns correct frozen entry snapshot metadata
-- 11) Elo/rating/counters/vote totals are not returned
-- 12) authenticated direct SELECT on competition_awards is denied
-- 13) service role retains administrative access
-- 14) results/trophy visibility timing is aligned
