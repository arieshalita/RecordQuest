import assert from "node:assert/strict";
import { isRecoveryAuthRoute } from "./auth-route-guard";

function runAuthRouteGuardTests(): void {
  assert.equal(isRecoveryAuthRoute("/auth/callback"), true, "callback route must be protected from auth redirects");
  assert.equal(isRecoveryAuthRoute("/auth/reset-password"), true, "reset-password route must be protected from auth redirects");
  assert.equal(isRecoveryAuthRoute("/(auth)/sign-in"), false, "sign-in route is not a recovery route");
  assert.equal(isRecoveryAuthRoute("/(tabs)"), false, "main app tabs are not recovery routes");

  console.log("auth-route-guard tests passed");
}

runAuthRouteGuardTests();
