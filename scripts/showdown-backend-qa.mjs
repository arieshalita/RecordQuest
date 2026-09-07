#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_DIR = path.join(__dirname, ".showdown-qa-state");

const REQUIRED_ENV = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

class QaTracker {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
  }

  pass(message) {
    this.passed += 1;
    console.log(`[PASS] ${message}`);
  }

  fail(message) {
    this.failed += 1;
    console.error(`[FAIL] ${message}`);
  }

  warn(message) {
    this.warnings += 1;
    console.warn(`[WARN] ${message}`);
  }

  summary() {
    console.log("\nSHOWDOWN BACKEND QA");
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log(`Warnings: ${this.warnings}`);
  }
}

function parseArgs(argv) {
  const args = {
    cleanup: false,
    runId: null,
    keepData: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--cleanup") {
      args.cleanup = true;
    } else if (token === "--run-id") {
      args.runId = argv[i + 1] ?? null;
      i += 1;
    } else if (token === "--keep-data") {
      args.keepData = true;
    }
  }

  return args;
}

function ensureEnv() {
  const missing = REQUIRED_ENV.filter((key) => {
    const value = process.env[key];
    return typeof value !== "string" || value.trim() === "";
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Refusing to run QA harness.`
    );
  }

  return {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL.trim(),
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY.trim(),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  };
}

function hasPermissionDenied(error) {
  const message = sanitizeError(error).message.toLowerCase();
  return message.includes("permission denied");
}

function adminPathBlocker(action, error) {
  const normalized = sanitizeError(error);
  return [
    `${action} failed: ${normalized.message}`,
    "No safe programmatic admin setup path exists in this repository for competitions/templates beyond direct service-role table access.",
    "Harness will not use psql/SUPABASE_DB_URL and will not weaken security. Add a trusted backend RPC/admin function if your environment blocks these writes.",
  ].join(" ");
}

function createAdminClient(env) {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function createAnonClient(env) {
  return createClient(env.supabaseUrl, env.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function nowMs() {
  return Date.now();
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function buildInitialCompetitionWindow() {
  const t = nowMs();
  return {
    submission_starts_at: iso(t - 30 * 60 * 1000),
    submission_ends_at: iso(t + 30 * 60 * 1000),
    voting_starts_at: iso(t + 60 * 60 * 1000),
    voting_ends_at: iso(t + 2 * 60 * 60 * 1000),
    results_at: iso(t + 3 * 60 * 60 * 1000),
  };
}

function buildVotingOpenWindow() {
  const t = nowMs();
  return {
    submission_starts_at: iso(t - 2 * 60 * 60 * 1000),
    submission_ends_at: iso(t - 60 * 60 * 1000),
    voting_starts_at: iso(t - 30 * 60 * 1000),
    voting_ends_at: iso(t + 30 * 60 * 1000),
    results_at: iso(t + 2 * 60 * 60 * 1000),
  };
}

function buildVotingClosedWindow() {
  const t = nowMs();
  return {
    submission_starts_at: iso(t - 3 * 60 * 60 * 1000),
    submission_ends_at: iso(t - 2 * 60 * 60 * 1000),
    voting_starts_at: iso(t - 90 * 60 * 1000),
    voting_ends_at: iso(t - 60 * 1000),
    results_at: iso(t + 60 * 60 * 1000),
  };
}

function buildResultsOpenWindow() {
  const t = nowMs();
  return {
    results_at: iso(t - 60 * 1000),
  };
}

function buildResultsPastUnfinalizedWindow() {
  const t = nowMs();
  return {
    submission_starts_at: iso(t - 5 * 60 * 60 * 1000),
    submission_ends_at: iso(t - 4 * 60 * 60 * 1000),
    voting_starts_at: iso(t - 3 * 60 * 60 * 1000),
    voting_ends_at: iso(t - 2 * 60 * 60 * 1000),
    results_at: iso(t - 60 * 1000),
  };
}

function normalizePair(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function numericCloseEnough(actual, expected, tolerance = 1e-6) {
  return Math.abs(actual - expected) <= tolerance;
}

function assertCondition(tracker, condition, passMessage, failMessage) {
  if (condition) {
    tracker.pass(passMessage);
    return true;
  }
  tracker.fail(failMessage);
  return false;
}

function sanitizeError(error) {
  if (!error || typeof error !== "object") {
    return {
      message: "Unknown error",
      code: null,
      details: null,
      hint: null,
      name: null,
      status: null,
    };
  }

  return {
    message: typeof error.message === "string" ? error.message : "Unknown error",
    code: typeof error.code === "string" ? error.code : null,
    details: typeof error.details === "string" ? error.details : null,
    hint: typeof error.hint === "string" ? error.hint : null,
    name: typeof error.name === "string" ? error.name : null,
    status: typeof error.status === "number" ? error.status : null,
  };
}

function printRpcFailureDebug({
  rpcName,
  expected,
  error,
  userLabel,
  competitionId,
  entryIds,
}) {
  const normalized = sanitizeError(error);
  console.error("[DEBUG] RPC failure");
  console.error(`  rpc: ${rpcName}`);
  console.error(`  expected: ${expected}`);
  console.error(`  actual message: ${normalized.message}`);
  console.error(`  code: ${normalized.code ?? "n/a"}`);
  console.error(`  status: ${normalized.status ?? "n/a"}`);
  console.error(`  details: ${normalized.details ?? "n/a"}`);
  console.error(`  hint: ${normalized.hint ?? "n/a"}`);
  console.error(`  qa user: ${userLabel ?? "n/a"}`);
  console.error(`  competition id: ${competitionId ?? "n/a"}`);
  console.error(`  entry ids: ${entryIds ? entryIds.join(", ") : "n/a"}`);
}

async function ensureStateDir() {
  await fs.mkdir(STATE_DIR, { recursive: true });
}

function stateFilePath(runId) {
  return path.join(STATE_DIR, `${runId}.json`);
}

async function saveState(state) {
  await ensureStateDir();
  await fs.writeFile(stateFilePath(state.runId), JSON.stringify(state, null, 2), "utf8");
}

async function loadState(runId) {
  const file = stateFilePath(runId);
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw);
}

async function resolveCleanupRunId(explicitRunId) {
  if (explicitRunId) {
    return explicitRunId;
  }

  await ensureStateDir();
  const files = await fs.readdir(STATE_DIR);
  const jsonFiles = files.filter((name) => name.endsWith(".json")).sort();

  if (jsonFiles.length === 0) {
    throw new Error("No QA state files found. Provide --run-id to cleanup a specific run.");
  }

  return jsonFiles[jsonFiles.length - 1].replace(/\.json$/, "");
}

function createQaState(runId) {
  return {
    runId,
    startedAt: new Date().toISOString(),
    users: [],
    templates: [],
    competitions: [],
    records: [],
    entriesByCompetition: {},
    notes: [],
  };
}

function createQaUsers(runId) {
  const suffixes = ["a", "b", "c", "d"];
  return suffixes.map((suffix, index) => {
    const label = String.fromCharCode(65 + index);
    const email = `recordquest-showdown-qa-${runId}-${suffix}@example.com`;
    const password = randomBytes(24).toString("base64url");
    return {
      label,
      email,
      password,
      userId: null,
      client: null,
      recordId: null,
      entryIdByCompetition: {},
    };
  });
}

async function upsertProfilesIfPossible(adminClient, users, tracker) {
  tracker.pass("Profile bootstrap skipped (Showdown RPC tests do not require profiles rows)");
}

async function createQaAuthUsers(adminClient, users, state) {
  for (const user of users) {
    const createResult = await adminClient.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        username: `qa_${user.label.toLowerCase()}_${state.runId}`,
        display_name: `QA ${user.label}`,
      },
    });

    if (createResult.error || !createResult.data.user) {
      throw new Error(
        `Failed to create QA user ${user.label}: ${sanitizeError(createResult.error).message}`
      );
    }

    user.userId = createResult.data.user.id;
    state.users.push({
      label: user.label,
      email: user.email,
      userId: user.userId,
    });

    await saveState(state);
  }
}

async function signInQaUsers(env, users) {
  for (const user of users) {
    const client = createAnonClient(env);
    const signInResult = await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });

    if (signInResult.error || !signInResult.data.session) {
      throw new Error(
        `Failed to sign in QA user ${user.label}: ${sanitizeError(signInResult.error).message}`
      );
    }

    user.client = client;
  }
}

async function createQaRecords(users, state, tracker) {
  const base = Number(`${Date.now()}`) * 100;

  for (let i = 0; i < users.length; i += 1) {
    const user = users[i];
    const recordId = base + i + 1;

    const insert = await user.client.from("records").insert({
      id: recordId,
      user_id: user.userId,
      album: `QA Album ${user.label}`,
      artist: `QA Artist ${user.label}`,
      year: "2000",
      genre: "QA",
      cover: `https://qa.example.com/${state.runId}/${user.label}.jpg`,
      purchasedAt: "",
      purchaseDate: "",
      condition: "",
      price: "",
      notes: `Showdown QA run ${state.runId}`,
      favoriteTrack: "",
      rating: 5,
    });

    if (insert.error) {
      throw new Error(`Failed to create QA record ${user.label}: ${sanitizeError(insert.error).message}`);
    }

    user.recordId = recordId;
    state.records.push({ id: recordId, userId: user.userId, label: user.label });
    await saveState(state);
    tracker.pass(`Created QA record for user ${user.label}`);
  }
}

