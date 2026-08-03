import assert from "node:assert/strict";
import type { Session } from "@supabase/supabase-js";
import {
  processRecoveryCallbackAttempt,
  submitRecoveryPasswordUpdate,
} from "./auth-recovery-flow";
import { mapSignInErrorMessage } from "./auth-input";

function makeSessionResult(hasUser: boolean): { data: { session: Session | null }; error: null } {
  const mockSession = hasUser
    ? ({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        expires_at: Date.now() + 3600,
        token_type: "bearer",
        user: { id: "user-1" },
      } as unknown as Session)
    : null;

  return {
    data: {
      session: mockSession,
    },
    error: null,
  };
}

async function runAuthRecoveryFlowTests(): Promise<void> {
  const consumed = new Set<string>();

  const recoverySuccess = await processRecoveryCallbackAttempt(
    {
      inputUrl: "recordquest://auth/callback?code=abc123&type=recovery",
      fallbackQuery: new URLSearchParams(),
      consumedKeys: consumed,
      isDev: false,
      devRecoveryUrl: null,
      timeoutMs: 500,
    },
    {
      exchangeCodeForSession: async () => ({ error: null }),
      setSession: async () => ({ error: null }),
      verifyOtp: async () => ({ error: null }),
      getSession: async () => makeSessionResult(true),
      signOutLocal: async () => ({ error: null }),
    },
  );

  assert.equal(recoverySuccess.status, "success", "callback should complete to success for recovery code links");
  if (recoverySuccess.status === "success") {
    assert.equal(recoverySuccess.nextHref, "/auth/reset-password");
  }

  const duplicateResult = await processRecoveryCallbackAttempt(
    {
      inputUrl: "recordquest://auth/callback?code=abc123&type=recovery",
      fallbackQuery: new URLSearchParams(),
      consumedKeys: consumed,
      isDev: false,
      devRecoveryUrl: null,
      timeoutMs: 500,
    },
    {
      exchangeCodeForSession: async () => ({ error: null }),
      setSession: async () => ({ error: null }),
      verifyOtp: async () => ({ error: null }),
      getSession: async () => makeSessionResult(false),
      signOutLocal: async () => ({ error: null }),
    },
  );

  assert.equal(duplicateResult.status, "error", "duplicate callback should be suppressed deterministically");
  if (duplicateResult.status === "error") {
    assert.equal(duplicateResult.reason, "duplicate");
  }

  const timeoutResult = await processRecoveryCallbackAttempt(
    {
      inputUrl: "recordquest://auth/callback?code=slow&type=recovery",
      fallbackQuery: new URLSearchParams(),
      consumedKeys: new Set<string>(),
      isDev: false,
      devRecoveryUrl: null,
      timeoutMs: 10,
    },
    {
      exchangeCodeForSession: async () => {
        await new Promise<void>(() => {
          // Intentionally unresolved promise for timeout coverage.
        });
        return { error: null };
      },
      setSession: async () => ({ error: null }),
      verifyOtp: async () => ({ error: null }),
      getSession: async () => makeSessionResult(true),
      signOutLocal: async () => ({ error: null }),
    },
  );

  assert.equal(timeoutResult.status, "error", "callback should terminate with a timeout error");
  if (timeoutResult.status === "error") {
    assert.equal(timeoutResult.reason, "timeout");
  }

  const nonRecoveryResult = await processRecoveryCallbackAttempt(
    {
      inputUrl: "recordquest://auth/callback?code=confirm123&type=signup",
      fallbackQuery: new URLSearchParams(),
      consumedKeys: new Set<string>(),
      isDev: false,
      devRecoveryUrl: null,
      timeoutMs: 500,
    },
    {
      exchangeCodeForSession: async () => ({ error: null }),
      setSession: async () => ({ error: null }),
      verifyOtp: async () => ({ error: null }),
      getSession: async () => makeSessionResult(true),
      signOutLocal: async () => ({ error: null }),
    },
  );

  assert.equal(nonRecoveryResult.status, "error", "callback must reject non-recovery payloads");
  if (nonRecoveryResult.status === "error") {
    assert.equal(nonRecoveryResult.nextHref, "/(auth)/sign-in", "callback must not navigate to tabs");
  }

  const mismatchValidation = await submitRecoveryPasswordUpdate(
    {
      password: "password123",
      confirmPassword: "password124",
      minLength: 8,
    },
    {
      getSession: async () => makeSessionResult(true),
      updateUser: async () => ({ error: null }),
      signOutLocal: async () => ({ error: null }),
    },
  );

  assert.equal(mismatchValidation.success, false, "passwords must match before update");

  let updateCalls = 0;
  let signOutCalls = 0;
  const updateSuccess = await submitRecoveryPasswordUpdate(
    {
      password: "password123",
      confirmPassword: "password123",
      minLength: 8,
    },
    {
      getSession: async () => makeSessionResult(true),
      updateUser: async () => {
        updateCalls += 1;
        return { error: null };
      },
      signOutLocal: async () => {
        signOutCalls += 1;
        return { error: null };
      },
    },
  );

  assert.equal(updateSuccess.success, true, "password update should succeed when session is valid");
  assert.equal(updateCalls, 1, "updateUser should be called exactly once");
  assert.equal(signOutCalls, 1, "local sign-out should run after password update");

  assert.equal(
    mapSignInErrorMessage("Invalid login credentials"),
    "Incorrect email or password.",
    "normal sign-in error mapping should remain stable",
  );

  console.log("auth-recovery-flow tests passed");
}

runAuthRecoveryFlowTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
