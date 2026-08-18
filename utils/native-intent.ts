const AUTH_CALLBACK_INTERNAL_PATH = "/auth/callback";
const AUTH_CALLBACK_HOST_PREFIX = "recordquest://auth/callback";
const RECENT_RECOVERY_INTENT_TTL_MS = 2 * 60 * 1000;

let lastRecoveryIntent: { normalizedPath: string; timestamp: number } | null = null;

function markRecoveryIntent(normalizedPath: string): void {
  lastRecoveryIntent = {
    normalizedPath,
    timestamp: Date.now(),
  };
}

function normalizeCallbackPath(path: string): string {
  const normalized = mergeFragmentParamsIntoQuery(path);

  if (normalized.startsWith(AUTH_CALLBACK_INTERNAL_PATH)) {
    const hasPossiblePayload = normalized.includes("?") || normalized.includes("#");
    if (hasPossiblePayload) {
      markRecoveryIntent(normalized);
    }
  }

  return normalized;
}

export function consumeRecentRecoveryIntent(nowMs = Date.now()): string | null {
  if (!lastRecoveryIntent) {
    return null;
  }

  if (nowMs - lastRecoveryIntent.timestamp > RECENT_RECOVERY_INTENT_TTL_MS) {
    lastRecoveryIntent = null;
    return null;
  }

  const normalizedPath = lastRecoveryIntent.normalizedPath;
  lastRecoveryIntent = null;
  return normalizedPath;
}

function splitPathQueryHash(input: string): { path: string; query: string; hash: string } {
  const hashIndex = input.indexOf("#");
  const queryIndex = input.indexOf("?");
  const pathEnd = [queryIndex, hashIndex].filter((value) => value >= 0).sort((a, b) => a - b)[0] ?? input.length;

  const path = input.slice(0, pathEnd);
  const query =
    queryIndex >= 0
      ? input.slice(queryIndex + 1, hashIndex >= 0 && hashIndex > queryIndex ? hashIndex : input.length)
      : "";
  const hash = hashIndex >= 0 ? input.slice(hashIndex + 1) : "";

  return { path, query, hash };
}

function mergeFragmentParamsIntoQuery(pathWithQueryAndHash: string): string {
  const { path, query, hash } = splitPathQueryHash(pathWithQueryAndHash);
  if (!hash || !hash.includes("=")) {
    return pathWithQueryAndHash;
  }

  const queryParams = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hash);

  for (const [key, value] of hashParams.entries()) {
    if (!queryParams.has(key)) {
      queryParams.set(key, value);
    }
  }

  const mergedQuery = queryParams.toString();
  return `${path}${mergedQuery ? `?${mergedQuery}` : ""}#${hash}`;
}

export function normalizeNativeIntentPath(path: string): string {
  if (!path) {
    return path;
  }

  const direct = splitPathQueryHash(path);
  if (direct.path === "/callback" || direct.path === "callback") {
    return normalizeCallbackPath(`${AUTH_CALLBACK_INTERNAL_PATH}${path.slice(direct.path.length)}`);
  }

  if (direct.path === "/auth/callback" || direct.path === "auth/callback") {
    return normalizeCallbackPath(`${AUTH_CALLBACK_INTERNAL_PATH}${path.slice(direct.path.length)}`);
  }

  if (
    path === AUTH_CALLBACK_INTERNAL_PATH ||
    path.startsWith(`${AUTH_CALLBACK_INTERNAL_PATH}?`) ||
    path.startsWith(`${AUTH_CALLBACK_INTERNAL_PATH}#`)
  ) {
    return normalizeCallbackPath(path);
  }

  if (path.startsWith(AUTH_CALLBACK_HOST_PREFIX)) {
    const suffix = path.slice(AUTH_CALLBACK_HOST_PREFIX.length);
    return normalizeCallbackPath(`${AUTH_CALLBACK_INTERNAL_PATH}${suffix}`);
  }

  try {
    const parsed = new URL(path);
    if (parsed.protocol !== "recordquest:") {
      return path;
    }

    if (parsed.hostname !== "auth" || parsed.pathname !== "/callback") {
      return path;
    }

    return normalizeCallbackPath(`${AUTH_CALLBACK_INTERNAL_PATH}${parsed.search}${parsed.hash}`);
  } catch {
    return path;
  }
}
