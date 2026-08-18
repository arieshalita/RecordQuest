import assert from "node:assert/strict";
import { containsBlockedPublicTerm, validatePublicProfileText } from "./public-text-safety";

function runPublicTextSafetyTests(): void {
  assert.equal(containsBlockedPublicTerm("Friendly collector"), false);
  assert.equal(containsBlockedPublicTerm("This is shit"), true);
  assert.equal(containsBlockedPublicTerm("What the FUCK"), true);

  assert.equal(validatePublicProfileText("Great Name", "All good here"), null);
  assert.equal(
    validatePublicProfileText("BitchyName", "all good"),
    "Display name contains disallowed language."
  );
  assert.equal(
    validatePublicProfileText("Great Name", "I am an asshole"),
    "Bio contains disallowed language."
  );

  console.log("public-text-safety tests passed");
}

runPublicTextSafetyTests();
