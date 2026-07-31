import type { AuthChangeEvent } from "@supabase/supabase-js";

export type RecoveryAuthRoute = "/auth/reset-password" | "/(auth)/sign-in" | "/(tabs)";

export type RecoveryAuthTransition = {
  recoveryActive: boolean;
  navigationTarget: RecoveryAuthRoute | null;
  suppressNormalRedirect: boolean;
};

export type RecoveryCompletionResult = {
  clearRecoveryState: boolean;
  nextHref: "/(auth)/sign-in?reset=success";
};

export function isRecoveryAuthEvent(event: AuthChangeEvent): boolean {
  return event === "PASSWORD_RECOVERY";
}

export function evaluateRecoveryAuthTransition(input: {
  event: AuthChangeEvent;
  recoveryActive: boolean;
  hasSession: boolean;
}): RecoveryAuthTransition {
  if (input.event === "SIGNED_OUT") {
    return {
      recoveryActive: false,
      navigationTarget: "/(auth)/sign-in",
      suppressNormalRedirect: false,
    };
  }

  if (input.event === "PASSWORD_RECOVERY") {
    return {
      recoveryActive: true,
      navigationTarget: input.hasSession ? "/auth/reset-password" : "/(auth)/sign-in",
      suppressNormalRedirect: true,
    };
  }

  if (input.recoveryActive) {
    return {
      recoveryActive: true,
      navigationTarget: input.hasSession ? "/auth/reset-password" : "/(auth)/sign-in",
      suppressNormalRedirect: true,
    };
  }

  return {
    recoveryActive: false,
    navigationTarget: input.hasSession ? "/(tabs)" : "/(auth)/sign-in",
    suppressNormalRedirect: false,
  };
}

export function resolveRecoveryCompletion(): RecoveryCompletionResult {
  return {
    clearRecoveryState: true,
    nextHref: "/(auth)/sign-in?reset=success",
  };
}