import assert from "node:assert/strict";
import { isEmailNotConfirmedError, mapSignInErrorMessage, MIN_PASSWORD_LENGTH } from "./auth-input";

function runAuthSignInRegressionTests(): void {
  assert.equal(MIN_PASSWORD_LENGTH, 8, "minimum password length must remain unchanged for sign-in compatibility");
  assert.equal(
    mapSignInErrorMessage("Invalid login credentials"),
    "Incorrect email or password.",
    "normal sign-in invalid credential mapping must remain unchanged",
  );
  assert.equal(
    isEmailNotConfirmedError("Email not confirmed"),
    true,
    "normal sign-in email confirmation detection must remain unchanged",
  );

  console.log("auth-sign-in-regression tests passed");
}

runAuthSignInRegressionTests();
