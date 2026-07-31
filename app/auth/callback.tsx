import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "../../hooks/supabase-client";
import { establishRecoverySessionFromUrl } from "../../utils/auth-recovery-flow";
import { parseAuthCallbackUrl } from "../../utils/auth-callback-url";

type CallbackState = {
  status: "loading" | "success" | "error";
  title: string;
  message: string;
  nextHref: "/(auth)/sign-in" | "/auth/reset-password";
};

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
  const pathname = usePathname();
  const hasStartedRef = useRef(false);
  const [state, setState] = useState<CallbackState>({
    status: "loading",
    title: "Verifying Link",
    message: "Please wait while we verify your link...",
    nextHref: "/(auth)/sign-in",
  });

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    let isMounted = true;
    let subscription: { remove: () => void } | null = null;

    function replaceAway(nextHref: "/(auth)/sign-in" | "/auth/reset-password", reason: string) {
      logCallback("route replaced", { nextHref, reason });
      router.replace(nextHref);
    }

    async function processUrl(inputUrl: string | null, source: "initial" | "event") {
      const hasInitialUrl = Boolean(inputUrl);
      const targetUrl = inputUrl ?? "";
      const parsed = targetUrl ? parseAuthCallbackUrl(targetUrl) : null;

      logCallback("callback URL diagnostics", {
        initialUrlReceived: hasInitialUrl,
        pathname,
        queryParamNames: parsed?.queryParamNames ?? [],
        fragmentParamNames: parsed?.fragmentParamNames ?? [],
        recoveryMethodSelected: parsed?.method ?? "invalid",
      });

      if (!targetUrl) {
        if (!isMounted) return;
        setState({
          status: "error",
          title: "Verification Failed",
          message: "This link is malformed or incomplete. Request a new verification email and try again.",
          nextHref: "/(auth)/sign-in",
        });
        return;
      }

      try {
        await supabase.auth.signOut({ scope: "local" });

        const result = await establishRecoverySessionFromUrl(targetUrl, {
          exchangeCodeForSession: (code) => supabase.auth.exchangeCodeForSession(code),
          setSession: (input) => supabase.auth.setSession(input),
          verifyOtp: (input) => supabase.auth.verifyOtp(input),
          getSession: () => supabase.auth.getSession(),
        });

        logCallback("session established", {
          sessionEstablished: result.success,
          callbackNavigationDestination: result.navigationTarget,
        });

        if (!isMounted) return;

        if (!result.success) {
          setState({
            status: "error",
            title: "Verification Failed",
            message: result.errorMessage ?? "This password reset link is invalid or has expired. Request a new one.",
            nextHref: "/(auth)/sign-in",
          });
          return;
        }

        setState({
          status: "success",
          title: "Link Verified",
          message: "Your password reset link is verified. Set your new password to continue.",
          nextHref: result.navigationTarget,
        });

        logCallback("callback navigation target", {
          callbackNavigationDestination: result.navigationTarget,
        });

        replaceAway(result.navigationTarget, source === "initial" ? "initial-url" : "url-event");
      } catch (error) {
        if (!isMounted) return;
        setState({
          status: "error",
          title: "Verification Failed",
          message: error instanceof Error ? error.message : "This password reset link is invalid or has expired. Request a new one.",
          nextHref: "/(auth)/sign-in",
        });
      }
    }

    void (async () => {
      const initialUrl = await Linking.getInitialURL().catch(() => null);
      if (initialUrl) {
        await processUrl(initialUrl, "initial");
      } else if (__DEV__) {
        logCallback("initial URL received", {
          initialUrlReceived: false,
          pathname,
          queryParamNames: [],
          fragmentParamNames: [],
          recoveryMethodSelected: "invalid",
        });
      }
    })();

    subscription = Linking.addEventListener("url", (event) => {
      void processUrl(event.url, "event");
    });

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, [pathname]);

  const buttonLabel = "Go to Sign In";

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