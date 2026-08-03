import type { EmailOtpType } from "@supabase/supabase-js";
import { normalizeNativeIntentPath } from "./native-intent";

export type CallbackAuthMethod = "exchangeCode" | "setSession" | "verifyOtp" | "invalid";

export type ParsedAuthCallbackUrl = {
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
  const search =
    queryIndex >= 0
      ? input.slice(queryIndex, hashIndex >= 0 && hashIndex > queryIndex ? hashIndex : input.length)
      : "";
  const hash = hashIndex >= 0 ? input.slice(hashIndex) : "";

  return { path, search, hash };
}

function uniqueNames(params: URLSearchParams): string[] {
  return Array.from(new Set(Array.from(params.keys()))).sort();
}

function toSupportedOtpType(rawType: string | null): EmailOtpType | null {
  if (!rawType) {
    return null;
  }

  const normalized = rawType.trim().toLowerCase();
  const supported: ReadonlyArray<EmailOtpType> = ["signup", "invite", "recovery", "email", "email_change"];
  return supported.includes(normalized as EmailOtpType) ? (normalized as EmailOtpType) : null;
}

export function parseAuthCallbackUrl(inputUrl: string): ParsedAuthCallbackUrl {
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
  const supportedType = toSupportedOtpType(authType);
  const queryError = queryParams.get("error_description") ?? queryParams.get("error");

  const method: CallbackAuthMethod = code
    ? "exchangeCode"
    : accessToken && refreshToken
      ? "setSession"
      : tokenHash && supportedType
        ? "verifyOtp"
        : "invalid";

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
