import type { EmailOtpType, Session } from "@supabase/supabase-js";
import { mapPasswordUpdateErrorMessage } from "./auth-input";
import { parseAuthCallbackUrl } from "./auth-callback-url";

export const RECOVERY_CALLBACK_TIMEOUT_MS = 10_000;

export type CallbackNextHref = "/auth/reset-password" | "/(auth)/sign-in";

type ParsedCallbackPayload = {
  callbackKey: string;
  method: "exchangeCode" | "setSession" | "verifyOtp" | "invalid";
  isRecovery: boolean;
  hasAuthPayload: boolean;
  queryError: string | null;
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  authType: EmailOtpType | null;
};

export type CallbackProcessResult =
  | {
      status: "success";
      nextHref: CallbackNextHref;
      title: string;
      message: string;
    }
  | {
      status: "error";
      nextHref: "/(auth)/sign-in";
      title: string;
      message: string;
      reason:
        | "invalid-link"
        | "duplicate"
        | "timeout"
        | "supabase-error"
        | "missing-session"
        | "callback-error";
    };

export type CallbackProcessDependencies = {
  exchangeCodeForSession: (code: string) => Promise<{ error: { message: string } | null }>;
  setSession: (input: { access_token: string; refresh_token: string }) => Promise<{ error: { message: string } | null }>;
  verifyOtp: (input: { token_hash: string; type: EmailOtpType }) => Promise<{ error: { message: string } | null }>;
  getSession: () => Promise<{ data: { session: Session | null }; error: unknown | null }>;
  signOutLocal: () => Promise<{ error: { message: string } | null }>;
};

export type PasswordResetDependencies = {
  getSession: () => Promise<{ data: { session: Session | null }; error: unknown | null }>;
  updateUser: (password: string) => Promise<{ error: { message: string } | null }>;
  signOutLocal: () => Promise<{ error: { message: string } | null }>;
};

export type PasswordResetSubmitResult =
  | {
      success: true;
      nextHref: "/(auth)/sign-in?reset=success";
      message: "Password updated. Sign in with your new password.";
    }
  | {
      success: false;
      error: string;
    };

function mapCallbackErrorMessage(error: string | null | undefined): string {
  const source = (error ?? "").toLowerCase();

  if (source.includes("expired")) {
    return "This link has expired. Request a new link and try again.";
  }

  if (source.includes("invalid") || source.includes("already")) {
    return "This link is invalid or already used. Request a new link and try again.";
  }

  if (source.includes("network") || source.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }

  return "We couldn't verify this link. Request a new password reset email and try again.";
}

function toSupportedOtpType(rawType: string | null): EmailOtpType | null {
  if (!rawType) {
    return null;
  }

  const normalized = rawType.trim().toLowerCase();
  const supported: ReadonlyArray<EmailOtpType> = ["signup", "invite", "recovery", "email", "email_change"];
  return supported.includes(normalized as EmailOtpType) ? (normalized as EmailOtpType) : null;
}

