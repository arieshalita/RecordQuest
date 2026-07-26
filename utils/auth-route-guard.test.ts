import { getProfileRedirectTarget, isRecoveryAuthRoute } from "./auth-route-guard";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testRecoveryRouteDetected(): void {
  assert(isRecoveryAuthRoute("/auth/callback"), "Expected callback route to be treated as recovery auth route");
  assert(isRecoveryAuthRoute("/auth/reset-password"), "Expected reset route to be treated as recovery auth route");
}

function testProfileRedirectWouldExistForCallbackWhenUsernameRequired(): void {
  const target = getProfileRedirectTarget({
    pathname: "/auth/callback",
    profileSetupStatus: "username-required",
    hasUserId: true,
  });

  assert(target === "/choose-username", `Expected username setup redirect target, got: ${target}`);
}

function run(): void {
  testRecoveryRouteDetected();
  testProfileRedirectWouldExistForCallbackWhenUsernameRequired();
  console.log("auth-route-guard tests passed");
}

run();
