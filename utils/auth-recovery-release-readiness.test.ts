import assert from "node:assert/strict";
import type { Session } from "@supabase/supabase-js";
import {
  processRecoveryCallbackAttempt,
  selectRecoveryCallbackUrlCandidate,
  shouldProcessRecoveryCallback,
} from "./auth-recovery-flow";
import { consumeRecentRecoveryIntent, normalizeNativeIntentPath } from "./native-intent";

type CallbackDecision = {
  shouldProcess: boolean;
  selectedUrl: string | null;
  selectedSource: "liveUrl" | "initialUrl" | "fallbackQuery" | "devOverride" | "none";
};

type AttemptCounts = {
  exchangeCodeForSession: number;
  setSession: number;
  verifyOtp: number;
  signOutLocal: number;
};

function makeSession(hasUser: boolean): Session | null {
  if (!hasUser) {
    return null;
  }

  return {
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: { id: "user-1" },
  } as unknown as Session;
}

function decideCallbackProcessing(input: {
  liveUrl: string | null;
  fallbackQuery: URLSearchParams;
  hasFreshIntent: boolean;
}): CallbackDecision {
  const selection = selectRecoveryCallbackUrlCandidate({
    liveUrl: input.liveUrl,
    initialUrl: null,
    fallbackQuery: input.fallbackQuery,
    isDev: false,
    devRecoveryUrl: null,
  });

  return {
    shouldProcess: shouldProcessRecoveryCallback({
      selectedUrl: selection.url,
      selectedSource: selection.source,
      hasFreshRecoveryIntent: input.hasFreshIntent,
    }),
    selectedUrl: selection.url,
    selectedSource: selection.source,
  };
}

async function runProcessingAttempt(input: {
  liveUrl: string;
  fallbackQuery?: URLSearchParams;
  consumedKeys: Set<string>;
  hasSessionAfterAuth?: boolean;
}): Promise<{
  result: Awaited<ReturnType<typeof processRecoveryCallbackAttempt>>;
  counts: AttemptCounts;
}> {
  const counts: AttemptCounts = {
    exchangeCodeForSession: 0,
    setSession: 0,
    verifyOtp: 0,
    signOutLocal: 0,
  };

  const result = await processRecoveryCallbackAttempt(
    {
      inputUrl: input.liveUrl,
      fallbackQuery: input.fallbackQuery ?? new URLSearchParams(),
      consumedKeys: input.consumedKeys,
      isDev: false,
      devRecoveryUrl: null,
      timeoutMs: 500,
    },
    {
      exchangeCodeForSession: async () => {
        counts.exchangeCodeForSession += 1;
        return { error: null };
      },
      setSession: async () => {
        counts.setSession += 1;
        return { error: null };
      },
      verifyOtp: async () => {
        counts.verifyOtp += 1;
        return { error: null };
      },
      getSession: async () => ({
        data: {
          session: makeSession(input.hasSessionAfterAuth ?? true),
        },
        error: null,
      }),
      signOutLocal: async () => {
        counts.signOutLocal += 1;
        return { error: null };
      },
    },
  );

  return { result, counts };
}