function parsePayload(inputUrl: string): ParsedCallbackPayload {
  const parsed = parseAuthCallbackUrl(inputUrl);
  const code = parsed.code;
  const accessToken = parsed.accessToken;
  const refreshToken = parsed.refreshToken;
  const tokenHash = parsed.tokenHash;
  const authTypeRaw = parsed.authType;
  const authType = toSupportedOtpType(authTypeRaw);
  const queryError = parsed.queryError;
  const method = parsed.method;

  const hasAuthPayload = Boolean(code || tokenHash || accessToken || refreshToken || parsed.queryError);

  const callbackKey = code
    ? `code:${authTypeRaw ?? ""}:${code.length}`
    : tokenHash
      ? `token_hash:${authTypeRaw ?? ""}:${tokenHash}`
      : accessToken || refreshToken
        ? `session_tokens:${authTypeRaw ?? ""}:${accessToken?.length ?? 0}:${refreshToken?.length ?? 0}`
        : `url:${inputUrl}`;

  return {
    callbackKey,
    method,
    isRecovery: authTypeRaw?.toLowerCase() === "recovery",
    hasAuthPayload,
    queryError,
    code,
    accessToken,
    refreshToken,
    tokenHash,
    authType,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("recovery-timeout"));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function processRecoveryCallbackAttempt(
  input: {
    inputUrl: string | null;
    fallbackQuery: URLSearchParams;
    consumedKeys: Set<string>;
    isDev: boolean;
    devRecoveryUrl: string | null;
    timeoutMs?: number;
  },
  deps: CallbackProcessDependencies,
): Promise<CallbackProcessResult> {
  const fallbackQueryString = input.fallbackQuery.toString();
  const fallbackUrl = fallbackQueryString
    ? `recordquest://auth/callback?${fallbackQueryString}`
    : null;

  const effectiveUrl =
    input.isDev && input.devRecoveryUrl
      ? input.devRecoveryUrl
      : input.inputUrl ?? fallbackUrl;

  if (!effectiveUrl) {
    return {
      status: "error",
      nextHref: "/(auth)/sign-in",
      title: "Invalid Link",
      message: "This link is malformed or incomplete. Request a new reset link and try again.",
      reason: "invalid-link",
    };
  }

  let payload: ParsedCallbackPayload;
  try {
    payload = parsePayload(effectiveUrl);
  } catch {
    return {
      status: "error",
      nextHref: "/(auth)/sign-in",
      title: "Invalid Link",
      message: "This link is malformed or incomplete. Request a new reset link and try again.",
      reason: "invalid-link",
    };
  }

  if (!payload.hasAuthPayload) {
    return {
      status: "error",
      nextHref: "/(auth)/sign-in",
      title: "Invalid Link",
      message: "This link is malformed or incomplete. Request a new reset link and try again.",
      reason: "invalid-link",
    };
  }

  if (payload.queryError) {
    return {
      status: "error",
      nextHref: "/(auth)/sign-in",
      title: "Verification Failed",
      message: mapCallbackErrorMessage(payload.queryError),
      reason: "callback-error",
    };
  }

  if (input.consumedKeys.has(payload.callbackKey)) {
    const { data } = await deps.getSession();
    if (payload.isRecovery && data.session?.user) {
      return {
        status: "success",
        nextHref: "/auth/reset-password",
        title: "Link Verified",
        message: "Your password reset link is verified. Set your new password.",
      };
    }

    return {
      status: "error",
      nextHref: "/(auth)/sign-in",
      title: "Link Already Used",
      message: "This link was already processed. Request a new reset link to continue.",
      reason: "duplicate",
    };
  }

  input.consumedKeys.add(payload.callbackKey);

  if (!payload.isRecovery) {
    return {
      status: "error",
      nextHref: "/(auth)/sign-in",
      title: "Invalid Link",
      message: "This link is not a password reset link. Request a new reset link and try again.",
      reason: "invalid-link",
    };
  }

  const operation = (async (): Promise<CallbackProcessResult> => {
    if (payload.isRecovery) {
      await deps.signOutLocal();
    }

    if (payload.method === "exchangeCode" && payload.code) {
      const { error } = await deps.exchangeCodeForSession(payload.code);
      if (error) {
        return {
          status: "error",
          nextHref: "/(auth)/sign-in",
          title: "Verification Failed",
          message: mapCallbackErrorMessage(error.message),
          reason: "supabase-error",
        };
      }
    } else if (payload.method === "setSession" && payload.accessToken && payload.refreshToken) {
      const { error } = await deps.setSession({
        access_token: payload.accessToken,
        refresh_token: payload.refreshToken,
      });
      if (error) {
        return {
          status: "error",
          nextHref: "/(auth)/sign-in",
          title: "Verification Failed",
          message: mapCallbackErrorMessage(error.message),
          reason: "supabase-error",
        };
      }
    } else if (payload.method === "verifyOtp" && payload.tokenHash && payload.authType) {
      const { error } = await deps.verifyOtp({
        token_hash: payload.tokenHash,
        type: payload.authType,
      });
      if (error) {
        return {
          status: "error",
          nextHref: "/(auth)/sign-in",
          title: "Verification Failed",
          message: mapCallbackErrorMessage(error.message),
          reason: "supabase-error",
        };
      }
    } else {
      return {
        status: "error",
        nextHref: "/(auth)/sign-in",
        title: "Invalid Link",
        message: "This link is malformed or incomplete. Request a new reset link and try again.",
        reason: "invalid-link",
      };
    }

    const { data, error } = await deps.getSession();
    if (error || !data.session?.user) {
      return {
        status: "error",
        nextHref: "/(auth)/sign-in",
        title: "Verification Failed",
        message: "This link is invalid or expired. Request a new reset link and try again.",
        reason: "missing-session",
      };
    }

    return {
      status: "success",
      nextHref: "/auth/reset-password",
      title: "Link Verified",
      message: "Your password reset link is verified. Set your new password.",
    };
  })();

  try {
    return await withTimeout(operation, input.timeoutMs ?? RECOVERY_CALLBACK_TIMEOUT_MS);
  } catch (error) {
    if (error instanceof Error && error.message === "recovery-timeout") {
      return {
        status: "error",
        nextHref: "/(auth)/sign-in",
        title: "Verification Timed Out",
        message: "Verification took too long. Request a new reset link and try again.",
        reason: "timeout",
      };
    }

    return {
      status: "error",
      nextHref: "/(auth)/sign-in",
      title: "Verification Failed",
      message: "We couldn't verify this link. Request a new reset link and try again.",
      reason: "supabase-error",
    };
  }
}

export async function submitRecoveryPasswordUpdate(
  input: {
    password: string;
    confirmPassword: string;
    minLength: number;
  },
  deps: PasswordResetDependencies,
): Promise<PasswordResetSubmitResult> {
  const normalizedPassword = input.password.trim();
  const normalizedConfirmPassword = input.confirmPassword.trim();

  if (!normalizedPassword || !normalizedConfirmPassword) {
    return { success: false, error: "Enter and confirm your new password." };
  }

  if (normalizedPassword.length < input.minLength) {
    return { success: false, error: `Password must be at least ${input.minLength} characters.` };
  }

  if (normalizedPassword !== normalizedConfirmPassword) {
    return { success: false, error: "New password and confirmation must match." };
  }

  const sessionResult = await deps.getSession();
  if (sessionResult.error || !sessionResult.data.session?.user) {
    return {
      success: false,
      error: "This password reset session is no longer valid. Request a new reset link.",
    };
  }

  const updateResult = await deps.updateUser(normalizedPassword);
  if (updateResult.error) {
    return {
      success: false,
      error: mapPasswordUpdateErrorMessage(updateResult.error.message),
    };
  }

  const signOutResult = await deps.signOutLocal();
  if (signOutResult.error) {
    return {
      success: false,
      error: "Password updated, but we couldn't clear your local session. Please sign out and sign in again.",
    };
  }

  return {
    success: true,
    message: "Password updated. Sign in with your new password.",
    nextHref: "/(auth)/sign-in?reset=success",
  };
}
