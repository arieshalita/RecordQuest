import { buildAuthRedirectUrl } from "./auth-redirect-url";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testDefaultPath(): void {
  const actual = buildAuthRedirectUrl();
  assert(actual === "recordquest://auth/callback", `Expected default redirect, got: ${actual}`);
}

function testLeadingSlashNormalization(): void {
  const actual = buildAuthRedirectUrl("/auth/callback");
  assert(actual === "recordquest://auth/callback", `Expected normalized leading slash redirect, got: ${actual}`);
}

function testNoHostSegmentRouting(): void {
  const actual = buildAuthRedirectUrl("auth/callback");
  assert(actual === "recordquest://auth/callback", `Expected host-style redirect, got: ${actual}`);
}

function run(): void {
  testDefaultPath();
  testLeadingSlashNormalization();
  testNoHostSegmentRouting();
  console.log("auth-redirect-url tests passed");
}

run();
