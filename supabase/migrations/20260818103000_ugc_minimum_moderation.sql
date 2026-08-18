-- Minimum UGC moderation controls for App Store Guideline 1.2.
-- Safe to run multiple times.

begin;

create table if not exists public.user_blocks (
  blocker_user_id uuid not null references auth.users (id) on delete cascade,
  blocked_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_user_id, blocked_user_id),
  constraint user_blocks_no_self_block check (blocker_user_id <> blocked_user_id)
);

create index if not exists user_blocks_blocked_user_id_idx
  on public.user_blocks (blocked_user_id);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_reports_no_self_report check (reporter_user_id <> reported_user_id),
  constraint user_reports_reason_not_blank check (
    char_length(trim(reason)) > 0
    and char_length(trim(reason)) <= 80
  ),
  constraint user_reports_details_max_length check (
    details is null
    or char_length(details) <= 500
  )
);

create index if not exists user_reports_reporter_user_id_idx
  on public.user_reports (reporter_user_id);

create index if not exists user_reports_reported_user_id_idx
  on public.user_reports (reported_user_id);

create index if not exists user_reports_created_at_idx
  on public.user_reports (created_at desc);

alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;

drop policy if exists user_blocks_select_involved on public.user_blocks;
drop policy if exists user_blocks_insert_own on public.user_blocks;
drop policy if exists user_blocks_delete_own on public.user_blocks;

create policy user_blocks_select_involved
on public.user_blocks
for select
to authenticated
using (auth.uid() = blocker_user_id or auth.uid() = blocked_user_id);

create policy user_blocks_insert_own
on public.user_blocks
for insert
to authenticated
with check (auth.uid() = blocker_user_id and blocker_user_id <> blocked_user_id);

create policy user_blocks_delete_own
on public.user_blocks
for delete
to authenticated
using (auth.uid() = blocker_user_id);

drop policy if exists user_reports_select_own on public.user_reports;
drop policy if exists user_reports_insert_own on public.user_reports;

create policy user_reports_select_own
on public.user_reports
for select
to authenticated
using (auth.uid() = reporter_user_id);

create policy user_reports_insert_own
on public.user_reports
for insert
to authenticated
with check (auth.uid() = reporter_user_id and reporter_user_id <> reported_user_id);

create or replace function public.on_user_block_cleanup_follows()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if to_regclass('public.user_follows') is not null then
    delete from public.user_follows
    where (
      follower_id = new.blocker_user_id and following_id = new.blocked_user_id
    )
    or (
      follower_id = new.blocked_user_id and following_id = new.blocker_user_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_user_block_cleanup_follows_trigger on public.user_blocks;
create trigger on_user_block_cleanup_follows_trigger
after insert on public.user_blocks
for each row execute function public.on_user_block_cleanup_follows();

revoke all on table public.user_blocks from anon;
revoke all on table public.user_reports from anon;

grant select, insert, delete on table public.user_blocks to authenticated;
grant select, insert on table public.user_reports to authenticated;

commit;
