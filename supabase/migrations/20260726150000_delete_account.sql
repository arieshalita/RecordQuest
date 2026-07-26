-- Account deletion cleanup helper.
-- Safe to run multiple times.

begin;

create or replace function public.delete_recordquest_account_data(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cleanup_counts jsonb := '{}'::jsonb;
  deleted_rows integer;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if to_regclass('public.user_follows') is not null then
    execute 'delete from public.user_follows where follower_id = $1 or following_id = $1'
      using target_user_id;
    get diagnostics deleted_rows = row_count;
    cleanup_counts := cleanup_counts || jsonb_build_object('user_follows', deleted_rows);
  end if;

  if to_regclass('public.user_push_tokens') is not null then
    execute 'delete from public.user_push_tokens where user_id = $1'
      using target_user_id;
    get diagnostics deleted_rows = row_count;
    cleanup_counts := cleanup_counts || jsonb_build_object('user_push_tokens', deleted_rows);
  end if;

  if to_regclass('public.user_achievements') is not null then
    execute 'delete from public.user_achievements where user_id = $1'
      using target_user_id;
    get diagnostics deleted_rows = row_count;
    cleanup_counts := cleanup_counts || jsonb_build_object('user_achievements', deleted_rows);
  end if;

  if to_regclass('public.store_checkins') is not null then
    execute 'delete from public.store_checkins where user_id = $1'
      using target_user_id;
    get diagnostics deleted_rows = row_count;
    cleanup_counts := cleanup_counts || jsonb_build_object('store_checkins', deleted_rows);
  end if;

  if to_regclass('public.activity') is not null then
    execute 'delete from public.activity where user_id = $1'
      using target_user_id;
    get diagnostics deleted_rows = row_count;
    cleanup_counts := cleanup_counts || jsonb_build_object('activity', deleted_rows);
  end if;

  if to_regclass('public.wishlist') is not null then
    execute 'delete from public.wishlist where user_id = $1'
      using target_user_id;
    get diagnostics deleted_rows = row_count;
    cleanup_counts := cleanup_counts || jsonb_build_object('wishlist', deleted_rows);
  end if;

  if to_regclass('public.records') is not null then
    execute 'delete from public.records where user_id = $1'
      using target_user_id;
    get diagnostics deleted_rows = row_count;
    cleanup_counts := cleanup_counts || jsonb_build_object('records', deleted_rows);
  end if;

  if to_regclass('public.user_profiles') is not null then
    execute 'delete from public.user_profiles where user_id = $1'
      using target_user_id;
    get diagnostics deleted_rows = row_count;
    cleanup_counts := cleanup_counts || jsonb_build_object('user_profiles', deleted_rows);
  end if;

  if to_regclass('public.profiles') is not null then
    execute 'delete from public.profiles where user_id = $1'
      using target_user_id;
    get diagnostics deleted_rows = row_count;
    cleanup_counts := cleanup_counts || jsonb_build_object('profiles', deleted_rows);
  end if;

  return jsonb_build_object(
    'ok', true,
    'deleted_counts', cleanup_counts
  );
end;
$$;

revoke all on function public.delete_recordquest_account_data(uuid) from public;
revoke all on function public.delete_recordquest_account_data(uuid) from anon;
revoke all on function public.delete_recordquest_account_data(uuid) from authenticated;
grant execute on function public.delete_recordquest_account_data(uuid) to service_role;

commit;