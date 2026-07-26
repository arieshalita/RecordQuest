import {
  detectCallbackAuthMethod,
  mapRecoveryCallbackError,
  validateRecoveryPassword,
} from "./auth-recovery";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testMissingPassword(): void {
  const result = validateRecoveryPassword("", "");
  assert(!result.valid, "Expected empty passwords to be invalid");
}

function testMismatchedPasswords(): void {
  const result = validateRecoveryPassword("password123", "password124");
  assert(!result.valid, "Expected mismatched passwords to be invalid");
}

function testShortPassword(): void {
  const result = validateRecoveryPassword("short", "short");
  assert(!result.valid, "Expected short password to be invalid");
}

function testValidPassword(): void {
  const result = validateRecoveryPassword("validPass123", "validPass123");
  assert(result.valid, "Expected valid password to pass");
  assert(result.normalizedPassword === "validPass123", "Expected normalized password to match");
}

function testCallbackMissingCodeAndTokens(): void {
  const method = detectCallbackAuthMethod({
    code: "",
    accessToken: "",
    refreshToken: "",
    tokenHash: "",
    authType: "recovery",
  });

  assert(method === "none", "Expected callback auth method to be none when payload is incomplete");
}

function testExchangeFailureMapping(): void {
  const message = mapRecoveryCallbackError("invalid_grant");
  assert(
    message === "This password reset link is invalid or has expired. Request a new one.",
    "Expected invalid_grant to map to expired/invalid recovery link message"
  );
}

function testExpiredLinkMapping(): void {
  const message = mapRecoveryCallbackError("otp_expired");
  assert(
    message === "This password reset link is invalid or has expired. Request a new one.",
    "Expected otp_expired to map to expired/invalid recovery link message"
  );
}

function run(): void {
  testMissingPassword();
  testMismatchedPasswords();
  testShortPassword();
  testValidPassword();
  testCallbackMissingCodeAndTokens();
  testExchangeFailureMapping();
  testExpiredLinkMapping();
  console.log("auth-recovery tests passed");
}

run();