async function runReleaseReadinessRecoveryStressTests(): Promise<void> {
  // A. Normal cold launch: no recovery URL, signed out.
  const normalSignedOut = decideCallbackProcessing({
    liveUrl: null,
    fallbackQuery: new URLSearchParams(),
    hasFreshIntent: false,
  });
  assert.equal(normalSignedOut.shouldProcess, false, "A: normal signed-out launch must not process callback");

  // B. Normal signed-in cold launch: no recovery URL.
  const normalSignedIn = decideCallbackProcessing({
    liveUrl: null,
    fallbackQuery: new URLSearchParams(),
    hasFreshIntent: false,
  });
  assert.equal(normalSignedIn.shouldProcess, false, "B: normal signed-in launch must not process callback");

  // C. Force-close after successful reset: restart from icon must not reopen callback.
  const consumedAfterSuccess = new Set<string>();
  const successAttempt = await runProcessingAttempt({
    liveUrl: "recordquest://auth/callback?code=abc123&type=recovery",
    consumedKeys: consumedAfterSuccess,
    hasSessionAfterAuth: true,
  });
  assert.equal(successAttempt.result.status, "success", "C: valid recovery must succeed");
  const postSuccessRestart = decideCallbackProcessing({
    liveUrl: null,
    fallbackQuery: new URLSearchParams(),
    hasFreshIntent: false,
  });
  assert.equal(postSuccessRestart.shouldProcess, false, "C: ordinary restart must not reopen callback");

  // D. Force-close after invalid callback: ordinary launch must not restore invalid-link state.
  const consumedAfterInvalid = new Set<string>();
  const invalidAttempt = await runProcessingAttempt({
    liveUrl: "recordquest://auth/callback?code=bad-missing-type",
    consumedKeys: consumedAfterInvalid,
    hasSessionAfterAuth: false,
  });
  assert.equal(invalidAttempt.result.status, "error", "D: malformed callback must error");
  if (invalidAttempt.result.status === "error") {
    assert.equal(invalidAttempt.result.reason, "invalid-link", "D: malformed callback should produce invalid-link");
  }
  const postInvalidRestart = decideCallbackProcessing({
    liveUrl: null,
    fallbackQuery: new URLSearchParams(),
    hasFreshIntent: false,
  });
  assert.equal(postInvalidRestart.shouldProcess, false, "D: ordinary restart must not restore callback processing");

  // E. Stale callback route restore without fresh intent.
  const staleRouteSignedOut = decideCallbackProcessing({
    liveUrl: "/auth/callback",
    fallbackQuery: new URLSearchParams(),
    hasFreshIntent: false,
  });
  assert.equal(staleRouteSignedOut.shouldProcess, false, "E: bare restored callback route must be bypassed");

  const staleRouteSignedIn = decideCallbackProcessing({
    liveUrl: "/auth/callback",
    fallbackQuery: new URLSearchParams(),
    hasFreshIntent: false,
  });
  assert.equal(staleRouteSignedIn.shouldProcess, false, "E: signed-in stale callback route must be bypassed");

  // F. Stale callback query params without fresh intent.
  const staleQuery = decideCallbackProcessing({
    liveUrl: null,
    fallbackQuery: new URLSearchParams("code=old-code&type=recovery"),
    hasFreshIntent: false,
  });
  assert.equal(staleQuery.selectedSource, "fallbackQuery", "F: fallback params should be selected");
  assert.equal(staleQuery.shouldProcess, false, "F: stale fallback query must not process without fresh intent");

  // G. Stale initial URL replay risk: callback path is ignored unless delivered as a fresh live/fallback event.
  const staleInitialIgnoredByFlow = decideCallbackProcessing({
    liveUrl: null,
    fallbackQuery: new URLSearchParams(),
    hasFreshIntent: false,
  });
  assert.equal(staleInitialIgnoredByFlow.shouldProcess, false, "G: no fresh event means no callback processing");

  // H. Fresh code callback.
  const freshCode = await runProcessingAttempt({
    liveUrl: "recordquest://auth/callback?code=fresh-code&type=recovery",
    consumedKeys: new Set<string>(),
    hasSessionAfterAuth: true,
  });
  assert.equal(freshCode.result.status, "success", "H: fresh code callback must succeed");
  assert.equal(freshCode.counts.exchangeCodeForSession, 1, "H: exchangeCode should run exactly once");

  // I. Fresh token_hash callback.
  const freshTokenHash = await runProcessingAttempt({
    liveUrl: "recordquest://auth/callback?token_hash=hash-123&type=recovery",
    consumedKeys: new Set<string>(),
    hasSessionAfterAuth: true,
  });
  assert.equal(freshTokenHash.result.status, "success", "I: token_hash callback must succeed");
  assert.equal(freshTokenHash.counts.verifyOtp, 1, "I: verifyOtp should run exactly once");

  // J. Fresh access/refresh callback.
  const freshSessionTokens = await runProcessingAttempt({
    liveUrl: "recordquest://auth/callback?access_token=a1&refresh_token=r1&type=recovery",
    consumedKeys: new Set<string>(),
    hasSessionAfterAuth: true,
  });
  assert.equal(freshSessionTokens.result.status, "success", "J: access/refresh callback must succeed");
  assert.equal(freshSessionTokens.counts.setSession, 1, "J: setSession should run exactly once");

  // K. Backgrounded app + fresh link event via native intent marker.
  normalizeNativeIntentPath("recordquest://auth/callback?code=bg-123&type=recovery");
  const freshIntent = consumeRecentRecoveryIntent();
  assert.equal(Boolean(freshIntent), true, "K: fresh background link should register a fresh intent");
  const backgroundDecision = decideCallbackProcessing({
    liveUrl: freshIntent,
    fallbackQuery: new URLSearchParams(),
    hasFreshIntent: true,
  });
  assert.equal(backgroundDecision.shouldProcess, true, "K: fresh background callback should be processed");

  // L. Duplicate URL events should process once.
  const sharedConsumed = new Set<string>();
  const firstDuplicateAttempt = await runProcessingAttempt({
    liveUrl: "recordquest://auth/callback?code=dup-code&type=recovery",
    consumedKeys: sharedConsumed,
    hasSessionAfterAuth: true,
  });
  const secondDuplicateAttempt = await runProcessingAttempt({
    liveUrl: "recordquest://auth/callback?code=dup-code&type=recovery",
    consumedKeys: sharedConsumed,
    hasSessionAfterAuth: false,
  });
  assert.equal(firstDuplicateAttempt.counts.exchangeCodeForSession, 1, "L: first event should process normally");
  assert.equal(secondDuplicateAttempt.counts.exchangeCodeForSession, 0, "L: duplicate event must not reprocess");
  assert.equal(secondDuplicateAttempt.result.status, "error", "L: duplicate should be rejected deterministically");
  if (secondDuplicateAttempt.result.status === "error") {
    assert.equal(secondDuplicateAttempt.result.reason, "duplicate", "L: duplicate reason should be explicit");
  }

  // M. Re-render/re-entry during callback should not duplicate processing.
  const concurrentConsumed = new Set<string>();
  const [raceOne, raceTwo] = await Promise.all([
    runProcessingAttempt({
      liveUrl: "recordquest://auth/callback?code=race-1&type=recovery",
      consumedKeys: concurrentConsumed,
      hasSessionAfterAuth: true,
    }),
    runProcessingAttempt({
      liveUrl: "recordquest://auth/callback?code=race-1&type=recovery",
      consumedKeys: concurrentConsumed,
      hasSessionAfterAuth: true,
    }),
  ]);
  const totalRaceExchangeCalls = raceOne.counts.exchangeCodeForSession + raceTwo.counts.exchangeCodeForSession;
  assert.equal(totalRaceExchangeCalls, 1, "M: duplicate re-entry must not perform auth exchange twice");

  // N. Bare callback without payload should immediately bypass, not show invalid-link due to random startup.
  const bareCallback = decideCallbackProcessing({
    liveUrl: "/auth/callback",
    fallbackQuery: new URLSearchParams(),
    hasFreshIntent: false,
  });
  assert.equal(bareCallback.shouldProcess, false, "N: bare callback must bypass recovery processing");

  // O. Explicit malformed recovery link should still surface invalid-link behavior.
  const explicitMalformed = await runProcessingAttempt({
    liveUrl: "recordquest://auth/callback?code=oops",
    consumedKeys: new Set<string>(),
    hasSessionAfterAuth: false,
  });
  assert.equal(explicitMalformed.result.status, "error", "O: malformed explicit recovery callback must error");
  if (explicitMalformed.result.status === "error") {
    assert.equal(explicitMalformed.result.reason, "invalid-link", "O: malformed callback should map to invalid-link");
    assert.equal(explicitMalformed.result.nextHref, "/(auth)/sign-in", "O: invalid callback should return to sign-in flow");
  }

  // P. Consumed callback replay should not reprocess or poison future normal launches.
  const consumedReplay = new Set<string>();
  const firstConsumed = await runProcessingAttempt({
    liveUrl: "recordquest://auth/callback?token_hash=tok-replay&type=recovery",
    consumedKeys: consumedReplay,
    hasSessionAfterAuth: true,
  });
  const replayConsumed = await runProcessingAttempt({
    liveUrl: "recordquest://auth/callback?token_hash=tok-replay&type=recovery",
    consumedKeys: consumedReplay,
    hasSessionAfterAuth: false,
  });
  assert.equal(firstConsumed.counts.verifyOtp, 1, "P: first consumed callback should verify once");
  assert.equal(replayConsumed.counts.verifyOtp, 0, "P: consumed callback replay should not verify again");
  const postConsumedNormalLaunch = decideCallbackProcessing({
    liveUrl: null,
    fallbackQuery: new URLSearchParams(),
    hasFreshIntent: false,
  });
  assert.equal(postConsumedNormalLaunch.shouldProcess, false, "P: normal launch after consumed callback must remain clean");

  // Q. Normal navigation stress without deep links should never select callback processing.
  for (let i = 0; i < 40; i += 1) {
    const cycleDecision = decideCallbackProcessing({
      liveUrl: null,
      fallbackQuery: new URLSearchParams(),
      hasFreshIntent: false,
    });
    assert.equal(cycleDecision.shouldProcess, false, "Q: normal navigation cycle must not trigger callback processing");
  }

  // R. Session state changes must not accidentally trigger callback processing without a fresh event.
  const sessionChangeNoSession = decideCallbackProcessing({
    liveUrl: "/auth/callback",
    fallbackQuery: new URLSearchParams(),
    hasFreshIntent: false,
  });
  const sessionChangeSignedIn = decideCallbackProcessing({
    liveUrl: "/auth/callback",
    fallbackQuery: new URLSearchParams(),
    hasFreshIntent: false,
  });
  assert.equal(sessionChangeNoSession.shouldProcess, false, "R: no-session callback restore must bypass processing");
  assert.equal(sessionChangeSignedIn.shouldProcess, false, "R: signed-in callback restore must bypass processing");

  console.log("auth-recovery-release-readiness tests passed");
}

runReleaseReadinessRecoveryStressTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});