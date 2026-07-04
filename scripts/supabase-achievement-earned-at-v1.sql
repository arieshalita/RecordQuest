
begin;

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null,
  earned_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, achievement_id)
);

alter table public.user_achievements
  alter column earned_at set default timezone('utc', now());

update public.user_achievements
set earned_at = coalesce(earned_at, created_at, timezone('utc', now()))
where earned_at is null;

alter table public.user_achievements
  alter column earned_at set not null;

alter table public.user_achievements enable row level security;

drop policy if exists user_achievements_select_own on public.user_achievements;
drop policy if exists user_achievements_insert_own on public.user_achievements;

create policy user_achievements_select_own
on public.user_achievements
for select
to authenticated
using (auth.uid() = user_id);

create policy user_achievements_insert_own
on public.user_achievements
for insert
to authenticated
with check (auth.uid() = user_id);

revoke all on table public.user_achievements from authenticated;
revoke all on table public.user_achievements from anon;

grant select, insert
on table public.user_achievements
to authenticated;

with records_ranked as (
  select
    r.user_id,
    r.created_at,
    row_number() over (
      partition by r.user_id
      order by r.created_at asc, r.id asc
    ) as rn
  from public.records r
), record_thresholds as (
  select
    user_id,
    count(*)::int as total_records,
    min(created_at) as first_record_at,
    min(case when rn = 10 then created_at end) as tenth_record_at,
    min(case when rn = 50 then created_at end) as fiftieth_record_at,
    min(case when rn = 100 then created_at end) as hundredth_record_at
  from records_ranked
  group by user_id
), wishlist_ranked as (
  select
    w.user_id,
    w.created_at,
    row_number() over (
      partition by w.user_id
      order by w.created_at asc, w.id asc
    ) as rn
  from public.wishlist w
), wishlist_thresholds as (
  select
    user_id,
    count(*)::int as total_wishlist,
    min(case when rn = 1 then created_at end) as first_wishlist_at
  from wishlist_ranked
  group by user_id
), found_ranked as (
  select
    a.user_id,
    a.created_at,
    row_number() over (
      partition by a.user_id
      order by a.created_at asc, a.id asc
    ) as rn
  from public.activity a
  where a.entry ilike 'Found %'
), found_thresholds as (
  select
    user_id,
    count(*)::int as found_count,
    min(case when rn = 1 then created_at end) as first_found_at
  from found_ranked
  group by user_id
), checkin_thresholds as (
  select
    s.user_id,
    coalesce(sum(greatest(coalesce(s.count, 0), 0)), 0)::int as total_checkins,
    min(s.created_at) as first_checkin_at
  from public.store_checkins s
  group by user_id
), notes_thresholds as (
  select
    user_id,
    count(*)::int as notes_count
  from public.records
  where coalesce(trim(notes), '') <> ''
  group by user_id
), ratings_thresholds as (
  select
    user_id,
    count(*)::int as rating_count
  from public.records
  where rating is not null and rating > 0
  group by user_id
), prices_thresholds as (
  select
    user_id,
    count(*)::int as price_count
  from public.records
  where coalesce(trim(price), '') <> ''
  group by user_id
), purchased_at_thresholds as (
  select
    user_id,
    count(*)::int as purchased_at_count
  from public.records
  where coalesce(trim("purchasedAt"), '') <> ''
  group by user_id
), user_metrics as (
  select
    u.id as user_id,
    coalesce(rt.total_records, 0) as total_records,
    rt.first_record_at,
    rt.tenth_record_at,
    rt.fiftieth_record_at,
    rt.hundredth_record_at,
    coalesce(wt.total_wishlist, 0) as total_wishlist,
    wt.first_wishlist_at,
    coalesce(ft.found_count, 0) as found_count,
    ft.first_found_at,
    coalesce(ct.total_checkins, 0) as total_checkins,
    ct.first_checkin_at,
    coalesce(nt.notes_count, 0) as notes_count,
    coalesce(rat.rating_count, 0) as rating_count,
    coalesce(pt.price_count, 0) as price_count,
    coalesce(pat.purchased_at_count, 0) as purchased_at_count
  from auth.users u
  left join record_thresholds rt on rt.user_id = u.id
  left join wishlist_thresholds wt on wt.user_id = u.id
  left join found_thresholds ft on ft.user_id = u.id
  left join checkin_thresholds ct on ct.user_id = u.id
  left join notes_thresholds nt on nt.user_id = u.id
  left join ratings_thresholds rat on rat.user_id = u.id
  left join prices_thresholds pt on pt.user_id = u.id
  left join purchased_at_thresholds pat on pat.user_id = u.id
), unlocked as (
  select user_id, 'first-record'::text as achievement_id, first_record_at as source_time
  from user_metrics where total_records >= 1
  union all
  select user_id, 'collector', coalesce(tenth_record_at, timezone('utc', now()))
  from user_metrics where total_records >= 10
  union all
  select user_id, 'archivist', coalesce(fiftieth_record_at, timezone('utc', now()))
  from user_metrics where total_records >= 50
  union all
  select user_id, 'vinyl-vault', coalesce(hundredth_record_at, timezone('utc', now()))
  from user_metrics where total_records >= 100
  union all
  select user_id, 'wishful-thinking', first_wishlist_at
  from user_metrics where total_wishlist >= 1
  union all
  select user_id, 'dream-found', first_found_at
  from user_metrics where found_count >= 1
  union all
  select user_id, 'first-check-in', coalesce(first_checkin_at, timezone('utc', now()))
  from user_metrics where total_checkins >= 1
  union all
  select user_id, 'crate-digger', timezone('utc', now())
  from user_metrics where total_checkins >= 5
  union all
  select user_id, 'road-trip', timezone('utc', now())
  from user_metrics where total_checkins >= 10
  union all
  select user_id, 'local-legend', timezone('utc', now())
  from user_metrics where total_checkins >= 25
  union all
  select user_id, 'storyteller', timezone('utc', now())
  from user_metrics where notes_count >= 5
  union all
  select user_id, 'critic', timezone('utc', now())
  from user_metrics where rating_count >= 5
  union all
  select user_id, 'receipt-keeper', timezone('utc', now())
  from user_metrics where price_count >= 5
  union all
  select user_id, 'memory-lane', timezone('utc', now())
  from user_metrics where purchased_at_count >= 5
)
insert into public.user_achievements (user_id, achievement_id, earned_at)
select
  user_id,
  achievement_id,
  coalesce(source_time, timezone('utc', now())) as earned_at
from unlocked
on conflict (user_id, achievement_id) do nothing;

update public.user_achievements
set earned_at = coalesce(earned_at, created_at, timezone('utc', now()))
where earned_at is null;

commit;
