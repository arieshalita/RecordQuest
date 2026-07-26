export const RECOVERY_PASSWORD_MIN_LENGTH = 8;

export type RecoveryPasswordValidationResult = {
  valid: boolean;
  normalizedPassword: string;
  error?: string;
};

export type CallbackAuthMethod = "exchangeCode" | "setSession" | "verifyOtp" | "none";

export function validateRecoveryPassword(
  passwordInput: string,
  confirmPasswordInput: string
): RecoveryPasswordValidationResult {
  const password = passwordInput.trim();
  const confirmPassword = confirmPasswordInput.trim();

  if (!password || !confirmPassword) {
    return {
      valid: false,
      normalizedPassword: "",
      error: "Enter and confirm your new password.",
    };
  }

  if (password.length < RECOVERY_PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      normalizedPassword: "",
      error: "Use a password with at least 8 characters.",
    };
  }

  if (password !== confirmPassword) {
    return {
      valid: false,
      normalizedPassword: "",
      error: "Passwords do not match.",
    };
  }

  return {
    valid: true,
    normalizedPassword: password,
  };
}

export function mapRecoveryCallbackError(error: string | null | undefined): string {
  const source = (error ?? "").toLowerCase();

  if (source.includes("expired") || source.includes("otp_expired") || source.includes("invalid_grant")) {
    return "This password reset link is invalid or has expired. Request a new one.";
  }

  if (source.includes("already") || source.includes("used") || source.includes("invalid")) {
    return "This password reset link is invalid or has expired. Request a new one.";
  }

  if (source.includes("network") || source.includes("fetch") || source.includes("timeout")) {
    return "Network error. Check your connection and try again.";
  }

  return "We couldn't verify this reset link. Request a new one and try again.";
}

export function mapRecoveryUpdateError(error: string | null | undefined): string {
  const source = (error ?? "").toLowerCase();

  if (source.includes("expired") || source.includes("invalid") || source.includes("session")) {
    return "Your reset session is invalid or expired. Request a new password reset link.";
  }

  if (source.includes("password")) {
    return "Use a stronger password and try again.";
  }

  if (source.includes("network") || source.includes("fetch") || source.includes("timeout")) {
    return "Network error. Check your connection and try again.";
  }

  return "We couldn't update your password right now. Please try again.";
}

export function detectCallbackAuthMethod(input: {
  code?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenHash?: string | null;
  authType?: string | null;
}): CallbackAuthMethod {
  const code = input.code?.trim() ?? "";
  const accessToken = input.accessToken?.trim() ?? "";
  const refreshToken = input.refreshToken?.trim() ?? "";
  const tokenHash = input.tokenHash?.trim() ?? "";
  const authType = input.authType?.trim() ?? "";

  if (code) {
    return "exchangeCode";
  }

  if (accessToken && refreshToken) {
    return "setSession";
  }

  if (tokenHash && authType) {
    return "verifyOtp";
  }

  return "none";
}
