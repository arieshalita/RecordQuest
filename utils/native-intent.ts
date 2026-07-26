const AUTH_CALLBACK_PATH = "/auth/callback";
const AUTH_CALLBACK_HOST_URL_PREFIX = "recordquest://auth/callback";
const AUTH_CALLBACK_TRIPLE_SLASH_PREFIX = "recordquest:///auth/callback";

export function normalizeNativeIntentPath(path: string): string {
  if (!path) {
    return path;
  }

  if (path === AUTH_CALLBACK_PATH || path.startsWith(`${AUTH_CALLBACK_PATH}?`) || path.startsWith(`${AUTH_CALLBACK_PATH}#`)) {
    return path;
  }

  if (path.startsWith(AUTH_CALLBACK_HOST_URL_PREFIX)) {
    const suffix = path.slice(AUTH_CALLBACK_HOST_URL_PREFIX.length);
    return `${AUTH_CALLBACK_PATH}${suffix}`;
  }

  if (path.startsWith(AUTH_CALLBACK_TRIPLE_SLASH_PREFIX)) {
    const suffix = path.slice(AUTH_CALLBACK_TRIPLE_SLASH_PREFIX.length);
    return `${AUTH_CALLBACK_PATH}${suffix}`;
  }

  try {
    const url = new URL(path);

    if (url.protocol !== "recordquest:") {
      return path;
    }

    if (url.hostname !== "auth") {
      return path;
    }

    if (url.pathname !== "/callback") {
      return path;
    }

    return `${AUTH_CALLBACK_PATH}${url.search}${url.hash}`;
  } catch {
    return path;
  }
}
