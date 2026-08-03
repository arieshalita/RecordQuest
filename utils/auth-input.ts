const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

export function mapSignInErrorMessage(error: string | null | undefined): string {
  const source = (error ?? "").toLowerCase();

  if (source.includes("email not confirmed")) {
    return "Check your inbox and verify your email before signing in.";
  }

  if (source.includes("invalid login") || source.includes("invalid credentials")) {
    return "Incorrect email or password.";
  }

  if (source.includes("rate limit") || source.includes("too many")) {
    return "Too many sign-in attempts. Please wait and try again.";
  }

  if (source.includes("network") || source.includes("failed to fetch") || source.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }

  return "Could not sign in right now. Please try again.";
}

export function isEmailNotConfirmedError(error: string | null | undefined): boolean {
  return (error ?? "").toLowerCase().includes("email not confirmed");
}

export function validateResetPasswordInputs(
  newPasswordInput: string,
  confirmPasswordInput: string,
): { valid: true; password: string } | { valid: false; error: string } {
  const newPassword = newPasswordInput.trim();
  const confirmPassword = confirmPasswordInput.trim();

  if (!newPassword || !confirmPassword) {
    return { valid: false, error: "Enter and confirm your new password." };
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  if (newPassword !== confirmPassword) {
    return { valid: false, error: "New password and confirmation must match." };
  }

  return { valid: true, password: newPassword };
}

export function mapSignUpErrorMessage(error: string | null | undefined): string {
  const source = (error ?? "").toLowerCase();

  if (source.includes("username") && (source.includes("taken") || source.includes("exists") || source.includes("duplicate") || source.includes("unique"))) {
    return "That username is already taken. Try another one.";
  }

  if (source.includes("already registered") || source.includes("already been registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }

  if (source.includes("rate limit") || source.includes("too many")) {
    return "Too many sign-up attempts. Please wait and try again.";
  }

  if (source.includes("network") || source.includes("failed to fetch") || source.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }

  if (source.includes("password")) {
    return "Use a stronger password and try again.";
  }

  return "Could not create your account right now. Please try again.";
}

export function mapPasswordResetErrorMessage(_error: string | null | undefined): string {
  return "Could not send reset email right now. Please try again.";
}

export function mapPasswordUpdateErrorMessage(error: string | null | undefined): string {
  const source = (error ?? "").toLowerCase();

  if (source.includes("expired") || source.includes("invalid") || source.includes("session")) {
    return "This password reset session is no longer valid. Request a new reset link.";
  }

  if (source.includes("password")) {
    return "Use a stronger password and try again.";
  }

  if (source.includes("network") || source.includes("failed to fetch") || source.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }

  return "We couldn't update your password right now. Please try again.";
}
