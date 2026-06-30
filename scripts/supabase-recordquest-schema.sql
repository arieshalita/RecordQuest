create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.records (
  id bigint primary key,
  user_id uuid references auth.users (id) on delete cascade,
  album text not null default '',
  artist text not null default '',
  year text not null default '',
  genre text not null default '',
  cover text not null default '',
  "purchasedAt" text,
  "purchaseDate" text,
  condition text,
  price text,
  notes text,
  "favoriteTrack" text,
  rating integer,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.wishlist (
  id bigint primary key,
  user_id uuid references auth.users (id) on delete cascade,
  album text not null default '',
  artist text not null default '',
  year text not null default '',
  genre text not null default '',
  cover text not null default '',
  "purchasedAt" text,
  "purchaseDate" text,
  condition text,
  price text,
  notes text,
  "favoriteTrack" text,
  rating integer,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  entry text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.store_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  store_id text not null,
  count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.records add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.records add column if not exists album text not null default '';
alter table public.records add column if not exists artist text not null default '';
alter table public.records add column if not exists year text not null default '';
alter table public.records add column if not exists genre text not null default '';
alter table public.records add column if not exists cover text not null default '';
alter table public.records add column if not exists "purchasedAt" text;
alter table public.records add column if not exists "purchaseDate" text;
alter table public.records add column if not exists condition text;
alter table public.records add column if not exists price text;
alter table public.records add column if not exists notes text;
alter table public.records add column if not exists "favoriteTrack" text;
alter table public.records add column if not exists rating integer;

alter table public.wishlist add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.wishlist add column if not exists album text not null default '';
alter table public.wishlist add column if not exists artist text not null default '';
alter table public.wishlist add column if not exists year text not null default '';
alter table public.wishlist add column if not exists genre text not null default '';
alter table public.wishlist add column if not exists cover text not null default '';
alter table public.wishlist add column if not exists "purchasedAt" text;
alter table public.wishlist add column if not exists "purchaseDate" text;
alter table public.wishlist add column if not exists condition text;
alter table public.wishlist add column if not exists price text;
alter table public.wishlist add column if not exists notes text;
alter table public.wishlist add column if not exists "favoriteTrack" text;
alter table public.wishlist add column if not exists rating integer;

alter table public.activity add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.activity add column if not exists entry text not null default '';

alter table public.store_checkins add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.store_checkins add column if not exists store_id text not null default '';
alter table public.store_checkins add column if not exists count integer not null default 0;

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