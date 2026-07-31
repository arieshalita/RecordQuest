import { establishRecoverySessionFromUrl, submitRecoveryPasswordUpdate } from "./auth-recovery-flow";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function testColdStartImplicitRecoveryUrl(): Promise<void> {
  const result = await establishRecoverySessionFromUrl(
    "recordquest://auth/callback#access_token=sessionA&refresh_token=sessionB&type=recovery",
    {
      exchangeCodeForSession: async () => ({ error: null }),
      setSession: async () => ({ error: null }),
      verifyOtp: async () => ({ error: null }),
      getSession: async () => ({ data: { session: { user: { id: "user-1" } } as never }, error: null }),
    }
  );

  assert(result.success, "Expected implicit recovery URL to establish a session");
  assert(result.navigationTarget === "/auth/reset-password", `Expected reset route, got: ${result.navigationTarget}`);
}

async function testAlreadyRunningAppEventUrl(): Promise<void> {
  const result = await establishRecoverySessionFromUrl(
    "recordquest://auth/callback?code=abc123&type=recovery",
    {
      exchangeCodeForSession: async () => ({ error: null }),
      setSession: async () => ({ error: null }),
      verifyOtp: async () => ({ error: null }),
      getSession: async () => ({ data: { session: { user: { id: "user-1" } } as never }, error: null }),
    }
  );

  assert(result.success, "Expected event URL to establish a session");
  assert(result.method === "exchangeCode", `Expected PKCE method, got: ${result.method}`);
}

async function testPkceRecoveryEstablishesSession(): Promise<void> {
  const result = await establishRecoverySessionFromUrl("recordquest://auth/callback?code=pkce-code&type=recovery", {
    exchangeCodeForSession: async (code) => ({ error: code === "pkce-code" ? null : { message: "unexpected" } }),
    setSession: async () => ({ error: null }),
    verifyOtp: async () => ({ error: null }),
    getSession: async () => ({ data: { session: { user: { id: "user-1" } } as never }, error: null }),
  });

  assert(result.success, "Expected PKCE recovery to establish a session");
  assert(result.method === "exchangeCode", `Expected exchangeCode method, got: ${result.method}`);
}

async function testImplicitRecoveryEstablishesSession(): Promise<void> {
  const result = await establishRecoverySessionFromUrl(
    "recordquest://auth/callback#access_token=sessionA&refresh_token=sessionB&type=recovery",
    {
      exchangeCodeForSession: async () => ({ error: null }),
      setSession: async (input) => ({ error: input.access_token && input.refresh_token ? null : { message: "missing tokens" } }),
      verifyOtp: async () => ({ error: null }),
      getSession: async () => ({ data: { session: { user: { id: "user-1" } } as never }, error: null }),
    }
  );

  assert(result.success, "Expected implicit recovery tokens to establish a session");
  assert(result.method === "setSession", `Expected setSession method, got: ${result.method}`);
}

async function testInvalidRecoveryUrlShowsError(): Promise<void> {
  const result = await establishRecoverySessionFromUrl("recordquest://auth/callback?type=recovery", {
    exchangeCodeForSession: async () => ({ error: null }),
    setSession: async () => ({ error: null }),
    verifyOtp: async () => ({ error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
  });

  assert(!result.success, "Expected invalid recovery URL to fail");
  assert(result.method === "invalid", `Expected invalid method, got: ${result.method}`);
}

async function testSuccessReturnsResetPasswordRoute(): Promise<void> {
  const result = await establishRecoverySessionFromUrl("recordquest://auth/callback?code=pkce-code&type=recovery", {
    exchangeCodeForSession: async () => ({ error: null }),
    setSession: async () => ({ error: null }),
    verifyOtp: async () => ({ error: null }),
    getSession: async () => ({ data: { session: { user: { id: "user-1" } } as never }, error: null }),
  });

  assert(result.navigationTarget === "/auth/reset-password", `Expected reset route, got: ${result.navigationTarget}`);
}

async function testPasswordMismatchBlocksSubmission(): Promise<void> {
  const result = await submitRecoveryPasswordUpdate(
    "validPass123",
    "differentPass123",
    {
      getSession: async () => ({ data: { session: { user: { id: "user-1" } } as never }, error: null }),
      updateUser: async () => ({ error: null }),
      signOutLocal: async () => ({ error: null }),
    }
  );

  assert(!result.success, "Expected mismatched passwords to fail");
  assert(result.error === "Passwords do not match.", `Expected mismatch error, got: ${result.error}`);
}

async function testValidPasswordsCallUpdateUser(): Promise<void> {
  let updateCalls = 0;
  const result = await submitRecoveryPasswordUpdate(
    "validPass123",
    "validPass123",
    {
      getSession: async () => ({ data: { session: { user: { id: "user-1" } } as never }, error: null }),
      updateUser: async () => {
        updateCalls += 1;
        return { error: null };
      },
      signOutLocal: async () => ({ error: null }),
    }
  );

  assert(result.success, "Expected valid passwords to proceed");
  assert(updateCalls === 1, "Expected updateUser to be called once");
}

async function testSuccessfulUpdateSignsOutLocally(): Promise<void> {
  let signOutCalls = 0;
  const result = await submitRecoveryPasswordUpdate(
    "validPass123",
    "validPass123",
    {
      getSession: async () => ({ data: { session: { user: { id: "user-1" } } as never }, error: null }),
      updateUser: async () => ({ error: null }),
      signOutLocal: async () => {
        signOutCalls += 1;
        return { error: null };
      },
    }
  );

  assert(result.success, "Expected successful update to pass");
  assert(signOutCalls === 1, "Expected local sign-out to be called once");
}

async function testSuccessfulUpdateReturnsToSignIn(): Promise<void> {
  const result = await submitRecoveryPasswordUpdate(
    "validPass123",
    "validPass123",
    {
      getSession: async () => ({ data: { session: { user: { id: "user-1" } } as never }, error: null }),
      updateUser: async () => ({ error: null }),
      signOutLocal: async () => ({ error: null }),
    }
  );

  assert(result.nextHref === "/(auth)/sign-in?reset=success", `Expected sign-in route, got: ${result.nextHref}`);
}

async function run(): Promise<void> {
  await testColdStartImplicitRecoveryUrl();
  await testAlreadyRunningAppEventUrl();
  await testPkceRecoveryEstablishesSession();
  await testImplicitRecoveryEstablishesSession();
  await testInvalidRecoveryUrlShowsError();
  await testSuccessReturnsResetPasswordRoute();
  await testPasswordMismatchBlocksSubmission();
  await testValidPasswordsCallUpdateUser();
  await testSuccessfulUpdateSignsOutLocally();
  await testSuccessfulUpdateReturnsToSignIn();
  console.log("auth-recovery-flow tests passed");
}

void run();
