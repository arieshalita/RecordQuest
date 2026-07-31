import type { EmailOtpType, Session } from "@supabase/supabase-js";
import { parseAuthCallbackUrl } from "./auth-callback-url";
import { mapRecoveryCallbackError, validateRecoveryPassword } from "./auth-recovery";

export type RecoveryCallbackResult = {
  success: boolean;
  navigationTarget: "/auth/reset-password" | "/(auth)/sign-in";
  method: "exchangeCode" | "setSession" | "verifyOtp" | "invalid";
  queryParamNames: string[];
  fragmentParamNames: string[];
  normalizedPathname: string;
  errorMessage?: string;
};

export type RecoveryCallbackDependencies = {
  exchangeCodeForSession: (code: string) => Promise<{ error: { message: string } | null }>;
  setSession: (input: { access_token: string; refresh_token: string }) => Promise<{ error: { message: string } | null }>;
  verifyOtp: (input: { token_hash: string; type: EmailOtpType }) => Promise<{ error: { message: string } | null }>;
  getSession: () => Promise<{ data: { session: Session | null }; error: unknown | null }>;
};

export type PasswordResetSubmissionResult = {
  success: boolean;
  message?: string;
  error?: string;
  nextHref?: "/(auth)/sign-in?reset=success";
};

export type PasswordResetSubmissionDependencies = {
  getSession: () => Promise<{ data: { session: Session | null }; error: unknown | null }>;
  updateUser: (password: string) => Promise<{ error: { message: string } | null }>;
  signOutLocal: () => Promise<{ error: { message: string } | null }>;
};

export async function establishRecoverySessionFromUrl(
  inputUrl: string,
  deps: RecoveryCallbackDependencies
): Promise<RecoveryCallbackResult> {
  const parsed = parseAuthCallbackUrl(inputUrl);

  if (parsed.code) {
    const result = await deps.exchangeCodeForSession(parsed.code);

    if (result.error) {
      return {
        success: false,
        method: "exchangeCode",
        navigationTarget: "/(auth)/sign-in",
        queryParamNames: parsed.queryParamNames,
        fragmentParamNames: parsed.fragmentParamNames,
        normalizedPathname: parsed.normalizedPathname,
        errorMessage: mapRecoveryCallbackError(result.error.message),
      };
    }

    const sessionResult = await deps.getSession();

    return {
      success: Boolean(sessionResult.data.session?.user),
      method: "exchangeCode",
      navigationTarget: sessionResult.data.session?.user ? "/auth/reset-password" : "/(auth)/sign-in",
      queryParamNames: parsed.queryParamNames,
      fragmentParamNames: parsed.fragmentParamNames,
      normalizedPathname: parsed.normalizedPathname,
      errorMessage: sessionResult.data.session?.user ? undefined : "This password reset link is invalid or has expired. Request a new one.",
    };
  }

  const accessToken = parsed.accessToken;
  const refreshToken = parsed.refreshToken;
  const tokenHash = parsed.tokenHash;
  const type = parsed.authType as EmailOtpType | null;

  if (accessToken && refreshToken) {
    const result = await deps.setSession({ access_token: accessToken, refresh_token: refreshToken });

    if (result.error) {
      return {
        success: false,
        method: "setSession",
        navigationTarget: "/(auth)/sign-in",
        queryParamNames: parsed.queryParamNames,
        fragmentParamNames: parsed.fragmentParamNames,
        normalizedPathname: parsed.normalizedPathname,
        errorMessage: mapRecoveryCallbackError(result.error.message),
      };
    }

    const sessionResult = await deps.getSession();

    return {
      success: Boolean(sessionResult.data.session?.user),
      method: "setSession",
      navigationTarget: sessionResult.data.session?.user ? "/auth/reset-password" : "/(auth)/sign-in",
      queryParamNames: parsed.queryParamNames,
      fragmentParamNames: parsed.fragmentParamNames,
      normalizedPathname: parsed.normalizedPathname,
      errorMessage: sessionResult.data.session?.user ? undefined : "This password reset link is invalid or has expired. Request a new one.",
    };
  }

  if (tokenHash && type) {
    const result = await deps.verifyOtp({ token_hash: tokenHash, type });

    if (result.error) {
      return {
        success: false,
        method: "verifyOtp",
        navigationTarget: "/(auth)/sign-in",
        queryParamNames: parsed.queryParamNames,
        fragmentParamNames: parsed.fragmentParamNames,
        normalizedPathname: parsed.normalizedPathname,
        errorMessage: mapRecoveryCallbackError(result.error.message),
      };
    }

    const sessionResult = await deps.getSession();

    return {
      success: Boolean(sessionResult.data.session?.user),
      method: "verifyOtp",
      navigationTarget: sessionResult.data.session?.user ? "/auth/reset-password" : "/(auth)/sign-in",
      queryParamNames: parsed.queryParamNames,
      fragmentParamNames: parsed.fragmentParamNames,
      normalizedPathname: parsed.normalizedPathname,
      errorMessage: sessionResult.data.session?.user ? undefined : "This password reset link is invalid or has expired. Request a new one.",
    };
  }

  return {
    success: false,
    method: "invalid",
    navigationTarget: "/(auth)/sign-in",
    queryParamNames: parsed.queryParamNames,
    fragmentParamNames: parsed.fragmentParamNames,
    normalizedPathname: parsed.normalizedPathname,
    errorMessage: "This link is malformed or incomplete. Request a new verification email and try again.",
  };
}

export async function submitRecoveryPasswordUpdate(
  passwordInput: string,
  confirmPasswordInput: string,
  deps: PasswordResetSubmissionDependencies
): Promise<PasswordResetSubmissionResult> {
  const validation = validateRecoveryPassword(passwordInput, confirmPasswordInput);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error ?? "Enter and confirm your new password.",
    };
  }

  const sessionResult = await deps.getSession();
  if (sessionResult.error || !sessionResult.data.session?.user) {
    return {
      success: false,
      error: "This password reset link is invalid or has expired. Request a new one.",
    };
  }

  const updateResult = await deps.updateUser(validation.normalizedPassword);
  if (updateResult.error) {
    return {
      success: false,
      error: mapRecoveryCallbackError(updateResult.error.message),
    };
  }

  const signOutResult = await deps.signOutLocal();
  if (signOutResult.error) {
    return {
      success: false,
      error: "Your password was updated, but the session could not be cleared. Please sign out manually.",
    };
  }

  return {
    success: true,
    message: "Password updated. Sign in with your new password.",
    nextHref: "/(auth)/sign-in?reset=success",
  };
}