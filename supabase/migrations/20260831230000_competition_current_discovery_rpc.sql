-- Showdowns Competition Engine V1.8
-- Current competition discovery RPC for authenticated clients.

create or replace function public.get_current_competition()
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
  v_now timestamptz := now();
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  with candidate_competitions as (
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
      c.created_at,
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
      ) as caller_has_entered,
      case
        when v_now >= c.submission_starts_at and v_now < c.submission_ends_at then 1
        when v_now >= c.voting_starts_at and v_now < c.voting_ends_at then 2
        when v_now >= c.voting_ends_at and v_now < c.results_at then 3
        when v_now >= c.results_at then 4
        when v_now < c.submission_starts_at then 5
        else 6
      end as phase_priority,
      case
        when v_now >= c.submission_starts_at and v_now < c.submission_ends_at
          then extract(epoch from (c.submission_ends_at - v_now))
        when v_now >= c.voting_starts_at and v_now < c.voting_ends_at
          then extract(epoch from (c.voting_ends_at - v_now))
        when v_now >= c.voting_ends_at and v_now < c.results_at
          then extract(epoch from (c.results_at - v_now))
        when v_now >= c.results_at
          then extract(epoch from (v_now - c.results_at))
        when v_now < c.submission_starts_at
          then extract(epoch from (c.submission_starts_at - v_now))
        else 999999999
      end as proximity_seconds
    from public.competitions as c
    join public.competition_templates as t
      on t.id = c.template_id
    where c.is_cancelled = false
  )
  select
    cc.competition_id,
    cc.template_id,
    cc.title,
    cc.description,
    cc.entry_mode,
    cc.scoring_method,
    cc.submission_starts_at,
    cc.submission_ends_at,
    cc.voting_starts_at,
    cc.voting_ends_at,
    cc.results_at,
    cc.minimum_entries_for_award,
    cc.is_cancelled,
    cc.total_active_entries,
    cc.caller_has_entered
  from candidate_competitions as cc
  order by
    cc.phase_priority asc,
    case when cc.phase_priority = 4 then cc.results_at end desc,
    cc.proximity_seconds asc,
    cc.created_at desc,
    cc.competition_id asc
  limit 1;
end;
$$;

comment on function public.get_current_competition()
is 'Returns one current relevant non-cancelled competition for authenticated callers using deterministic phase-priority ordering and safe overview-level fields only.';

revoke execute on function public.get_current_competition() from public;
revoke execute on function public.get_current_competition() from anon;
grant execute on function public.get_current_competition() to authenticated;
