import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "../../hooks/supabase-client";
import {
  processRecoveryCallbackAttempt,
  RECOVERY_CALLBACK_TIMEOUT_MS,
  selectRecoveryCallbackUrlCandidate,
  shouldProcessRecoveryCallback,
} from "../../utils/auth-recovery-flow";
import { consumeRecentRecoveryIntent } from "../../utils/native-intent";

type CallbackState = {
  status: "loading" | "success" | "error";
  title: string;
  message: string;
  nextHref: "/(auth)/sign-in" | "/auth/reset-password";
};

const consumedCallbackKeys = new Set<string>();

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const liveUrl = Linking.useURL();
  const hasStartedRef = useRef(false);
  const isExitingErrorStateRef = useRef(false);
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

  async function exitRecoveryError(nextHref: "/(auth)/sign-in" | "/(auth)/forgot-password") {
    if (isExitingErrorStateRef.current) {
      return;
    }

    isExitingErrorStateRef.current = true;

    try {
      await supabase.auth.signOut({ scope: "local" });
    } finally {
      router.replace(nextHref);
      isExitingErrorStateRef.current = false;
    }
  }

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    let isMounted = true;

    function replaceAway(nextHref: "/(auth)/sign-in" | "/auth/reset-password" | "/(tabs)") {
      router.replace(nextHref);
    }

    async function run() {
      const selection = selectRecoveryCallbackUrlCandidate({
        liveUrl,
        initialUrl: null,
        fallbackQuery,
        isDev: false,
        devRecoveryUrl: null,
      });
      const hasFreshRecoveryIntent = Boolean(consumeRecentRecoveryIntent());
      const shouldProcess = shouldProcessRecoveryCallback({
        selectedUrl: selection.url,
        selectedSource: selection.source,
        hasFreshRecoveryIntent,
      });

      if (!shouldProcess) {
        const { data } = await supabase.auth.getSession();
        replaceAway(data.session?.user ? "/(tabs)" : "/(auth)/sign-in");
        return;
      }

      const result = await processRecoveryCallbackAttempt(
        {
          inputUrl: selection.url,
          fallbackQuery,
          consumedKeys: consumedCallbackKeys,
          isDev: false,
          devRecoveryUrl: null,
          timeoutMs: RECOVERY_CALLBACK_TIMEOUT_MS,
        },
        {
          exchangeCodeForSession: (code) => supabase.auth.exchangeCodeForSession(code),
          setSession: (session) => supabase.auth.setSession(session),
          verifyOtp: (verification) => supabase.auth.verifyOtp(verification),
          getSession: () => supabase.auth.getSession(),
          signOutLocal: () => supabase.auth.signOut({ scope: "local" }),
        },
      );

      if (!isMounted) {
        return;
      }

      if (result.status === "success") {
        setState({
          status: "success",
          title: result.title,
          message: result.message,
          nextHref: result.nextHref,
        });
        replaceAway(result.nextHref);
        return;
      }

      setState({
        status: "error",
        title: result.title,
        message: result.message,
        nextHref: result.nextHref,
      });
    }

    void run();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        {state.status === "loading" ? <ActivityIndicator size="small" color="#A78BFA" /> : null}
        <Text style={styles.title}>{state.title}</Text>
        <Text style={styles.message}>{state.message}</Text>
        {state.status === "success" ? (
          <Pressable
            style={styles.button}
            onPress={() => router.replace(state.nextHref)}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        ) : null}

        {state.status === "error" ? (
          <View style={styles.errorActions}>
            <Pressable style={styles.secondaryButton} onPress={() => void exitRecoveryError("/(auth)/sign-in")}>
              <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => void exitRecoveryError("/(auth)/forgot-password")}>
              <Text style={styles.secondaryButtonText}>Request New Link</Text>
            </Pressable>
          </View>
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
  errorActions: {
    marginTop: 8,
    width: "100%",
    gap: 8,
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3E3B5C",
    backgroundColor: "#0F0E1B",
  },
  secondaryButtonText: {
    color: "#C4BEE0",
    fontSize: 14,
    fontWeight: "600",
  },
});