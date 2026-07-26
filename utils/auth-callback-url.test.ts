import { parseAuthCallbackUrl, resolveCallbackNavigationTarget } from "./auth-callback-url";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testPkceRecoveryUrl(): void {
  const parsed = parseAuthCallbackUrl("recordquest://auth/callback?code=abc123&type=recovery");
  assert(parsed.method === "exchangeCode", `Expected PKCE method exchangeCode, got: ${parsed.method}`);
  assert(parsed.authType === "recovery", `Expected recovery type, got: ${parsed.authType}`);
}

function testImplicitRecoveryUrl(): void {
  const parsed = parseAuthCallbackUrl(
    "recordquest://auth/callback#access_token=tokenA&refresh_token=tokenB&type=recovery"
  );
  assert(parsed.method === "setSession", `Expected implicit method setSession, got: ${parsed.method}`);
  assert(
    parsed.queryParamNames.includes("access_token") && parsed.queryParamNames.includes("refresh_token"),
    "Expected fragment auth params to be preserved in query names after normalization"
  );
}

function testInvalidRecoveryUrl(): void {
  const parsed = parseAuthCallbackUrl("recordquest://auth/callback?type=recovery");
  assert(parsed.method === "none", `Expected invalid payload to produce method none, got: ${parsed.method}`);
}

function testRecoveryNavigationTarget(): void {
  const target = resolveCallbackNavigationTarget({
    isRecoveryFlow: true,
    hasSessionUser: true,
  });

  assert(target === "/auth/reset-password", `Expected reset password target, got: ${target}`);
}

function run(): void {
  testPkceRecoveryUrl();
  testImplicitRecoveryUrl();
  testInvalidRecoveryUrl();
  testRecoveryNavigationTarget();
  console.log("auth-callback-url tests passed");
}

run();
