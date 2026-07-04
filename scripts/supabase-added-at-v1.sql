-- Added Date Tracking v1 (additive migration)
-- Safe to run multiple times.

begin;

alter table if exists public.records
  add column if not exists added_at timestamptz;

update public.records
set added_at = coalesce(added_at, created_at, timezone('utc', now()))
where added_at is null;

alter table if exists public.records
  alter column added_at set default timezone('utc', now());

alter table if exists public.records
  alter column added_at set not null;

alter table if exists public.wishlist
  add column if not exists added_at timestamptz;

update public.wishlist
set added_at = coalesce(added_at, created_at, timezone('utc', now()))
where added_at is null;

alter table if exists public.wishlist
  alter column added_at set default timezone('utc', now());

alter table if exists public.wishlist
  alter column added_at set not null;

commit;
