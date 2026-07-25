-- Ensure public.profiles.user_id can be used as a safe upsert conflict target.
-- DO NOT APPLY until duplicate rows are manually reviewed.

-- Preflight (read-only):
-- select user_id, count(*)
-- from public.profiles
-- group by user_id
-- having count(*) > 1;

-- If the preflight query returns any rows, stop and resolve duplicates manually.

create unique index if not exists profiles_user_id_unique_idx
  on public.profiles (user_id)
  where user_id is not null;
