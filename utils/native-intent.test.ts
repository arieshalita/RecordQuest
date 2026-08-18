import assert from "node:assert/strict";
import { consumeRecentRecoveryIntent, normalizeNativeIntentPath } from "./native-intent";

function runNativeIntentTests(): void {
  const hostStyle = normalizeNativeIntentPath("recordquest://auth/callback?code=abc&type=recovery");
  assert.equal(
    hostStyle,
    "/auth/callback?code=abc&type=recovery",
    "host-style auth callback URL must normalize to /auth/callback",
  );

  const fragmentPayload = normalizeNativeIntentPath(
    "recordquest://auth/callback#access_token=tokenA&refresh_token=tokenB&type=recovery",
  );
  assert.equal(
    fragmentPayload,
    "/auth/callback?access_token=tokenA&refresh_token=tokenB&type=recovery#access_token=tokenA&refresh_token=tokenB&type=recovery",
    "fragment payload must be preserved and merged into query",
  );

  const strippedHostPath = normalizeNativeIntentPath("/callback?code=abc&type=recovery");
  assert.equal(
    strippedHostPath,
    "/auth/callback?code=abc&type=recovery",
    "stripped callback path must map to /auth/callback",
  );

  const consumedFreshIntent = consumeRecentRecoveryIntent();
  assert.equal(
    typeof consumedFreshIntent === "string" && consumedFreshIntent.includes("/auth/callback"),
    true,
    "fresh recovery callback intent should be available exactly once",
  );

  const consumedAgain = consumeRecentRecoveryIntent();
  assert.equal(consumedAgain, null, "consumed callback intent must not replay without a new deep link");

  normalizeNativeIntentPath("/auth/callback?code=old123&type=recovery");
  const expiredIntent = consumeRecentRecoveryIntent(Date.now() + 3 * 60 * 1000);
  assert.equal(expiredIntent, null, "recovery callback intent must expire to prevent stale replay on later launch");

  console.log("native-intent tests passed");
}

runNativeIntentTests();
