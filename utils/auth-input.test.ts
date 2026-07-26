import { mapPasswordResetErrorMessage } from "./auth-input";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testRateLimitByStatusCode(): void {
  const actual = mapPasswordResetErrorMessage("429 Too Many Requests");
  assert(
    actual === "Too many reset emails were requested. Please wait and try again later.",
    `Expected 429 rate-limit message, got: ${actual}`
  );
}

function testRateLimitBySupabaseCode(): void {
  const actual = mapPasswordResetErrorMessage("over_email_send_rate_limit");
  assert(
    actual === "Too many reset emails were requested. Please wait and try again later.",
    `Expected Supabase rate-limit message, got: ${actual}`
  );
}

function testNetworkMapping(): void {
  const actual = mapPasswordResetErrorMessage("Failed to fetch");
  assert(actual === "Network error. Check your connection and try again.", `Expected network message, got: ${actual}`);
}

function testFallbackMessage(): void {
  const actual = mapPasswordResetErrorMessage("unexpected server error");
  assert(actual === "Could not send reset email right now. Please try again.", `Expected fallback message, got: ${actual}`);
}

function run(): void {
  testRateLimitByStatusCode();
  testRateLimitBySupabaseCode();
  testNetworkMapping();
  testFallbackMessage();
  console.log("auth-input tests passed");
}

run();
