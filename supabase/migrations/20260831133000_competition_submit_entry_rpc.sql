-- Showdowns Competition Engine V1.1
-- Secure submit-entry RPC for competition entries.

create or replace function public.submit_competition_entry(
  p_competition_id uuid,
  p_source_record_id bigint,
  p_caption text default null
)
returns public.competition_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid;
  v_now timestamptz := now();

  v_template_entry_mode text;
  v_template_min_year integer;
  v_template_max_year integer;
  v_template_genre text;
  v_template_is_active boolean;

  v_competition_is_cancelled boolean;
  v_submission_starts_at timestamptz;
  v_submission_ends_at timestamptz;

  v_record_album text;
  v_record_artist text;
  v_record_cover text;
  v_record_year text;
  v_record_genre text;

  v_caption_trimmed text;
  v_caption_validated text;

  v_year_trimmed text;
  v_year_value integer;

  v_inserted_entry public.competition_entries%rowtype;
  v_constraint_name text;
begin
  v_auth_user_id := auth.uid();

  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_competition_id is null then
    raise exception 'Competition id is required';
  end if;

  if p_source_record_id is null then
    raise exception 'Source record id is required';
  end if;

  select
    c.is_cancelled,
    c.submission_starts_at,
    c.submission_ends_at,
    t.entry_mode,
    t.min_year,
    t.max_year,
    t.genre,
    t.is_active
  into
    v_competition_is_cancelled,
    v_submission_starts_at,
    v_submission_ends_at,
    v_template_entry_mode,
    v_template_min_year,
    v_template_max_year,
    v_template_genre,
    v_template_is_active
  from public.competitions as c
  join public.competition_templates as t
    on t.id = c.template_id
  where c.id = p_competition_id;

  if not found then
    raise exception 'Competition not found';
  end if;

  if v_competition_is_cancelled then
    raise exception 'Competition is cancelled';
  end if;

  if v_now < v_submission_starts_at then
    raise exception 'Submission window has not started';
  end if;

  if v_now >= v_submission_ends_at then
    raise exception 'Submission window has ended';
  end if;

  if not v_template_is_active then
    raise exception 'Competition template is inactive';
  end if;

  if exists (
    select 1
    from public.competition_entries as ce
    where ce.competition_id = p_competition_id
      and ce.user_id = v_auth_user_id
  ) then
    raise exception 'You already entered this competition';
  end if;

  select
    r.album,
    r.artist,
    r.cover,
    r.year,
    r.genre
  into
    v_record_album,
    v_record_artist,
    v_record_cover,
    v_record_year,
    v_record_genre
  from public.records as r
  where r.id = p_source_record_id
    and r.user_id = v_auth_user_id;

  if not found then
    raise exception 'Source record not found or not owned by caller';
  end if;

  if p_caption is null then
    v_caption_trimmed := null;
  else
    v_caption_trimmed := btrim(p_caption);
  end if;

  if v_caption_trimmed is not null and char_length(v_caption_trimmed) > 280 then
    raise exception 'Caption must be 280 characters or fewer';
  end if;

  if v_template_entry_mode = 'album_only' then
    if v_caption_trimmed is not null and v_caption_trimmed <> '' then
      raise exception 'Caption is not allowed for this competition';
    end if;

    v_caption_validated := null;
  elsif v_template_entry_mode = 'album_plus_caption' then
    if p_caption is null then
      v_caption_validated := null;
    else
      if v_caption_trimmed = '' then
        raise exception 'Caption cannot be empty';
      end if;

      v_caption_validated := v_caption_trimmed;
    end if;
  elsif v_template_entry_mode = 'album_plus_purchase_info' then
    raise exception 'Entry mode album_plus_purchase_info is not supported yet';
  else
    raise exception 'Unsupported competition entry mode: %', v_template_entry_mode;
  end if;

  if v_template_min_year is not null or v_template_max_year is not null then
    v_year_trimmed := btrim(coalesce(v_record_year, ''));

    if v_year_trimmed !~ '^[0-9]{4}$' then
      raise exception 'Record year must be a four-digit year for this competition';
    end if;

    v_year_value := v_year_trimmed::integer;

    if v_template_min_year is not null and v_year_value < v_template_min_year then
      raise exception 'Record year is below the minimum allowed year';
    end if;

    if v_template_max_year is not null and v_year_value > v_template_max_year then
      raise exception 'Record year is above the maximum allowed year';
    end if;
  end if;

  if v_template_genre is not null then
    if lower(btrim(coalesce(v_record_genre, ''))) <> lower(btrim(v_template_genre)) then
      raise exception 'Record genre does not match the competition genre requirement';
    end if;
  end if;

  begin
    insert into public.competition_entries (
      competition_id,
      user_id,
      source_record_id,
      album_title,
      artist_name,
      cover_url,
      release_year,
      genre,
      release_id_snapshot,
      release_group_id_snapshot,
      caption,
      status
    )
    values (
      p_competition_id,
      v_auth_user_id,
      p_source_record_id,
      v_record_album,
      v_record_artist,
      coalesce(v_record_cover, ''),
      coalesce(v_record_year, ''),
      coalesce(v_record_genre, ''),
      null,
      null,
      v_caption_validated,
      'active'
    )
    returning * into v_inserted_entry;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      if v_constraint_name = 'competition_entries_competition_user_unique' then
        raise exception 'You already entered this competition';
      end if;

      raise;
  end;

  insert into public.competition_entry_scores (
    competition_id,
    entry_id,
    rating,
    wins,
    losses,
    appearances
  )
  values (
    p_competition_id,
    v_inserted_entry.id,
    1500,
    0,
    0,
    0
  );

  return v_inserted_entry;
end;
$$;

comment on function public.submit_competition_entry(uuid, bigint, text)
is 'Validates competition submission phase and source record ownership, snapshots the caller''s collection record into competition_entries, and initializes competition_entry_scores server-side.';

revoke execute on function public.submit_competition_entry(uuid, bigint, text) from public;
revoke execute on function public.submit_competition_entry(uuid, bigint, text) from anon;
grant execute on function public.submit_competition_entry(uuid, bigint, text) to authenticated;

-- Manual test cases (do not execute in migration):
-- 1) Unauthenticated caller is rejected with "Authentication required".
-- 2) Invalid competition id is rejected.
-- 3) Cancelled competition is rejected.
-- 4) Submission outside submission window is rejected.
-- 5) Source record not owned by caller is rejected.
-- 6) First valid submission creates one competition_entries row.
-- 7) Matching competition_entry_scores row is initialized with rating 1500, wins/losses/appearances 0.
-- 8) Second submission by same user for same competition is rejected with "You already entered this competition".
-- 9) Non-empty caption is rejected for album_only templates.
-- 10) Non-four-digit or out-of-range year is rejected when template has min_year or max_year restriction.
