import assert from "node:assert/strict";
import { normalizeNativeIntentPath } from "./native-intent";

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

  console.log("native-intent tests passed");
}

runNativeIntentTests();
