export function buildAuthRedirectUrl(path = "auth/callback", scheme = "recordquest"): string {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${scheme}://${normalizedPath}`;
}
