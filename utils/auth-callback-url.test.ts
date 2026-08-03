import assert from "node:assert/strict";
import { parseAuthCallbackUrl } from "./auth-callback-url";

function runAuthCallbackUrlTests(): void {
  const pkce = parseAuthCallbackUrl("recordquest://auth/callback?code=abc123&type=recovery");
  assert.equal(pkce.normalizedPathname, "/auth/callback", "host-style callback must normalize pathname to /auth/callback");
  assert.equal(pkce.method, "exchangeCode", "code payload must choose exchangeCode method");

  const implicit = parseAuthCallbackUrl(
    "recordquest://auth/callback#access_token=tokenA&refresh_token=tokenB&type=recovery",
  );
  assert.equal(implicit.method, "setSession", "token payload must choose setSession method");
  assert.equal(implicit.queryParamNames.includes("access_token"), true, "query params must preserve merged fragment payload");
  assert.equal(implicit.fragmentParamNames.includes("refresh_token"), true, "fragment params must remain observable");

  console.log("auth-callback-url tests passed");
}

runAuthCallbackUrlTests();
