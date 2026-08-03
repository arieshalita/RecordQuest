import assert from "node:assert/strict";
import { buildAuthRedirectUrl } from "./auth-redirect-url";

function runAuthRedirectUrlTests(): void {
  const callback = buildAuthRedirectUrl();
  assert.equal(callback, "recordquest://auth/callback", "default auth callback redirect must be host-style");

  const explicit = buildAuthRedirectUrl("auth/callback");
  assert.equal(explicit, "recordquest://auth/callback", "explicit callback path must remain host-style");

  const leadingSlash = buildAuthRedirectUrl("/auth/callback");
  assert.equal(leadingSlash, "recordquest://auth/callback", "leading slash callback input must normalize");

  assert.equal(
    callback.includes("recordquest:///auth/callback"),
    false,
    "triple-slash callback redirect must never be generated",
  );

  console.log("auth-redirect-url tests passed");
}

runAuthRedirectUrlTests();
