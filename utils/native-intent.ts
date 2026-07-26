const AUTH_CALLBACK_PATH = "/auth/callback";
const AUTH_CALLBACK_HOST_URL_PREFIX = "recordquest://auth/callback";
const AUTH_CALLBACK_TRIPLE_SLASH_PREFIX = "recordquest:///auth/callback";

function splitQueryAndHash(input: string): { path: string; query: string; hash: string } {
  const hashIndex = input.indexOf("#");
  const queryIndex = input.indexOf("?");

  const pathEnd = [queryIndex, hashIndex].filter((value) => value >= 0).sort((a, b) => a - b)[0] ?? input.length;
  const path = input.slice(0, pathEnd);

  const query = queryIndex >= 0
    ? input.slice(queryIndex + 1, hashIndex >= 0 && hashIndex > queryIndex ? hashIndex : input.length)
    : "";
  const hash = hashIndex >= 0 ? input.slice(hashIndex + 1) : "";

  return { path, query, hash };
}

function getParamNames(params: URLSearchParams): string[] {
  return Array.from(new Set(Array.from(params.keys()))).sort();
}

function mergeFragmentParamsIntoQuery(pathWithQueryAndHash: string): string {
  const { path, query, hash } = splitQueryAndHash(pathWithQueryAndHash);
  if (!hash) {
    return pathWithQueryAndHash;
  }

  // Ignore anchor-style hash fragments (for example, #top) to avoid mutating non-auth links.
  if (!hash.includes("=")) {
    return pathWithQueryAndHash;
  }

  const queryParams = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hash);

  for (const [key, value] of hashParams.entries()) {
    if (!queryParams.has(key)) {
      queryParams.set(key, value);
    }
  }

  const nextQuery = queryParams.toString();
  return `${path}${nextQuery ? `?${nextQuery}` : ""}#${hash}`;
}

export function describeNativeIntent(path: string): {
  incomingScheme: string | null;
  normalizedPathname: string;
  queryParamNames: string[];
  fragmentParamNames: string[];
} {
  const normalized = normalizeNativeIntentPath(path);
  const { path: normalizedPathOnly, query, hash } = splitQueryAndHash(normalized);

  let incomingScheme: string | null = null;
  if (path.includes("://")) {
    try {
      incomingScheme = new URL(path).protocol.replace(":", "") || null;
    } catch {
      incomingScheme = null;
    }
  }

  return {
    incomingScheme,
    normalizedPathname: normalizedPathOnly,
    queryParamNames: getParamNames(new URLSearchParams(query)),
    fragmentParamNames: getParamNames(new URLSearchParams(hash)),
  };
}

export function normalizeNativeIntentPath(path: string): string {
  if (!path) {
    return path;
  }

  const direct = splitQueryAndHash(path);
  if (direct.path === "/callback" || direct.path === "callback") {
    return mergeFragmentParamsIntoQuery(`${AUTH_CALLBACK_PATH}${path.slice(direct.path.length)}`);
  }

  if (direct.path === "auth/callback" || direct.path === "/auth/callback") {
    return mergeFragmentParamsIntoQuery(`${AUTH_CALLBACK_PATH}${path.slice(direct.path.length)}`);
  }

  if (path === AUTH_CALLBACK_PATH || path.startsWith(`${AUTH_CALLBACK_PATH}?`) || path.startsWith(`${AUTH_CALLBACK_PATH}#`)) {
    return mergeFragmentParamsIntoQuery(path);
  }

  if (path.startsWith(AUTH_CALLBACK_HOST_URL_PREFIX)) {
    const suffix = path.slice(AUTH_CALLBACK_HOST_URL_PREFIX.length);
    return mergeFragmentParamsIntoQuery(`${AUTH_CALLBACK_PATH}${suffix}`);
  }

  if (path.startsWith(AUTH_CALLBACK_TRIPLE_SLASH_PREFIX)) {
    const suffix = path.slice(AUTH_CALLBACK_TRIPLE_SLASH_PREFIX.length);
    return mergeFragmentParamsIntoQuery(`${AUTH_CALLBACK_PATH}${suffix}`);
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

    return mergeFragmentParamsIntoQuery(`${AUTH_CALLBACK_PATH}${url.search}${url.hash}`);
  } catch {
    return path;
  }
}
