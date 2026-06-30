-- RecordQuest Supabase schema
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.records (
  id bigint primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  album text not null default '',
  artist text not null default '',
  year text not null default '',
  genre text not null default '',
  cover text not null default '',
  "purchasedAt" text,
  "purchaseDate" text,
  "condition" text,
  price text,
  notes text,
  "favoriteTrack" text,
  rating integer
);

create table if not exists public.wishlist (
  id bigint primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  album text not null default '',
  artist text not null default '',
  year text not null default '',
  genre text not null default '',
  cover text not null default '',
  "purchasedAt" text,
  "purchaseDate" text,
  "condition" text,
  price text,
  notes text,
  "favoriteTrack" text,
  rating integer
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  entry text not null
);

create table if not exists public.store_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  store_id text not null,
  count integer not null default 0
);

alter table public.user_profiles add column if not exists id uuid default gen_random_uuid();
alter table public.user_profiles add column if not exists user_id uuid;
alter table public.user_profiles add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.user_profiles add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.user_profiles add column if not exists profile_name text;
alter table public.user_profiles add column if not exists bio text;
alter table public.user_profiles add column if not exists avatar text;
alter table public.user_profiles alter column user_id set not null;
alter table public.user_profiles alter column user_id type uuid using user_id::uuid;
alter table public.user_profiles add constraint user_profiles_user_id_key unique (user_id);
alter table public.user_profiles add constraint user_profiles_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.records add column if not exists user_id uuid;
alter table public.records add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.records add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.records add column if not exists album text not null default '';
alter table public.records add column if not exists artist text not null default '';
alter table public.records add column if not exists year text not null default '';
alter table public.records add column if not exists genre text not null default '';
alter table public.records add column if not exists cover text not null default '';
alter table public.records add column if not exists "purchasedAt" text;
alter table public.records add column if not exists "purchaseDate" text;
alter table public.records add column if not exists "condition" text;
alter table public.records add column if not exists price text;
alter table public.records add column if not exists notes text;
alter table public.records add column if not exists "favoriteTrack" text;
alter table public.records add column if not exists rating integer;

alter table public.wishlist add column if not exists user_id uuid;
alter table public.wishlist add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.wishlist add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.wishlist add column if not exists album text not null default '';
alter table public.wishlist add column if not exists artist text not null default '';
alter table public.wishlist add column if not exists year text not null default '';
alter table public.wishlist add column if not exists genre text not null default '';
alter table public.wishlist add column if not exists cover text not null default '';
alter table public.wishlist add column if not exists "purchasedAt" text;
alter table public.wishlist add column if not exists "purchaseDate" text;
alter table public.wishlist add column if not exists "condition" text;
alter table public.wishlist add column if not exists price text;
alter table public.wishlist add column if not exists notes text;
alter table public.wishlist add column if not exists "favoriteTrack" text;
alter table public.wishlist add column if not exists rating integer;

alter table public.activity add column if not exists user_id uuid;
alter table public.activity add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.activity add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.activity add column if not exists entry text not null default '';

alter table public.store_checkins add column if not exists user_id uuid;
alter table public.store_checkins add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.store_checkins add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.store_checkins add column if not exists store_id text not null default '';
alter table public.store_checkins add column if not exists count integer not null default 0;

update public.user_profiles set updated_at = updated_at;
update public.records set updated_at = updated_at;
update public.wishlist set updated_at = updated_at;
update public.activity set updated_at = updated_at;
update public.store_checkins set updated_at = updated_at;

create or replace function public.refresh_updated_at_user_profiles()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.refresh_updated_at_records()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.refresh_updated_at_wishlist()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.refresh_updated_at_activity()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.refresh_updated_at_store_checkins()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_updated_at_user_profiles on public.user_profiles;
create trigger set_updated_at_user_profiles
before update on public.user_profiles
for each row execute function public.refresh_updated_at_user_profiles();

drop trigger if exists set_updated_at_records on public.records;
create trigger set_updated_at_records
before update on public.records
for each row execute function public.refresh_updated_at_records();

drop trigger if exists set_updated_at_wishlist on public.wishlist;
create trigger set_updated_at_wishlist
before update on public.wishlist
for each row execute function public.refresh_updated_at_wishlist();

drop trigger if exists set_updated_at_activity on public.activity;
create trigger set_updated_at_activity
before update on public.activity
for each row execute function public.refresh_updated_at_activity();

drop trigger if exists set_updated_at_store_checkins on public.store_checkins;
create trigger set_updated_at_store_checkins
before update on public.store_checkins
for each row execute function public.refresh_updated_at_store_checkins();

alter table public.user_profiles enable row level security;
alter table public.records enable row level security;
alter table public.wishlist enable row level security;
alter table public.activity enable row level security;
alter table public.store_checkins enable row level security;

drop policy if exists user_profiles_select_own on public.user_profiles;
drop policy if exists user_profiles_insert_own on public.user_profiles;
drop policy if exists user_profiles_update_own on public.user_profiles;
drop policy if exists user_profiles_delete_own on public.user_profiles;

create policy user_profiles_select_own
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy user_profiles_insert_own
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy user_profiles_update_own
on public.user_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy user_profiles_delete_own
on public.user_profiles
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists records_select_own on public.records;
drop policy if exists records_insert_own on public.records;
drop policy if exists records_update_own on public.records;
drop policy if exists records_delete_own on public.records;

create policy records_select_own
on public.records
for select
to authenticated
using (auth.uid() = user_id);

create policy records_insert_own
on public.records
for insert
to authenticated
with check (auth.uid() = user_id);

create policy records_update_own
on public.records
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy records_delete_own
on public.records
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists wishlist_select_own on public.wishlist;
drop policy if exists wishlist_insert_own on public.wishlist;
drop policy if exists wishlist_update_own on public.wishlist;
drop policy if exists wishlist_delete_own on public.wishlist;

create policy wishlist_select_own
on public.wishlist
for select
to authenticated
using (auth.uid() = user_id);

create policy wishlist_insert_own
on public.wishlist
for insert
to authenticated
with check (auth.uid() = user_id);

create policy wishlist_update_own
on public.wishlist
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy wishlist_delete_own
on public.wishlist
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists activity_select_own on public.activity;
drop policy if exists activity_insert_own on public.activity;
drop policy if exists activity_update_own on public.activity;
drop policy if exists activity_delete_own on public.activity;

create policy activity_select_own
on public.activity
for select
to authenticated
using (auth.uid() = user_id);

create policy activity_insert_own
on public.activity
for insert
to authenticated
with check (auth.uid() = user_id);

create policy activity_update_own
on public.activity
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy activity_delete_own
on public.activity
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists store_checkins_select_own on public.store_checkins;
drop policy if exists store_checkins_insert_own on public.store_checkins;
drop policy if exists store_checkins_update_own on public.store_checkins;
drop policy if exists store_checkins_delete_own on public.store_checkins;

create policy store_checkins_select_own
on public.store_checkins
for select
to authenticated
using (auth.uid() = user_id);

create policy store_checkins_insert_own
on public.store_checkins
for insert
to authenticated
with check (auth.uid() = user_id);

create policy store_checkins_update_own
on public.store_checkins
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy store_checkins_delete_own
on public.store_checkins
for delete
to authenticated
using (auth.uid() = user_id);
