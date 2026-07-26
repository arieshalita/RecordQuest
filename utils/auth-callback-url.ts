import { detectCallbackAuthMethod, type CallbackAuthMethod } from "./auth-recovery";
import { normalizeNativeIntentPath } from "./native-intent";

export type ParsedCallbackUrl = {
  normalizedPathname: string;
  queryParamNames: string[];
  fragmentParamNames: string[];
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  authType: string | null;
  queryError: string | null;
  method: CallbackAuthMethod;
};

function parseParams(raw: string): URLSearchParams {
  return new URLSearchParams(raw.startsWith("?") || raw.startsWith("#") ? raw.slice(1) : raw);
}

function splitPathQueryHash(input: string): { path: string; search: string; hash: string } {
  const hashIndex = input.indexOf("#");
  const queryIndex = input.indexOf("?");
  const pathEnd = [queryIndex, hashIndex].filter((value) => value >= 0).sort((a, b) => a - b)[0] ?? input.length;
  const path = input.slice(0, pathEnd);
  const search = queryIndex >= 0
    ? input.slice(queryIndex, hashIndex >= 0 && hashIndex > queryIndex ? hashIndex : input.length)
    : "";
  const hash = hashIndex >= 0 ? input.slice(hashIndex) : "";

  return { path, search, hash };
}

function uniqueNames(params: URLSearchParams): string[] {
  return Array.from(new Set(Array.from(params.keys()))).sort();
}

export function parseAuthCallbackUrl(inputUrl: string): ParsedCallbackUrl {
  const normalized = normalizeNativeIntentPath(inputUrl);

  let pathname = "";
  let queryParams = new URLSearchParams();
  let hashParams = new URLSearchParams();

  try {
    if (normalized.includes("://")) {
      const parsedUrl = new URL(normalized);
      pathname = parsedUrl.pathname || "";
      queryParams = parseParams(parsedUrl.search);
      hashParams = parseParams(parsedUrl.hash);
    } else {
      const parsed = splitPathQueryHash(normalized);
      pathname = parsed.path;
      queryParams = parseParams(parsed.search);
      hashParams = parseParams(parsed.hash);
    }
  } catch {
    const parsed = splitPathQueryHash(normalized);
    pathname = parsed.path;
    queryParams = parseParams(parsed.search);
    hashParams = parseParams(parsed.hash);
  }

  const code = queryParams.get("code");
  const accessToken = queryParams.get("access_token") ?? hashParams.get("access_token");
  const refreshToken = queryParams.get("refresh_token") ?? hashParams.get("refresh_token");
  const tokenHash = queryParams.get("token_hash") ?? hashParams.get("token_hash");
  const authType = queryParams.get("type") ?? hashParams.get("type");
  const queryError = queryParams.get("error_description") ?? queryParams.get("error");

  const method = detectCallbackAuthMethod({
    code,
    accessToken,
    refreshToken,
    tokenHash,
    authType,
  });

  return {
    normalizedPathname: pathname,
    queryParamNames: uniqueNames(queryParams),
    fragmentParamNames: uniqueNames(hashParams),
    code,
    accessToken,
    refreshToken,
    tokenHash,
    authType,
    queryError,
    method,
  };
}

export function resolveCallbackNavigationTarget(input: {
  isRecoveryFlow: boolean;
  hasSessionUser: boolean;
}): "/(auth)/sign-in" | "/(tabs)" | "/auth/reset-password" {
  if (input.isRecoveryFlow) {
    return input.hasSessionUser ? "/auth/reset-password" : "/(auth)/sign-in";
  }

  return input.hasSessionUser ? "/(tabs)" : "/(auth)/sign-in";
}