async function createTemplate(adminClient, state, minimumEntriesForAward = 3) {
  const slug = `qa-showdown-${state.runId}-${Math.floor(Math.random() * 100000)}`;
  const templateInsert = await adminClient
    .from("competition_templates")
    .insert({
      slug,
      title: `QA Showdown Template ${state.runId}`,
      description: `QA template for showdown backend run ${state.runId}`,
      entry_mode: "album_only",
      scoring_method: "elo",
      is_active: true,
    })
    .select("id,slug")
    .single();

  if (templateInsert.error || !templateInsert.data) {
    if (hasPermissionDenied(templateInsert.error)) {
      throw new Error(adminPathBlocker("Failed to create QA template", templateInsert.error));
    }

    throw new Error(`Failed to create QA template: ${sanitizeError(templateInsert.error).message}`);
  }

  const template = templateInsert.data;
  state.templates.push(template.id);
  await saveState(state);

  const initialWindow = buildInitialCompetitionWindow();
  const competitionInsert = await adminClient
    .from("competitions")
    .insert({
      template_id: template.id,
      title: `QA Showdown Competition ${state.runId}`,
      description: `QA competition for showdown backend run ${state.runId}`,
      ...initialWindow,
      minimum_entries_for_award: minimumEntriesForAward,
      is_cancelled: false,
    })
    .select("id,template_id,minimum_entries_for_award")
    .single();

  if (competitionInsert.error || !competitionInsert.data) {
    if (hasPermissionDenied(competitionInsert.error)) {
      throw new Error(adminPathBlocker("Failed to create QA competition", competitionInsert.error));
    }

    throw new Error(`Failed to create QA competition: ${sanitizeError(competitionInsert.error).message}`);
  }

  const competition = competitionInsert.data;
  state.competitions.push(competition.id);
  state.entriesByCompetition[competition.id] = [];
  await saveState(state);

  return competition;
}

async function updateCompetitionWindow(adminClient, competitionId, patch) {
  const result = await adminClient
    .from("competitions")
    .update(patch)
    .eq("id", competitionId);

  if (result.error) {
    if (hasPermissionDenied(result.error)) {
      throw new Error(
        adminPathBlocker(`Failed to update competition ${competitionId} window`, result.error)
      );
    }

    throw new Error(
      `Failed to update competition ${competitionId} window: ${sanitizeError(result.error).message}`
    );
  }
}

async function rpcExpectFailure({
  tracker,
  client,
  rpcName,
  params,
  expectedLabel,
  expectedMessageIncludes,
  userLabel,
  competitionId,
  entryIds,
}) {
  const { error } = await client.rpc(rpcName, params);
  if (!error) {
    tracker.fail(`${expectedLabel} (call unexpectedly succeeded)`);
    return;
  }

  const message = sanitizeError(error).message.toLowerCase();
  const expectList = Array.isArray(expectedMessageIncludes)
    ? expectedMessageIncludes
    : [expectedMessageIncludes];
  const matched = expectList.some((needle) => message.includes(needle.toLowerCase()));

  if (!matched) {
    tracker.fail(`${expectedLabel} (wrong error)`);
    printRpcFailureDebug({
      rpcName,
      expected: `error containing: ${expectList.join(" | ")}`,
      error,
      userLabel,
      competitionId,
      entryIds,
    });
    return;
  }

  tracker.pass(expectedLabel);
}

async function fetchActiveEntries(adminClient, competitionId) {
  const result = await adminClient
    .from("competition_entries")
    .select("id,competition_id,user_id,status,album_title,artist_name,submitted_at,final_placement")
    .eq("competition_id", competitionId)
    .eq("status", "active")
    .order("submitted_at", { ascending: true })
    .order("id", { ascending: true });

  if (result.error) {
    if (hasPermissionDenied(result.error)) {
      throw new Error(adminPathBlocker("Failed to fetch active entries", result.error));
    }

    throw new Error(`Failed to fetch active entries: ${sanitizeError(result.error).message}`);
  }

  return result.data ?? [];
}

async function fetchScores(adminClient, competitionId) {
  const result = await adminClient
    .from("competition_entry_scores")
    .select("competition_id,entry_id,rating,wins,losses,appearances")
    .eq("competition_id", competitionId);

  if (result.error) {
    if (hasPermissionDenied(result.error)) {
      throw new Error(adminPathBlocker("Failed to fetch score rows", result.error));
    }

    throw new Error(`Failed to fetch score rows: ${sanitizeError(result.error).message}`);
  }

  return result.data ?? [];
}

async function fetchVotes(adminClient, competitionId) {
  const result = await adminClient
    .from("competition_votes")
    .select(
      "id,competition_id,voter_user_id,entry_a_id,entry_b_id,winner_entry_id,normalized_entry_low_id,normalized_entry_high_id"
    )
    .eq("competition_id", competitionId);

  if (result.error) {
    if (hasPermissionDenied(result.error)) {
      throw new Error(adminPathBlocker("Failed to fetch vote rows", result.error));
    }

    throw new Error(`Failed to fetch vote rows: ${sanitizeError(result.error).message}`);
  }

  return result.data ?? [];
}

async function fetchAwards(adminClient, competitionId) {
  const result = await adminClient
    .from("competition_awards")
    .select("id,competition_id,entry_id,user_id,award_type,placement,awarded_at")
    .eq("competition_id", competitionId);

  if (result.error) {
    if (hasPermissionDenied(result.error)) {
      throw new Error(adminPathBlocker("Failed to fetch awards", result.error));
    }

    throw new Error(`Failed to fetch awards: ${sanitizeError(result.error).message}`);
  }

  return result.data ?? [];
}

