const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export function mapSignUpErrorMessage(error: string | null | undefined): string {
  const source = (error ?? "").toLowerCase();

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
