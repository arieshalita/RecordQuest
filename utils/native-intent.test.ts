import { normalizeNativeIntentPath } from "./native-intent";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testCallbackQueryPreserved(): void {
  const actual = normalizeNativeIntentPath("recordquest://auth/callback?code=test");
  assert(actual === "/auth/callback?code=test", `Expected normalized callback query path, got: ${actual}`);
}

function testCallbackFragmentPreserved(): void {
  const actual = normalizeNativeIntentPath("recordquest://auth/callback#access_token=test");
  assert(
    actual === "/auth/callback?access_token=test#access_token=test",
    `Expected normalized callback fragment path, got: ${actual}`
  );
}

function testHostStrippedCallbackPath(): void {
  const actual = normalizeNativeIntentPath("/callback?code=test");
  assert(actual === "/auth/callback?code=test", `Expected host-stripped callback path normalization, got: ${actual}`);
}

function testAuthPathWithoutLeadingSlash(): void {
  const actual = normalizeNativeIntentPath("auth/callback?code=test");
  assert(actual === "/auth/callback?code=test", `Expected auth callback normalization without leading slash, got: ${actual}`);
}

function testMalformedUrlPassThrough(): void {
  const actual = normalizeNativeIntentPath("recordquest://%");
  assert(actual === "recordquest://%", `Expected malformed URL pass-through, got: ${actual}`);
}

function testNonAuthLinkPassThrough(): void {
  const actual = normalizeNativeIntentPath("recordquest://store/123?x=1#top");
  assert(actual === "recordquest://store/123?x=1#top", `Expected non-auth deep link to remain unchanged, got: ${actual}`);
}

function testAlreadyNormalizedPathPassThrough(): void {
  const actual = normalizeNativeIntentPath("/auth/callback?code=test#frag");
  assert(actual === "/auth/callback?code=test#frag", `Expected internal callback path to remain unchanged, got: ${actual}`);
}

function run(): void {
  testCallbackQueryPreserved();
  testCallbackFragmentPreserved();
  testHostStrippedCallbackPath();
  testAuthPathWithoutLeadingSlash();
  testMalformedUrlPassThrough();
  testNonAuthLinkPassThrough();
  testAlreadyNormalizedPathPassThrough();
  console.log("native-intent tests passed");
}

run();
