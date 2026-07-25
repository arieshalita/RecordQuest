-- Add minimal, race-safe constraints for public.profiles.username.
-- Apply in Supabase SQL editor or migration pipeline.

alter table public.profiles
  add column if not exists username text;

-- Normalize existing values before enforcing lowercase and format checks.
update public.profiles
set username = lower(trim(username))
where username is not null;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_lowercase_chk'
  ) then
    alter table public.profiles
      add constraint profiles_username_lowercase_chk
      check (username = lower(username));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_format_chk'
  ) then
    alter table public.profiles
      add constraint profiles_username_format_chk
      check (username ~ '^[a-z0-9._]{3,24}$');
  end if;
end $$;
