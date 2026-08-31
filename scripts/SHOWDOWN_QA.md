# Showdown Backend QA Harness

This document describes how to run the non-production Showdowns backend QA harness.

## Scope

The harness validates the existing backend lifecycle using real Supabase RPCs/tables:

- entry submission
- safe read boundaries
- matchmaking
- vote writes and Elo/counter updates
- finalization
- frozen results
- minimum participation no-award behavior
- privilege boundaries

It is intentionally designed for temporary QA users and temporary QA competitions only.

## Safety Rules

- Never run against unknown projects.
- Never hard-code or print secrets.
- Never use real user accounts.
- Cleanup deletes only IDs created during one QA run.
- This harness mutates the configured Supabase project.
- Verify EXPO_PUBLIC_SUPABASE_URL points to the intended RecordQuest project before running.

## Required Environment Variables

Use existing project naming where available:

- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

The script refuses to run if any required variable is missing.

Example PowerShell setup for current shell session:

```powershell
$env:EXPO_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

## Commands

Run full QA flow:

```bash
node scripts/showdown-backend-qa.mjs
```

Run full QA flow and always keep generated data (debug mode):

```bash
node scripts/showdown-backend-qa.mjs --keep-data
```

Cleanup only (explicit run id):

```bash
node scripts/showdown-backend-qa.mjs --cleanup --run-id <qa-run-id>
```

Cleanup only (latest saved run id if not provided):

```bash
node scripts/showdown-backend-qa.mjs --cleanup
```

## What the Harness Creates

Per run, the harness creates:

- 4 temporary QA auth users (A/B/C/D)
- 4 QA records in public.records
- one primary QA competition/template
- one secondary QA competition/template for minimum participation checks
- one timing-gate competition/template (results_at in past while finalized_at is null)
- one cancelled-visibility competition/template

Data is namespaced by a unique run id.

## Assertions Covered

Primary assertions include:

- entry submission success for A/B/C/D
- duplicate entry rejection
- cross-user source record rejection
- invalid competition rejection
- initial score initialization correctness
- overview/read anonymity boundaries
- matchup safety boundaries and own-entry exclusion
- first-vote Elo expectation (1516/1484)
- duplicate same pair and reversed pair rejection
- malformed vote rejection (winner not in pair, identical pair, self-vote)
- vote counter consistency against vote history
- matchmaking exhaustion behavior
- results hidden before results_at
- results hidden until finalization (results_at passed, finalized_at still null)
- finalization success and frozen placement integrity
- idempotent second finalization
- frozen placement ordering validated from finalized placement snapshots and results ordering
- minimum participation finalization with no winner award
- authenticated privilege denial for finalize_competition
- authenticated direct competition_awards table read denial
- winner trophy hidden before results_at
- public trophy RPC visible after results_at
- trophy RPC exposes only safe frozen metadata
- trophy RPC null user-id validation
- cancelled competition trophies are hidden

On RPC failures, debug output includes:

- RPC name
- expected behavior
- actual error message
- error code/status/details/hint if available
- QA user label
- competition id
- related entry ids

Secrets, tokens, passwords, and API keys are never printed.

## Cleanup Behavior

On fully successful QA run:

- cleanup runs automatically unless --keep-data is passed.

On failures:

- data is preserved by default.
- script prints run id and safe cleanup command.

Cleanup deletes only recorded created IDs:

- competitions
- templates
- auth users (records cascade-delete through existing auth.users FK)
- local state file for that run

State files are written to:

- scripts/.showdown-qa-state/<run-id>.json

## Notes

- The harness is a real integration test against a real Supabase project.
- It does not run migrations or db push.
- It should be reviewed before first execution in shared environments.
