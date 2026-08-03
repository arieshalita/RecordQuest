const CALLBACK_PATH = "auth/callback";

function normalizePath(path: string): string {
  const trimmed = path.trim().replace(/^\/+/, "");
  return trimmed || CALLBACK_PATH;
}

export function buildAuthRedirectUrl(path = CALLBACK_PATH): string {
  const normalized = normalizePath(path);

  if (normalized === CALLBACK_PATH) {
    return "recordquest://auth/callback";
  }

  return `recordquest://${normalized}`;
}
