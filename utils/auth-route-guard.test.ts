import {
  getProfileRedirectTarget,
  isRecoveryAuthRoute,
  shouldSuppressAuthenticatedRedirect,
} from "./auth-route-guard";

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

function testRecoveryRedirectSuppressedOnAppRoutes(): void {
  assert(
    shouldSuppressAuthenticatedRedirect({ pathname: "/(tabs)", recoveryActive: true }),
    "Expected recovery to suppress authenticated redirects on app routes"
  );
  assert(
    !shouldSuppressAuthenticatedRedirect({ pathname: "/auth/reset-password", recoveryActive: true }),
    "Expected reset-password route to remain accessible during recovery"
  );
}

function run(): void {
  testRecoveryRouteDetected();
  testProfileRedirectWouldExistForCallbackWhenUsernameRequired();
  testRecoveryRedirectSuppressedOnAppRoutes();
  console.log("auth-route-guard tests passed");
}

run();
