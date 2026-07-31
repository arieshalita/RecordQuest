export function isRecoveryAuthRoute(pathname: string): boolean {
  return pathname === "/auth/callback" || pathname === "/auth/reset-password";
}

export function getAuthRouteCategory(pathname: string): "recovery" | "auth" | "tabs" | "profile" | "other" {
  if (isRecoveryAuthRoute(pathname)) {
    return "recovery";
  }

  if (pathname.startsWith("/(auth)") || pathname.startsWith("/sign-in") || pathname.startsWith("/forgot-password")) {
    return "auth";
  }

  if (pathname.startsWith("/(tabs)")) {
    return "tabs";
  }

  if (pathname === "/choose-username") {
    return "profile";
  }

  return "other";
}

export function getProfileRedirectTarget(input: {
  pathname: string;
  profileSetupStatus: "loading" | "ready" | "username-required" | "temporary-error";
  hasUserId: boolean;
}): "/choose-username" | "/(tabs)" | null {
  if (!input.hasUserId) {
    return null;
  }

  if (input.profileSetupStatus === "username-required" && input.pathname !== "/choose-username") {
    return "/choose-username";
  }

  if (input.profileSetupStatus === "ready" && input.pathname === "/choose-username") {
    return "/(tabs)";
  }

  return null;
}
