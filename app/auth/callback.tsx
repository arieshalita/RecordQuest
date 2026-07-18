import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "../../hooks/supabase-client";

type CallbackState = {
  status: "loading" | "success" | "error";
  title: string;
  message: string;
  nextHref: "/(auth)/sign-in" | "/(tabs)";
};

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "recovery", "email", "email_change"];

const consumedCallbackKeys = new Set<string>();
let initialUrlPromise: Promise<string | null> | null = null;

function getInitialUrlOnce(): Promise<string | null> {
  if (!initialUrlPromise) {
    initialUrlPromise = Linking.getInitialURL().catch(() => null);
  }

  return initialUrlPromise;
}

function parseParams(raw: string): URLSearchParams {
  return new URLSearchParams(raw.startsWith("?") || raw.startsWith("#") ? raw.slice(1) : raw);
}

function mapCallbackErrorMessage(error: string | null | undefined): string {
  const source = (error ?? "").toLowerCase();

  if (source.includes("expired")) {
    return "This link has expired. Request a new one and try again.";
  }

  if (source.includes("invalid") || source.includes("already")) {
    return "This link is invalid or already used. Request a new link and try again.";
  }

  if (source.includes("network") || source.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }

  return "We couldn't complete verification with this link. Please request a new email and try again.";
}

function mapType(rawType: string | null): EmailOtpType | null {
  if (!rawType) {
    return null;
  }

  const normalized = rawType.trim().toLowerCase();
  if (OTP_TYPES.includes(normalized as EmailOtpType)) {
    return normalized as EmailOtpType;
  }

  return null;
}

function buildCallbackKey(url: string, queryParams: URLSearchParams, hashParams: URLSearchParams): string {
  const tokenHash = queryParams.get("token_hash") ?? hashParams.get("token_hash") ?? "";
  const accessToken = hashParams.get("access_token") ?? queryParams.get("access_token") ?? "";
  const refreshToken = hashParams.get("refresh_token") ?? queryParams.get("refresh_token") ?? "";
  const type = queryParams.get("type") ?? hashParams.get("type") ?? "";

  if (tokenHash) {
    return `token_hash:${type}:${tokenHash}`;
  }

  if (accessToken || refreshToken) {
    return `session_tokens:${type}:${accessToken.length}:${refreshToken.length}`;
  }

  return `url:${url}`;
}

function hasAuthPayload(queryParams: URLSearchParams, hashParams: URLSearchParams): boolean {
  return Boolean(
    queryParams.get("token_hash") ||
      hashParams.get("token_hash") ||
      hashParams.get("access_token") ||
      queryParams.get("access_token") ||
      hashParams.get("refresh_token") ||
      queryParams.get("refresh_token") ||
      queryParams.get("error") ||
      queryParams.get("error_description")
  );
}

