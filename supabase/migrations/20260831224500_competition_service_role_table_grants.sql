-- Showdowns Competition Engine V1.7
-- Establish trusted backend-admin table access for service_role only.
-- No RLS or client-role policy changes.

grant select, insert, delete
on table public.competition_templates
to service_role;

grant select, insert, update, delete
on table public.competitions
to service_role;

grant select
on table public.competition_entries
to service_role;

grant select
on table public.competition_entry_scores
to service_role;

grant select
on table public.competition_votes
to service_role;

grant select
on table public.competition_awards
to service_role;