export function isRecoveryAuthRoute(pathname: string): boolean {
  return pathname === "/auth/callback" || pathname === "/auth/reset-password";
}
