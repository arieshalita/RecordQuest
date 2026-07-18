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

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const liveUrl = Linking.useURL();
  const isProcessingRef = useRef(false);
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
    if (isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    let isMounted = true;

    async function run() {
      try {
        const initialUrl = liveUrl ?? (await Linking.getInitialURL()) ?? "";

        const parsed = initialUrl ? new URL(initialUrl) : null;
        const queryParams = parsed ? parseParams(parsed.search) : fallbackQuery;
        const hashParams = parsed ? parseParams(parsed.hash) : new URLSearchParams();

        const accessToken = hashParams.get("access_token") ?? queryParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token") ?? queryParams.get("refresh_token");
        const tokenHash = queryParams.get("token_hash") ?? hashParams.get("token_hash");
        const rawType = queryParams.get("type") ?? hashParams.get("type");
        const authType = mapType(rawType);
        const queryError = queryParams.get("error_description") ?? queryParams.get("error");

        if (queryError) {
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
            router.replace(nextHref);
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
  }, [fallbackQuery, liveUrl]);

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
          <Pressable style={styles.button} onPress={() => router.replace(state.nextHref)}>
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