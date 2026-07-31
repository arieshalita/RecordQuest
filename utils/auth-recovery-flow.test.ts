import { evaluateRecoveryAuthTransition, resolveRecoveryCompletion } from "./auth-recovery-flow";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testPasswordRecoveryActivates(): void {
  const transition = evaluateRecoveryAuthTransition({
    event: "PASSWORD_RECOVERY",
    recoveryActive: false,
    hasSession: true,
  });

  assert(transition.recoveryActive, "Expected PASSWORD_RECOVERY to activate recovery");
  assert(transition.navigationTarget === "/auth/reset-password", `Expected reset route, got: ${transition.navigationTarget}`);
  assert(transition.suppressNormalRedirect, "Expected recovery to suppress normal redirects");
}

function testSignedInDuringActiveRecoveryStaysInRecovery(): void {
  const transition = evaluateRecoveryAuthTransition({
    event: "SIGNED_IN",
    recoveryActive: true,
    hasSession: true,
  });

  assert(transition.recoveryActive, "Expected active recovery to stay active on SIGNED_IN");
  assert(transition.navigationTarget === "/auth/reset-password", `Expected reset route, got: ${transition.navigationTarget}`);
  assert(transition.suppressNormalRedirect, "Expected SIGNED_IN during recovery to suppress normal redirects");
}

function testInitialSessionDuringActiveRecoveryStaysInRecovery(): void {
  const transition = evaluateRecoveryAuthTransition({
    event: "INITIAL_SESSION",
    recoveryActive: true,
    hasSession: true,
  });

  assert(transition.recoveryActive, "Expected active recovery to stay active on INITIAL_SESSION");
  assert(transition.navigationTarget === "/auth/reset-password", `Expected reset route, got: ${transition.navigationTarget}`);
  assert(transition.suppressNormalRedirect, "Expected INITIAL_SESSION during recovery to suppress normal redirects");
}

function testNormalSignInUnchanged(): void {
  const transition = evaluateRecoveryAuthTransition({
    event: "SIGNED_IN",
    recoveryActive: false,
    hasSession: true,
  });

  assert(!transition.recoveryActive, "Expected normal sign-in to keep recovery inactive");
  assert(transition.navigationTarget === "/(tabs)", `Expected app route, got: ${transition.navigationTarget}`);
  assert(!transition.suppressNormalRedirect, "Expected normal sign-in to allow standard redirecting");
}

function testSignedOutClearsRecovery(): void {
  const transition = evaluateRecoveryAuthTransition({
    event: "SIGNED_OUT",
    recoveryActive: true,
    hasSession: false,
  });

  assert(!transition.recoveryActive, "Expected SIGNED_OUT to clear recovery state");
  assert(transition.navigationTarget === "/(auth)/sign-in", `Expected sign-in route, got: ${transition.navigationTarget}`);
  assert(!transition.suppressNormalRedirect, "Expected SIGNED_OUT not to suppress normal redirects");
}

function testPasswordUpdateCompletionClearsRecovery(): void {
  const completion = resolveRecoveryCompletion();

  assert(completion.clearRecoveryState, "Expected successful password update to clear recovery state");
  assert(completion.nextHref === "/(auth)/sign-in?reset=success", `Expected sign-in completion route, got: ${completion.nextHref}`);
}

function run(): void {
  testPasswordRecoveryActivates();
  testSignedInDuringActiveRecoveryStaysInRecovery();
  testInitialSessionDuringActiveRecoveryStaysInRecovery();
  testNormalSignInUnchanged();
  testSignedOutClearsRecovery();
  testPasswordUpdateCompletionClearsRecovery();
  console.log("auth-recovery-flow tests passed");
}

run();