async function cleanupRun(adminClient, state, tracker) {
  const problems = [];

  const safeDelete = async (label, action) => {
    try {
      await action();
      if (tracker) {
        tracker.pass(label);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown cleanup error";
      problems.push(`${label}: ${message}`);
      if (tracker) {
        tracker.warn(`${label} failed: ${message}`);
      }
    }
  };

  for (const competitionId of state.competitions) {
    await safeDelete(`Cleanup competition ${competitionId}`, async () => {
      const { error } = await adminClient.from("competitions").delete().eq("id", competitionId);
      if (error) {
        if (hasPermissionDenied(error)) {
          throw new Error(adminPathBlocker(`Cleanup competition ${competitionId}`, error));
        }

        throw new Error(sanitizeError(error).message);
      }
    });
  }

  for (const templateId of state.templates) {
    await safeDelete(`Cleanup template ${templateId}`, async () => {
      const { error } = await adminClient.from("competition_templates").delete().eq("id", templateId);
      if (error) {
        if (hasPermissionDenied(error)) {
          throw new Error(adminPathBlocker(`Cleanup template ${templateId}`, error));
        }

        throw new Error(sanitizeError(error).message);
      }
    });
  }

  for (const user of state.users) {
    await safeDelete(`Cleanup auth user ${user.label}`, async () => {
      const response = await adminClient.auth.admin.deleteUser(user.userId);
      if (response.error) {
        throw new Error(sanitizeError(response.error).message);
      }
    });
  }

  if (problems.length === 0) {
    try {
      await fs.unlink(stateFilePath(state.runId));
      if (tracker) {
        tracker.pass(`Removed QA state file for run ${state.runId}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown state-file cleanup error";
      problems.push(`Failed to remove state file: ${message}`);
      if (tracker) {
        tracker.warn(`Failed to remove state file for run ${state.runId}: ${message}`);
      }
    }
  }

  return problems;
}

async function runCleanupOnly(env, runIdArg) {
  const tracker = new QaTracker();
  const adminClient = createAdminClient(env);
  const runId = await resolveCleanupRunId(runIdArg);
  const state = await loadState(runId);

  console.log(`Starting cleanup for QA run: ${runId}`);
  const problems = await cleanupRun(adminClient, state, tracker);
  tracker.summary();

  if (problems.length > 0) {
    process.exitCode = 1;
  }
}

async function runQa() {
  const args = parseArgs(process.argv.slice(2));
  const env = ensureEnv();

  if (args.cleanup) {
    await runCleanupOnly(env, args.runId);
    return;
  }

  const tracker = new QaTracker();
  const adminClient = createAdminClient(env);
  const runId = `${Date.now()}`;
  const state = createQaState(runId);
  await saveState(state);

  const users = createQaUsers(runId);
  const userMap = {};

  try {
    console.log(`Showdown QA run id: ${runId}`);

    await createQaAuthUsers(adminClient, users, state);
    tracker.pass("Created 4 temporary QA auth users");

    await upsertProfilesIfPossible(adminClient, users, tracker);

    await signInQaUsers(env, users);
    tracker.pass("Signed in all QA users with anon client auth");

    for (const user of users) {
      userMap[user.label] = user;
    }

    await createQaRecords(users, state, tracker);

    const competition1 = await createTemplate(adminClient, state, 3);
    tracker.pass("Created QA template and primary QA competition");

    const submitCompetitionId = competition1.id;

    const submitUser = async (label) => {
      const user = userMap[label];
      const { data, error } = await user.client.rpc("submit_competition_entry", {
        p_competition_id: submitCompetitionId,
        p_source_record_id: user.recordId,
        p_caption: null,
      });

      if (error || !data) {
        throw new Error(
          `submit_competition_entry failed for ${label}: ${sanitizeError(error).message}`
        );
      }

      user.entryIdByCompetition[submitCompetitionId] = data.id;
      state.entriesByCompetition[submitCompetitionId].push(data.id);
      await saveState(state);
      tracker.pass(`User ${label} submitted own record`);
    };

    await submitUser("B");
    await submitUser("C");
    await submitUser("D");

    await rpcExpectFailure({
      tracker,
      client: userMap.A.client,
      rpcName: "submit_competition_entry",
      params: {
        p_competition_id: submitCompetitionId,
        p_source_record_id: userMap.B.recordId,
        p_caption: null,
      },
      expectedLabel: "Cross-user record submission rejected",
      expectedMessageIncludes: "not found or not owned",
      userLabel: "A",
      competitionId: submitCompetitionId,
    });

    await submitUser("A");

    await rpcExpectFailure({
      tracker,
      client: userMap.A.client,
      rpcName: "submit_competition_entry",
      params: {
        p_competition_id: submitCompetitionId,
        p_source_record_id: userMap.A.recordId,
        p_caption: null,
      },
      expectedLabel: "Duplicate submission rejected",
      expectedMessageIncludes: "already entered",
      userLabel: "A",
      competitionId: submitCompetitionId,
    });

    await rpcExpectFailure({
      tracker,
      client: userMap.A.client,
      rpcName: "submit_competition_entry",
      params: {
        p_competition_id: randomUUID(),
        p_source_record_id: userMap.A.recordId,
        p_caption: null,
      },
      expectedLabel: "Invalid competition rejected for entry submission",
      expectedMessageIncludes: "competition not found",
      userLabel: "A",
      competitionId: "invalid-uuid",
    });

    const entriesAfterSubmit = await fetchActiveEntries(adminClient, submitCompetitionId);
    assertCondition(
      tracker,
      entriesAfterSubmit.length === 4,
      "Exactly four active entries exist",
      `Expected 4 active entries, found ${entriesAfterSubmit.length}`
    );

    const scoresAfterSubmit = await fetchScores(adminClient, submitCompetitionId);
    assertCondition(
      tracker,
      scoresAfterSubmit.length === 4,
      "Exactly four score rows exist",
      `Expected 4 score rows, found ${scoresAfterSubmit.length}`
    );

    const allInitialScoresOk = scoresAfterSubmit.every((row) => {
      const rating = Number(row.rating);
      return rating === 1500 && row.wins === 0 && row.losses === 0 && row.appearances === 0;
    });
    assertCondition(
      tracker,
      allInitialScoresOk,
      "Initial scores are 1500 with zeroed counters",
      "Initial score state mismatch"
    );

    const snapshotFieldsPresent = entriesAfterSubmit.every(
      (row) => row.album_title && row.artist_name
    );
    assertCondition(
      tracker,
      snapshotFieldsPresent,
      "Entry snapshots contain album and artist data",
      "Missing entry snapshot album/artist data"
    );

    const overviewA = await userMap.A.client.rpc("get_competition_overview", {
      p_competition_id: submitCompetitionId,
    });
    if (overviewA.error || !Array.isArray(overviewA.data) || overviewA.data.length !== 1) {
      tracker.fail("Overview RPC returned unexpected result");
      printRpcFailureDebug({
        rpcName: "get_competition_overview",
        expected: "single row overview",
        error: overviewA.error,
        userLabel: "A",
        competitionId: submitCompetitionId,
      });
    } else {
      const row = overviewA.data[0];
      const forbidden = ["rating", "wins", "losses", "appearances", "vote_total", "user_id"];
      const leaks = forbidden.filter((key) => Object.prototype.hasOwnProperty.call(row, key));
      assertCondition(
        tracker,
        leaks.length === 0,
        "Overview does not expose scores, vote totals, or user identities",
        `Overview exposed forbidden fields: ${leaks.join(", ")}`
      );
    }

    const myEntryA = await userMap.A.client.rpc("get_my_competition_entry", {
      p_competition_id: submitCompetitionId,
    });
    if (myEntryA.error || !Array.isArray(myEntryA.data) || myEntryA.data.length !== 1) {
      tracker.fail("Own-entry RPC returned unexpected result for user A");
      printRpcFailureDebug({
        rpcName: "get_my_competition_entry",
        expected: "one row for own entry",
        error: myEntryA.error,
        userLabel: "A",
        competitionId: submitCompetitionId,
      });
    } else {
      const row = myEntryA.data[0];
      assertCondition(
        tracker,
        row.album_title === "QA Album A" && row.artist_name === "QA Artist A",
        "Own-entry endpoint returns user A snapshot",
        "Own-entry endpoint returned unexpected snapshot for user A"
      );
    }

    await updateCompetitionWindow(adminClient, submitCompetitionId, buildVotingOpenWindow());
    tracker.pass("Moved primary competition into voting phase");

    const firstMatchup = await userMap.A.client.rpc("get_next_competition_matchup", {
      p_competition_id: submitCompetitionId,
    });

    let firstPair = null;
    if (firstMatchup.error || !Array.isArray(firstMatchup.data) || firstMatchup.data.length !== 1) {
      tracker.fail("Matchup endpoint failed to return one matchup for user A");
      printRpcFailureDebug({
        rpcName: "get_next_competition_matchup",
        expected: "one matchup row",
        error: firstMatchup.error,
        userLabel: "A",
        competitionId: submitCompetitionId,
      });
    } else {
      const row = firstMatchup.data[0];
      const distinctIds = row.entry_a_id && row.entry_b_id && row.entry_a_id !== row.entry_b_id;
      const ownEntry = userMap.A.entryIdByCompetition[submitCompetitionId];
      const excludesOwn = row.entry_a_id !== ownEntry && row.entry_b_id !== ownEntry;
      const noIdentityLeak = !Object.prototype.hasOwnProperty.call(row, "user_id");
      const noScoreLeak =
        !Object.prototype.hasOwnProperty.call(row, "rating") &&
        !Object.prototype.hasOwnProperty.call(row, "wins") &&
        !Object.prototype.hasOwnProperty.call(row, "losses") &&
        !Object.prototype.hasOwnProperty.call(row, "appearances");

      assertCondition(
        tracker,
        distinctIds,
        "Matchup returns two distinct entries",
        "Matchup returned identical or missing entry ids"
      );
      assertCondition(
        tracker,
        excludesOwn,
        "Matchup excludes caller own entry",
        "Matchup incorrectly included caller own entry"
      );
      assertCondition(
        tracker,
        noIdentityLeak && noScoreLeak,
        "Matchup response hides identities and score internals",
        "Matchup response exposed identity or score fields"
      );

      firstPair = {
        entryA: row.entry_a_id,
        entryB: row.entry_b_id,
      };
    }

    if (!firstPair) {
      throw new Error("Cannot continue voting tests without first matchup pair.");
    }

    const firstVote = await userMap.A.client.rpc("submit_competition_vote", {
      p_competition_id: submitCompetitionId,
      p_entry_a_id: firstPair.entryA,
      p_entry_b_id: firstPair.entryB,
      p_winner_entry_id: firstPair.entryA,
    });

    if (firstVote.error) {
      tracker.fail("First valid vote failed");
      printRpcFailureDebug({
        rpcName: "submit_competition_vote",
        expected: "successful vote",
        error: firstVote.error,
        userLabel: "A",
        competitionId: submitCompetitionId,
        entryIds: [firstPair.entryA, firstPair.entryB],
      });
    } else {
      tracker.pass("First valid vote succeeded");
    }

    const votesAfterFirst = await fetchVotes(adminClient, submitCompetitionId);
    assertCondition(
      tracker,
      votesAfterFirst.length === 1,
      "Exactly one vote row added after first vote",
      `Expected 1 vote row after first vote, found ${votesAfterFirst.length}`
    );

    const scoresAfterFirst = await fetchScores(adminClient, submitCompetitionId);
    const scoreMapFirst = new Map(scoresAfterFirst.map((s) => [s.entry_id, s]));
    const winnerScoreFirst = scoreMapFirst.get(firstPair.entryA);
    const loserScoreFirst = scoreMapFirst.get(firstPair.entryB);

    const firstCountersValid =
      winnerScoreFirst &&
      loserScoreFirst &&
      winnerScoreFirst.appearances === 1 &&
      loserScoreFirst.appearances === 1 &&
      winnerScoreFirst.wins === 1 &&
      winnerScoreFirst.losses === 0 &&
      loserScoreFirst.wins === 0 &&
      loserScoreFirst.losses === 1;

    assertCondition(
      tracker,
      Boolean(firstCountersValid),
      "First vote counters incremented correctly",
      "First vote counters did not match expected values"
    );

    const winnerRating = Number(winnerScoreFirst?.rating);
    const loserRating = Number(loserScoreFirst?.rating);
    const firstEloCorrect =
      numericCloseEnough(winnerRating, 1516) && numericCloseEnough(loserRating, 1484);

    assertCondition(
      tracker,
      firstEloCorrect,
      "First Elo result = 1516 / 1484",
      `Unexpected first Elo values winner=${winnerRating}, loser=${loserRating}`
    );

    await rpcExpectFailure({
      tracker,
      client: userMap.A.client,
      rpcName: "submit_competition_vote",
      params: {
        p_competition_id: submitCompetitionId,
        p_entry_a_id: firstPair.entryA,
        p_entry_b_id: firstPair.entryB,
        p_winner_entry_id: firstPair.entryA,
      },
      expectedLabel: "Duplicate same-order pair vote rejected",
      expectedMessageIncludes: "already voted",
      userLabel: "A",
      competitionId: submitCompetitionId,
      entryIds: [firstPair.entryA, firstPair.entryB],
    });

    await rpcExpectFailure({
      tracker,
      client: userMap.A.client,
      rpcName: "submit_competition_vote",
      params: {
        p_competition_id: submitCompetitionId,
        p_entry_a_id: firstPair.entryB,
        p_entry_b_id: firstPair.entryA,
        p_winner_entry_id: firstPair.entryB,
      },
      expectedLabel: "Duplicate reversed pair vote rejected",
      expectedMessageIncludes: "already voted",
      userLabel: "A",
      competitionId: submitCompetitionId,
      entryIds: [firstPair.entryB, firstPair.entryA],
    });

    await rpcExpectFailure({
      tracker,
      client: userMap.A.client,
      rpcName: "submit_competition_vote",
      params: {
        p_competition_id: submitCompetitionId,
        p_entry_a_id: firstPair.entryA,
        p_entry_b_id: firstPair.entryB,
        p_winner_entry_id: randomUUID(),
      },
      expectedLabel: "Winner-not-in-pair vote rejected",
      expectedMessageIncludes: "must match one of the matchup entries",
      userLabel: "A",
      competitionId: submitCompetitionId,
      entryIds: [firstPair.entryA, firstPair.entryB],
    });

    await rpcExpectFailure({
      tracker,
      client: userMap.A.client,
      rpcName: "submit_competition_vote",
      params: {
        p_competition_id: submitCompetitionId,
        p_entry_a_id: firstPair.entryA,
        p_entry_b_id: firstPair.entryA,
        p_winner_entry_id: firstPair.entryA,
      },
      expectedLabel: "Identical A/B vote rejected",
      expectedMessageIncludes: "entry ids must be distinct",
      userLabel: "A",
      competitionId: submitCompetitionId,
      entryIds: [firstPair.entryA, firstPair.entryA],
    });

    const ownEntryA = userMap.A.entryIdByCompetition[submitCompetitionId];
    const nonOwnEntry = ownEntryA === firstPair.entryA ? firstPair.entryB : firstPair.entryA;

    await rpcExpectFailure({
      tracker,
      client: userMap.A.client,
      rpcName: "submit_competition_vote",
      params: {
        p_competition_id: submitCompetitionId,
        p_entry_a_id: ownEntryA,
        p_entry_b_id: nonOwnEntry,
        p_winner_entry_id: nonOwnEntry,
      },
      expectedLabel: "Self-vote attempt rejected",
      expectedMessageIncludes: "cannot vote on your own entry",
      userLabel: "A",
      competitionId: submitCompetitionId,
      entryIds: [ownEntryA, nonOwnEntry],
    });

    const doOneValidVote = async (label) => {
      const user = userMap[label];
      const matchup = await user.client.rpc("get_next_competition_matchup", {
        p_competition_id: submitCompetitionId,
      });

      if (matchup.error) {
        tracker.fail(`Matchup fetch failed for user ${label}`);
        printRpcFailureDebug({
          rpcName: "get_next_competition_matchup",
          expected: "successful matchup fetch",
          error: matchup.error,
          userLabel: label,
          competitionId: submitCompetitionId,
        });
        return false;
      }

      if (!Array.isArray(matchup.data) || matchup.data.length === 0) {
        tracker.warn(`No matchup available for user ${label}`);
        return false;
      }

      const row = matchup.data[0];
      const vote = await user.client.rpc("submit_competition_vote", {
        p_competition_id: submitCompetitionId,
        p_entry_a_id: row.entry_a_id,
        p_entry_b_id: row.entry_b_id,
        p_winner_entry_id: row.entry_a_id,
      });

      if (vote.error) {
        tracker.fail(`Valid vote attempt failed for user ${label}`);
        printRpcFailureDebug({
          rpcName: "submit_competition_vote",
          expected: "successful vote",
          error: vote.error,
          userLabel: label,
          competitionId: submitCompetitionId,
          entryIds: [row.entry_a_id, row.entry_b_id],
        });
        return false;
      }

      tracker.pass(`User ${label} completed a valid matchup vote`);
      return true;
    };

    await doOneValidVote("B");
    await doOneValidVote("C");
    await doOneValidVote("D");

    const votesAfterMore = await fetchVotes(adminClient, submitCompetitionId);
    const dedupe = new Set();
    let duplicateFound = false;

    for (const vote of votesAfterMore) {
      const pair = normalizePair(vote.normalized_entry_low_id, vote.normalized_entry_high_id);
      const key = `${vote.voter_user_id}|${pair}`;
      if (dedupe.has(key)) {
        duplicateFound = true;
        break;
      }
      dedupe.add(key);
    }

    assertCondition(
      tracker,
      !duplicateFound,
      "No duplicate normalized voter/pair vote rows",
      "Duplicate normalized voter/pair vote rows detected"
    );

    const scoresForConsistency = await fetchScores(adminClient, submitCompetitionId);
    const consistencyMap = new Map();

    for (const entry of entriesAfterSubmit) {
      consistencyMap.set(entry.id, { appearances: 0, wins: 0, losses: 0 });
    }

    for (const vote of votesAfterMore) {
      const winnerId = vote.winner_entry_id;
      const participants = [vote.entry_a_id, vote.entry_b_id];
      for (const participant of participants) {
        const item = consistencyMap.get(participant);
        if (item) {
          item.appearances += 1;
        }
      }
      const winner = consistencyMap.get(winnerId);
      if (winner) {
        winner.wins += 1;
      }
    }

    for (const [entryId, item] of consistencyMap.entries()) {
      item.losses = item.appearances - item.wins;
      consistencyMap.set(entryId, item);
    }

    let consistencyOk = true;
    for (const row of scoresForConsistency) {
      const expected = consistencyMap.get(row.entry_id);
      if (!expected) {
        consistencyOk = false;
        break;
      }
      if (
        expected.appearances !== row.appearances ||
        expected.wins !== row.wins ||
        expected.losses !== row.losses
      ) {
        consistencyOk = false;
        break;
      }
    }

    assertCondition(
      tracker,
      consistencyOk,
      "Vote counters consistent with vote history",
      "Vote counters inconsistent with vote history"
    );

    const duplicateCompetition = await createTemplate(adminClient, state, 3);
    tracker.pass("Created duplicate-album guard QA competition");

    const duplicateCompetitionId = duplicateCompetition.id;

    const duplicateRecordIdC = Number(`${Date.now()}`) * 100 + 50;
    const duplicateRecordInsertC = await userMap.C.client.from("records").insert({
      id: duplicateRecordIdC,
      user_id: userMap.C.userId,
      album: "  qa album b ",
      artist: "QA ARTIST B  ",
      year: "2001",
      genre: "QA",
      cover: `https://qa.example.com/${state.runId}/C-duplicate.jpg`,
      purchasedAt: "",
      purchaseDate: "",
      condition: "",
      price: "",
      notes: `Showdown QA duplicate album run ${state.runId}`,
      favoriteTrack: "",
      rating: 5,
    });

    if (duplicateRecordInsertC.error) {
      throw new Error(
        `Failed to create duplicate QA record for user C: ${sanitizeError(duplicateRecordInsertC.error).message}`
      );
    }

    state.records.push({ id: duplicateRecordIdC, userId: userMap.C.userId, label: "C-duplicate" });
    await saveState(state);
    tracker.pass("Created duplicate-normalized source record for user C");

    const submitDuplicateCompetitionUser = async (label, sourceRecordId) => {
      const user = userMap[label];
      const recordId = sourceRecordId ?? user.recordId;
      const { data, error } = await user.client.rpc("submit_competition_entry", {
        p_competition_id: duplicateCompetitionId,
        p_source_record_id: recordId,
        p_caption: null,
      });

      if (error || !data) {
        throw new Error(
          `submit_competition_entry failed for ${label} in duplicate competition: ${sanitizeError(error).message}`
        );
      }

      user.entryIdByCompetition[duplicateCompetitionId] = data.id;
      state.entriesByCompetition[duplicateCompetitionId].push(data.id);
      await saveState(state);
      tracker.pass(`User ${label} submitted to duplicate-album competition`);
    };

    await submitDuplicateCompetitionUser("A");
    await submitDuplicateCompetitionUser("B");
    await submitDuplicateCompetitionUser("C", duplicateRecordIdC);
    await submitDuplicateCompetitionUser("D");

    const duplicateEntries = await fetchActiveEntries(adminClient, duplicateCompetitionId);
    assertCondition(
      tracker,
      duplicateEntries.length === 4,
      "Duplicate-album competition has four active entries",
      `Expected 4 active entries in duplicate competition, found ${duplicateEntries.length}`
    );

    const entryB = duplicateEntries.find((row) => row.user_id === userMap.B.userId);
    const entryC = duplicateEntries.find((row) => row.user_id === userMap.C.userId);

    if (!entryB || !entryC) {
      throw new Error("Duplicate competition is missing required user B/C entries for guard validation.");
    }

    const duplicateAlbumAllowed =
      Boolean(entryB) &&
      Boolean(entryC) &&
      entryB.album_title.trim().toLowerCase() === entryC.album_title.trim().toLowerCase() &&
      entryB.artist_name.trim().toLowerCase() === entryC.artist_name.trim().toLowerCase();

    assertCondition(
      tracker,
      duplicateAlbumAllowed,
      "Different users can submit the same normalized album+artist",
      "Failed to persist duplicate-normalized album+artist entries for different users"
    );

    await updateCompetitionWindow(adminClient, duplicateCompetitionId, buildVotingOpenWindow());
    tracker.pass("Moved duplicate-album competition into voting phase");

    const duplicatePairKey = entryB && entryC ? normalizePair(entryB.id, entryC.id) : null;
    let duplicatePairServed = false;
    let duplicateCompetitionValidVoteCount = 0;

    for (let i = 0; i < 8; i += 1) {
      const matchup = await userMap.A.client.rpc("get_next_competition_matchup", {
        p_competition_id: duplicateCompetitionId,
      });

      if (matchup.error) {
        tracker.fail("Duplicate-album competition matchup fetch failed");
        printRpcFailureDebug({
          rpcName: "get_next_competition_matchup",
          expected: "successful matchup/zero-row",
          error: matchup.error,
          userLabel: "A",
          competitionId: duplicateCompetitionId,
        });
        break;
      }

      if (!Array.isArray(matchup.data) || matchup.data.length === 0) {
        break;
      }

      const row = matchup.data[0];
      const pairKey = normalizePair(row.entry_a_id, row.entry_b_id);

      if (duplicatePairKey && pairKey === duplicatePairKey) {
        duplicatePairServed = true;
        break;
      }

      const vote = await userMap.A.client.rpc("submit_competition_vote", {
        p_competition_id: duplicateCompetitionId,
        p_entry_a_id: row.entry_a_id,
        p_entry_b_id: row.entry_b_id,
        p_winner_entry_id: row.entry_a_id,
      });

      if (vote.error) {
        tracker.fail("Duplicate-album competition valid vote failed");
        printRpcFailureDebug({
          rpcName: "submit_competition_vote",
          expected: "successful vote on non-duplicate matchup",
          error: vote.error,
          userLabel: "A",
          competitionId: duplicateCompetitionId,
          entryIds: [row.entry_a_id, row.entry_b_id],
        });
        break;
      }

      duplicateCompetitionValidVoteCount += 1;
    }

    assertCondition(
      tracker,
      !duplicatePairServed,
      "Matchmaking never returns duplicate-normalized album+artist pair",
      "Matchmaking returned duplicate-normalized album+artist entries against each other"
    );

    assertCondition(
      tracker,
      duplicateCompetitionValidVoteCount > 0,
      "Normal different-album matchmaking and voting still works",
      "No successful non-duplicate votes occurred in duplicate-album competition"
    );

    const votesBeforeDuplicateRejection = await fetchVotes(adminClient, duplicateCompetitionId);
    const scoresBeforeDuplicateRejection = await fetchScores(adminClient, duplicateCompetitionId);
    const entryBScoreBefore = entryB
      ? scoresBeforeDuplicateRejection.find((row) => row.entry_id === entryB.id)
      : null;
    const entryCScoreBefore = entryC
      ? scoresBeforeDuplicateRejection.find((row) => row.entry_id === entryC.id)
      : null;

    await rpcExpectFailure({
      tracker,
      client: userMap.A.client,
      rpcName: "submit_competition_vote",
      params: {
        p_competition_id: duplicateCompetitionId,
        p_entry_a_id: entryB.id,
        p_entry_b_id: entryC.id,
        p_winner_entry_id: entryB.id,
      },
      expectedLabel: "Direct duplicate-album vote rejected",
      expectedMessageIncludes: "identical albums cannot be matched against each other",
      userLabel: "A",
      competitionId: duplicateCompetitionId,
      entryIds: [entryB.id, entryC.id],
    });

    const votesAfterDuplicateRejection = await fetchVotes(adminClient, duplicateCompetitionId);
    const scoresAfterDuplicateRejection = await fetchScores(adminClient, duplicateCompetitionId);
    const entryBScoreAfter = entryB
      ? scoresAfterDuplicateRejection.find((row) => row.entry_id === entryB.id)
      : null;
    const entryCScoreAfter = entryC
      ? scoresAfterDuplicateRejection.find((row) => row.entry_id === entryC.id)
      : null;

    assertCondition(
      tracker,
      votesAfterDuplicateRejection.length === votesBeforeDuplicateRejection.length,
      "Rejected duplicate-album vote inserted no vote row",
      "Rejected duplicate-album vote unexpectedly inserted a vote row"
    );

    const duplicateScoresUnchanged =
      Boolean(entryBScoreBefore) &&
      Boolean(entryCScoreBefore) &&
      Boolean(entryBScoreAfter) &&
      Boolean(entryCScoreAfter) &&
      Number(entryBScoreBefore.rating) === Number(entryBScoreAfter.rating) &&
      Number(entryBScoreBefore.wins) === Number(entryBScoreAfter.wins) &&
      Number(entryBScoreBefore.losses) === Number(entryBScoreAfter.losses) &&
      Number(entryBScoreBefore.appearances) === Number(entryBScoreAfter.appearances) &&
      Number(entryCScoreBefore.rating) === Number(entryCScoreAfter.rating) &&
      Number(entryCScoreBefore.wins) === Number(entryCScoreAfter.wins) &&
      Number(entryCScoreBefore.losses) === Number(entryCScoreAfter.losses) &&
      Number(entryCScoreBefore.appearances) === Number(entryCScoreAfter.appearances);

    assertCondition(
      tracker,
      duplicateScoresUnchanged,
      "Rejected duplicate-album vote changed no score counters/ratings",
      "Rejected duplicate-album vote unexpectedly changed score counters/ratings"
    );

    const exhaustionUser = userMap.D;
    const seenPairs = new Set();
    let exhausted = false;

    for (let i = 0; i < 20; i += 1) {
      const matchup = await exhaustionUser.client.rpc("get_next_competition_matchup", {
        p_competition_id: submitCompetitionId,
      });

      if (matchup.error) {
        tracker.fail("Matchmaking exhaustion fetch failed");
        printRpcFailureDebug({
          rpcName: "get_next_competition_matchup",
          expected: "successful matchup/zero-row",
          error: matchup.error,
          userLabel: exhaustionUser.label,
          competitionId: submitCompetitionId,
        });
        break;
      }

      if (!Array.isArray(matchup.data) || matchup.data.length === 0) {
        exhausted = true;
        tracker.pass("Matchmaking exhaustion returns zero rows cleanly");
        break;
      }

      const row = matchup.data[0];
      const pairKey = normalizePair(row.entry_a_id, row.entry_b_id);
      if (seenPairs.has(pairKey)) {
        tracker.fail("Matchmaking exhaustion served an already-seen pair");
        break;
      }
      seenPairs.add(pairKey);

      const vote = await exhaustionUser.client.rpc("submit_competition_vote", {
        p_competition_id: submitCompetitionId,
        p_entry_a_id: row.entry_a_id,
        p_entry_b_id: row.entry_b_id,
        p_winner_entry_id: row.entry_a_id,
      });

      if (vote.error) {
        tracker.fail("Matchmaking exhaustion vote submit failed");
        printRpcFailureDebug({
          rpcName: "submit_competition_vote",
          expected: "successful exhaustion vote",
          error: vote.error,
          userLabel: exhaustionUser.label,
          competitionId: submitCompetitionId,
          entryIds: [row.entry_a_id, row.entry_b_id],
        });
        break;
      }
    }

    assertCondition(
      tracker,
      exhausted,
      "Matchmaking exhaustion loop terminates",
      "Matchmaking exhaustion loop did not terminate"
    );

    const resultsTooEarly = await userMap.A.client.rpc("get_competition_results", {
      p_competition_id: submitCompetitionId,
    });

    if (resultsTooEarly.error) {
      const msg = sanitizeError(resultsTooEarly.error).message.toLowerCase();
      if (msg.includes("results are not available yet")) {
        tracker.pass("Results hidden before results_at");
      } else {
        tracker.fail("Results-before-results_at returned unexpected error");
        printRpcFailureDebug({
          rpcName: "get_competition_results",
          expected: "error containing: Results are not available yet",
          error: resultsTooEarly.error,
          userLabel: "A",
          competitionId: submitCompetitionId,
        });
      }
    } else {
      tracker.fail("Results hidden before results_at");
    }

    const competitionTiming = await createTemplate(adminClient, state, 3);
    tracker.pass("Created timing-gate QA competition");

    await updateCompetitionWindow(adminClient, competitionTiming.id, buildResultsPastUnfinalizedWindow());

    const resultsNotFinalized = await userMap.A.client.rpc("get_competition_results", {
      p_competition_id: competitionTiming.id,
    });

    if (resultsNotFinalized.error) {
      const msg = sanitizeError(resultsNotFinalized.error).message.toLowerCase();
      if (msg.includes("results are not finalized yet")) {
        tracker.pass("Results hidden until finalization");
      } else {
        tracker.fail("Results-finalization gate returned unexpected error");
        printRpcFailureDebug({
          rpcName: "get_competition_results",
          expected: "error containing: Results are not finalized yet",
          error: resultsNotFinalized.error,
          userLabel: "A",
          competitionId: competitionTiming.id,
        });
      }
    } else {
      tracker.fail("Results hidden until finalization");
    }

    await updateCompetitionWindow(adminClient, submitCompetitionId, buildVotingClosedWindow());
    tracker.pass("Moved primary competition to post-voting pre-results phase");

    const finalizeFirst = await adminClient.rpc("finalize_competition", {
      p_competition_id: submitCompetitionId,
    });

    if (finalizeFirst.error || !Array.isArray(finalizeFirst.data) || finalizeFirst.data.length !== 1) {
      tracker.fail("Finalization failed for primary competition");
      printRpcFailureDebug({
        rpcName: "finalize_competition",
        expected: "service-role finalization success",
        error: finalizeFirst.error,
        userLabel: "service-role",
        competitionId: submitCompetitionId,
      });
      throw new Error("Primary finalization failed; aborting remaining tests.");
    }

    const finalizeFirstRow = finalizeFirst.data[0];
    assertCondition(
      tracker,
      Boolean(finalizeFirstRow.finalized_at),
      "Finalization sets finalized_at",
      "Finalization did not set finalized_at"
    );

    const entriesAfterFinalize = await fetchActiveEntries(adminClient, submitCompetitionId);
    const placements = entriesAfterFinalize.map((row) => row.final_placement);
    const nonNullPlacements = placements.filter((p) => Number.isInteger(p));
    const uniquePlacements = new Set(nonNullPlacements);

    assertCondition(
      tracker,
      nonNullPlacements.length === entriesAfterFinalize.length,
      "Every active entry has non-null final_placement",
      "Some active entries have null final_placement"
    );

    const expectedPlacementSet = new Set(
      Array.from({ length: entriesAfterFinalize.length }, (_, idx) => idx + 1)
    );
    const placementSetMatches =
      uniquePlacements.size === expectedPlacementSet.size &&
      Array.from(expectedPlacementSet).every((value) => uniquePlacements.has(value));

    assertCondition(
      tracker,
      placementSetMatches,
      "Placements are unique values 1..N",
      "Placements are not unique contiguous values 1..N"
    );

    const placementOneRows = entriesAfterFinalize.filter((row) => row.final_placement === 1);
    assertCondition(
      tracker,
      placementOneRows.length === 1,
      "Exactly one entry has placement 1",
      `Expected exactly one placement-1 entry, found ${placementOneRows.length}`
    );

    const awardsAfterFinalize = await fetchAwards(adminClient, submitCompetitionId);
    const winnerAwards = awardsAfterFinalize.filter(
      (award) => award.award_type === "winner" && award.placement === 1
    );

    assertCondition(
      tracker,
      winnerAwards.length === 1,
      "Finalization created exactly one winner award",
      `Expected one winner award, found ${winnerAwards.length}`
    );

    if (winnerAwards.length === 1 && placementOneRows.length === 1) {
      const award = winnerAwards[0];
      const winnerEntry = placementOneRows[0];
      assertCondition(
        tracker,
        award.entry_id === winnerEntry.id && award.user_id === winnerEntry.user_id,
        "Winner award matches placement-1 entry and owner",
        "Winner award entry/user does not match placement-1 entry"
      );

      const directAwardRead = await userMap.A.client
        .from("competition_awards")
        .select("id")
        .eq("competition_id", submitCompetitionId)
        .limit(1);

      if (directAwardRead.error) {
        const msg = sanitizeError(directAwardRead.error).message.toLowerCase();
        const denied =
          msg.includes("permission denied") ||
          msg.includes("row-level security") ||
          msg.includes("not allowed") ||
          msg.includes("insufficient privilege");

        if (denied) {
          tracker.pass("Authenticated direct competition_awards SELECT denied");
        } else {
          tracker.fail("Authenticated direct competition_awards SELECT denied");
          printRpcFailureDebug({
            rpcName: "competition_awards direct select",
            expected: "permission/RLS denial",
            error: directAwardRead.error,
            userLabel: "A",
            competitionId: submitCompetitionId,
          });
        }
      } else {
        tracker.fail(
          `Authenticated direct competition_awards SELECT denied (unexpected success rows=${(directAwardRead.data ?? []).length})`
        );
      }

      const winnerUserId = award.user_id;

      const ownBeforeResults = await userMap.A.client.rpc("get_user_competition_awards", {
        p_user_id: winnerUserId,
      });

      const crossBeforeResults = await userMap.B.client.rpc("get_user_competition_awards", {
        p_user_id: winnerUserId,
      });

      const ownBeforeResultsRows = Array.isArray(ownBeforeResults.data)
        ? ownBeforeResults.data.filter((row) => row.competition_id === submitCompetitionId)
        : [];
      const crossBeforeResultsRows = Array.isArray(crossBeforeResults.data)
        ? crossBeforeResults.data.filter((row) => row.competition_id === submitCompetitionId)
        : [];

      const beforeResultsHidden =
        !ownBeforeResults.error &&
        !crossBeforeResults.error &&
        ownBeforeResultsRows.length === 0 &&
        crossBeforeResultsRows.length === 0;

      assertCondition(
        tracker,
        beforeResultsHidden,
        "Winner trophy hidden before results_at",
        "Winner trophy hidden before results_at"
      );

      const nullUserAwardCall = await userMap.A.client.rpc("get_user_competition_awards", {
        p_user_id: null,
      });

      if (nullUserAwardCall.error) {
        const msg = sanitizeError(nullUserAwardCall.error).message.toLowerCase();
        if (msg.includes("user id is required")) {
          tracker.pass("Trophy RPC rejects null user id");
        } else {
          tracker.fail("Trophy RPC rejects null user id");
          printRpcFailureDebug({
            rpcName: "get_user_competition_awards",
            expected: "error containing: User id is required",
            error: nullUserAwardCall.error,
            userLabel: "A",
            competitionId: submitCompetitionId,
          });
        }
      } else {
        tracker.fail("Trophy RPC rejects null user id");
      }
    }

    const placementsSnapshot = entriesAfterFinalize
      .map((row) => ({ id: row.id, final_placement: row.final_placement }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const finalizedAtSnapshot = finalizeFirstRow.finalized_at;

    const finalizeSecond = await adminClient.rpc("finalize_competition", {
      p_competition_id: submitCompetitionId,
    });

    if (finalizeSecond.error || !Array.isArray(finalizeSecond.data) || finalizeSecond.data.length !== 1) {
      tracker.fail("Second finalization call failed unexpectedly");
      printRpcFailureDebug({
        rpcName: "finalize_competition",
        expected: "idempotent second call",
        error: finalizeSecond.error,
        userLabel: "service-role",
        competitionId: submitCompetitionId,
      });
    } else {
      const row = finalizeSecond.data[0];
      assertCondition(
        tracker,
        row.award_created === false,
        "Second finalization returns award_created=false",
        "Second finalization did not return award_created=false"
      );
      assertCondition(
        tracker,
        row.finalized_at === finalizedAtSnapshot,
        "Second finalization preserved finalized_at",
        "Second finalization changed finalized_at"
      );
    }

    const awardsAfterSecondFinalize = await fetchAwards(adminClient, submitCompetitionId);
    assertCondition(
      tracker,
      awardsAfterSecondFinalize.filter((a) => a.award_type === "winner").length === 1,
      "Second finalization did not create a second winner award",
      "Second finalization created duplicate winner award"
    );

    const placementsAfterSecondFinalize = (await fetchActiveEntries(adminClient, submitCompetitionId))
      .map((row) => ({ id: row.id, final_placement: row.final_placement }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const placementUnchanged =
      JSON.stringify(placementsSnapshot) === JSON.stringify(placementsAfterSecondFinalize);
    assertCondition(
      tracker,
      placementUnchanged,
      "Second finalization left frozen placements unchanged",
      "Second finalization changed frozen placements"
    );

    await updateCompetitionWindow(adminClient, submitCompetitionId, buildResultsOpenWindow());
    tracker.pass("Moved primary competition into results-readable phase");

    const resultsAfterFinalize = await userMap.A.client.rpc("get_competition_results", {
      p_competition_id: submitCompetitionId,
    });

    let baselineResultOrder = [];

    if (
      resultsAfterFinalize.error ||
      !Array.isArray(resultsAfterFinalize.data) ||
      resultsAfterFinalize.data.length === 0
    ) {
      tracker.fail("Results RPC failed after finalization and results_at");
      printRpcFailureDebug({
        rpcName: "get_competition_results",
        expected: "results success after finalization",
        error: resultsAfterFinalize.error,
        userLabel: "A",
        competitionId: submitCompetitionId,
      });
    } else {
      const rows = resultsAfterFinalize.data;
      baselineResultOrder = rows.map((row) => row.entry_id);

      const ascending = rows.every((row, idx) => Number(row.placement) === idx + 1);
      assertCondition(
        tracker,
        ascending,
        "Results are ordered by frozen placement",
        "Results are not ordered by frozen placement"
      );

      const forbiddenFields = ["rating", "wins", "losses", "appearances"];
      const leaked = rows.some((row) =>
        forbiddenFields.some((field) => Object.prototype.hasOwnProperty.call(row, field))
      );
      assertCondition(
        tracker,
        !leaked,
        "Results do not expose rating/wins/losses/appearances",
        "Results leaked internal score fields"
      );

      const winnerPlacementPost = rows.find((row) => Number(row.placement) === 1);
      const winnerUserIdPost = winnerPlacementPost?.user_id ?? null;

      if (!winnerUserIdPost) {
        tracker.fail("Public trophy RPC returns winner after results_at");
      } else {
        const publicTrophyAfterResults = await userMap.A.client.rpc("get_user_competition_awards", {
          p_user_id: winnerUserIdPost,
        });

        if (publicTrophyAfterResults.error || !Array.isArray(publicTrophyAfterResults.data)) {
          tracker.fail("Public trophy RPC returns winner after results_at");
          printRpcFailureDebug({
            rpcName: "get_user_competition_awards",
            expected: "successful trophy read",
            error: publicTrophyAfterResults.error,
            userLabel: "A",
            competitionId: submitCompetitionId,
          });
        } else {
          const trophiesForPrimary = publicTrophyAfterResults.data.filter(
            (row) => row.competition_id === submitCompetitionId
          );

          const exactlyOne = trophiesForPrimary.length === 1;
          const trophy = trophiesForPrimary[0];
          const expectedWinnerEntryId = winnerPlacementPost.entry_id;

          const metadataMatches =
            exactlyOne &&
            trophy.award_type === "winner" &&
            Number(trophy.placement) === 1 &&
            trophy.competition_id === submitCompetitionId &&
            trophy.entry_id === expectedWinnerEntryId &&
            trophy.competition_title === `QA Showdown Competition ${state.runId}` &&
            trophy.album_title === winnerPlacementPost.album_title &&
            trophy.artist_name === winnerPlacementPost.artist_name;

          assertCondition(
            tracker,
            metadataMatches,
            "Public trophy RPC returns winner after results_at",
            "Public trophy RPC returns winner after results_at"
          );

          const forbiddenFields = [
            "rating",
            "wins",
            "losses",
            "appearances",
            "vote_totals",
            "source_record_id",
            "notes",
            "price",
            "favoriteTrack",
          ];
          const hasForbidden = exactlyOne
            ? forbiddenFields.some((field) => Object.prototype.hasOwnProperty.call(trophy, field))
            : true;

          assertCondition(
            tracker,
            !hasForbidden,
            "Trophy RPC exposes only safe frozen metadata",
            "Trophy RPC exposes only safe frozen metadata"
          );
        }
      }
    }

    assertCondition(
      tracker,
      baselineResultOrder.length > 0,
      "Frozen placement ordering validated without direct score mutation",
      "Results were unavailable for frozen placement ordering validation"
    );

    const competition2 = await createTemplate(adminClient, state, 3);
    tracker.pass("Created secondary QA competition for minimum participation test");

    await updateCompetitionWindow(adminClient, competition2.id, buildInitialCompetitionWindow());

    for (const label of ["A", "B"]) {
      const user = userMap[label];
      const submit = await user.client.rpc("submit_competition_entry", {
        p_competition_id: competition2.id,
        p_source_record_id: user.recordId,
        p_caption: null,
      });

      if (submit.error || !submit.data) {
        tracker.fail(`Secondary competition entry submit failed for ${label}`);
        printRpcFailureDebug({
          rpcName: "submit_competition_entry",
          expected: "successful submission to competition 2",
          error: submit.error,
          userLabel: label,
          competitionId: competition2.id,
        });
      } else {
        tracker.pass(`User ${label} submitted to secondary competition`);
      }
    }

    await updateCompetitionWindow(adminClient, competition2.id, buildVotingClosedWindow());

    const finalizeLowParticipation = await adminClient.rpc("finalize_competition", {
      p_competition_id: competition2.id,
    });

    if (
      finalizeLowParticipation.error ||
      !Array.isArray(finalizeLowParticipation.data) ||
      finalizeLowParticipation.data.length !== 1
    ) {
      tracker.fail("Finalization failed for low-participation competition");
      printRpcFailureDebug({
        rpcName: "finalize_competition",
        expected: "successful low-participation finalization",
        error: finalizeLowParticipation.error,
        userLabel: "service-role",
        competitionId: competition2.id,
      });
    } else {
      const row = finalizeLowParticipation.data[0];
      assertCondition(
        tracker,
        Boolean(row.finalized_at),
        "Low-participation competition finalized successfully",
        "Low-participation competition missing finalized_at"
      );
      assertCondition(
        tracker,
        row.award_created === false,
        "Low-participation finalization returned award_created=false",
        "Low-participation finalization did not return award_created=false"
      );
      assertCondition(
        tracker,
        row.winner_entry_id == null && row.winner_user_id == null,
        "Low-participation finalization returned null winner ids",
        "Low-participation finalization returned unexpected winner ids"
      );

      const entries2 = await fetchActiveEntries(adminClient, competition2.id);
      const placementsExist2 = entries2.every((entry) => Number.isInteger(entry.final_placement));
      assertCondition(
        tracker,
        placementsExist2,
        "Low-participation competition still received placements",
        "Low-participation competition missing placements"
      );

      const awards2 = await fetchAwards(adminClient, competition2.id);
      const winnerAwards2 = awards2.filter((award) => award.award_type === "winner");
      assertCondition(
        tracker,
        winnerAwards2.length === 0,
        "Low-participation competition created no winner award",
        `Low-participation competition unexpectedly created ${winnerAwards2.length} winner awards`
      );
    }

    await rpcExpectFailure({
      tracker,
      client: userMap.A.client,
      rpcName: "finalize_competition",
      params: { p_competition_id: submitCompetitionId },
      expectedLabel: "Authenticated finalize_competition execution denied",
      expectedMessageIncludes: ["permission denied", "not allowed", "insufficient privilege"],
      userLabel: "A",
      competitionId: submitCompetitionId,
    });

    const competitionCancelled = await createTemplate(adminClient, state, 1);
    tracker.pass("Created cancelled-visibility QA competition");

    const submitCancelled = await userMap.C.client.rpc("submit_competition_entry", {
      p_competition_id: competitionCancelled.id,
      p_source_record_id: userMap.C.recordId,
      p_caption: null,
    });

    if (submitCancelled.error || !submitCancelled.data) {
      tracker.fail("Cancelled-visibility competition entry submit failed");
      printRpcFailureDebug({
        rpcName: "submit_competition_entry",
        expected: "successful entry for cancelled-visibility test",
        error: submitCancelled.error,
        userLabel: "C",
        competitionId: competitionCancelled.id,
      });
    } else {
      await updateCompetitionWindow(adminClient, competitionCancelled.id, buildVotingClosedWindow());

      const finalizeCancelled = await adminClient.rpc("finalize_competition", {
        p_competition_id: competitionCancelled.id,
      });

      if (finalizeCancelled.error || !Array.isArray(finalizeCancelled.data) || finalizeCancelled.data.length !== 1) {
        tracker.fail("Cancelled-visibility competition finalization failed");
      } else {
        await updateCompetitionWindow(adminClient, competitionCancelled.id, {
          ...buildResultsOpenWindow(),
          is_cancelled: true,
        });

        const cancelledTrophyRead = await userMap.B.client.rpc("get_user_competition_awards", {
          p_user_id: userMap.C.userId,
        });

        if (cancelledTrophyRead.error || !Array.isArray(cancelledTrophyRead.data)) {
          tracker.fail("Cancelled competition trophy visibility test failed");
        } else {
          const cancelledRows = cancelledTrophyRead.data.filter(
            (row) => row.competition_id === competitionCancelled.id
          );
          assertCondition(
            tracker,
            cancelledRows.length === 0,
            "Cancelled competition trophy hidden",
            "Cancelled competition trophy hidden"
          );
        }
      }
    }

    if (tracker.failed === 0 && !args.keepData) {
      const cleanupProblems = await cleanupRun(adminClient, state, tracker);
      if (cleanupProblems.length > 0) {
        tracker.warn(
          `Cleanup completed with issues for run ${runId}. Re-run cleanup with: node scripts/showdown-backend-qa.mjs --cleanup --run-id ${runId}`
        );
      }
    } else {
      console.warn(`\nQA data preserved for run ${runId}.`);
      console.warn(`Cleanup command: node scripts/showdown-backend-qa.mjs --cleanup --run-id ${runId}`);
      console.warn(`Competition IDs: ${state.competitions.join(", ") || "n/a"}`);
      console.warn(`User IDs: ${state.users.map((u) => `${u.label}:${u.userId}`).join(", ") || "n/a"}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown harness error";
    tracker.fail(`Harness aborted: ${message}`);
    console.warn(`\nQA data preserved for run ${state.runId}.`);
    console.warn(`Cleanup command: node scripts/showdown-backend-qa.mjs --cleanup --run-id ${state.runId}`);
    console.warn(`Competition IDs: ${state.competitions.join(", ") || "n/a"}`);
    console.warn(`User IDs: ${state.users.map((u) => `${u.label}:${u.userId}`).join(", ") || "n/a"}`);
  }

  tracker.summary();
  if (tracker.failed > 0) {
    process.exitCode = 1;
  }
}

runQa().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown top-level error";
  console.error(`[FAIL] QA harness could not start: ${message}`);
  process.exit(1);
});