function logCallback(message: string, details?: Record<string, unknown>): void {
  if (!__DEV__) {
    return;
  }

  if (details) {
    console.log(`[RecordQuest][auth-callback] ${message}`, details);
    return;
  }

  console.log(`[RecordQuest][auth-callback] ${message}`);
}

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const liveUrl = Linking.useURL();
  const hasStartedRef = useRef(false);
  const [state, setState] = useState<CallbackState>({
    status: "loading",
    title: "Verifying Link",
    message: "Please wait while we verify your link...",
    nextHref: "/(auth)/sign-in",
  });

  const fallbackQuery = useMemo(() => {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") {
        query.set(key, value);
      }
    }

    return query;
  }, [params]);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    let isMounted = true;

    function replaceAway(nextHref: "/(auth)/sign-in" | "/(tabs)", reason: string) {
      logCallback("route replaced", { nextHref, reason });
      router.replace(nextHref);
    }

    async function run() {
      logCallback("callback processing started");

      try {
        const initialUrl = liveUrl ?? (await getInitialUrlOnce()) ?? "";

        const parsed = initialUrl ? new URL(initialUrl) : null;
        const queryParams = parsed ? parseParams(parsed.search) : fallbackQuery;
        const hashParams = parsed ? parseParams(parsed.hash) : new URLSearchParams();
        const callbackKey = buildCallbackKey(initialUrl || "no-url", queryParams, hashParams);

        logCallback("URL processed", {
          hasUrl: Boolean(initialUrl),
          hasAuthPayload: hasAuthPayload(queryParams, hashParams),
        });

        if (consumedCallbackKeys.has(callbackKey)) {
          logCallback("callback already consumed", {
            hasAuthPayload: hasAuthPayload(queryParams, hashParams),
          });

          const {
            data: { session: existingSession },
          } = await supabase.auth.getSession();

          if (!isMounted) return;
          replaceAway(existingSession?.user ? "/(tabs)" : "/(auth)/sign-in", "consumed-link");
          return;
        }

        const accessToken = hashParams.get("access_token") ?? queryParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token") ?? queryParams.get("refresh_token");
        const tokenHash = queryParams.get("token_hash") ?? hashParams.get("token_hash");
        const rawType = queryParams.get("type") ?? hashParams.get("type");
        const authType = mapType(rawType);
        const queryError = queryParams.get("error_description") ?? queryParams.get("error");

        if (!hasAuthPayload(queryParams, hashParams)) {
          consumedCallbackKeys.add(callbackKey);

          const {
            data: { session: existingSession },
          } = await supabase.auth.getSession();

          if (!isMounted) return;
          replaceAway(existingSession?.user ? "/(tabs)" : "/(auth)/sign-in", "no-auth-payload");
          return;
        }

        if (queryError) {
          consumedCallbackKeys.add(callbackKey);

          if (!isMounted) return;
          setState({
            status: "error",
            title: "Verification Failed",
            message: mapCallbackErrorMessage(queryError),
            nextHref: "/(auth)/sign-in",
          });
          return;
        }

        await supabase.auth.signOut({ scope: "local" });

        if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionError) {
            consumedCallbackKeys.add(callbackKey);

            if (!isMounted) return;
            setState({
              status: "error",
              title: "Verification Failed",
              message: mapCallbackErrorMessage(setSessionError.message),
              nextHref: "/(auth)/sign-in",
            });
            return;
          }
        } else if (tokenHash && authType) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: authType,
          });

          if (verifyError) {
            consumedCallbackKeys.add(callbackKey);

            if (!isMounted) return;
            setState({
              status: "error",
              title: "Verification Failed",
              message: mapCallbackErrorMessage(verifyError.message),
              nextHref: "/(auth)/sign-in",
            });
            return;
          }
        } else {
          consumedCallbackKeys.add(callbackKey);

          if (!isMounted) return;
          setState({
            status: "error",
            title: "Invalid Link",
            message: "This link is malformed or incomplete. Request a new verification email and try again.",
            nextHref: "/(auth)/sign-in",
          });
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        consumedCallbackKeys.add(callbackKey);

        const wasRecoveryFlow = authType === "recovery" || rawType?.toLowerCase() === "recovery";
        const nextHref = session?.user && !wasRecoveryFlow ? "/(tabs)" : "/(auth)/sign-in";
        const successTitle = wasRecoveryFlow ? "Link Verified" : "Email Verified";
        const successMessage = wasRecoveryFlow
          ? "Your password reset link is verified. Continue to sign in."
          : "Your email is verified. You can continue now.";

        if (!isMounted) return;
        setState({
          status: "success",
          title: successTitle,
          message: successMessage,
          nextHref,
        });

        setTimeout(() => {
          if (isMounted) {
            replaceAway(nextHref, "callback-success");
          }
        }, 900);
      } catch (error) {
        if (!isMounted) return;
        setState({
          status: "error",
          title: "Verification Failed",
          message: mapCallbackErrorMessage(error instanceof Error ? error.message : "unknown error"),
          nextHref: "/(auth)/sign-in",
        });
      }
    }

    void run();

    return () => {
      isMounted = false;
    };
  }, []);

  const buttonLabel = state.status === "success" && state.nextHref === "/(tabs)"
    ? "Open RecordQuest"
    : "Go to Sign In";

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        {state.status === "loading" ? <ActivityIndicator size="small" color="#A78BFA" /> : null}
        <Text style={styles.title}>{state.title}</Text>
        <Text style={styles.message}>{state.message}</Text>
        {state.status !== "loading" ? (
          <Pressable
            style={styles.button}
            onPress={() => {
              logCallback("route replaced", {
                nextHref: state.nextHref,
                reason: "manual-action",
              });
              router.replace(state.nextHref);
            }}
          >
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#050509",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#3E3B5C",
    backgroundColor: "#121022",
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: "#FFF4D6",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    color: "#C4BEE0",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    marginTop: 6,
    backgroundColor: "#7C3AED",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "#5F32D4",
  },
  buttonText: {
    color: "#FFF4D6",
    fontSize: 14,
    fontWeight: "700",
  },
});