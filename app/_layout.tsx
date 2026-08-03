import { useEffect, useRef } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router, Stack, usePathname } from "expo-router";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "../providers/AuthProvider";
import { registerForPushNotificationsAsync } from "../hooks/push-notifications";
import { upsertUserPushToken } from "../hooks/recordquest-supabase-service";
import { isRecoveryAuthRoute } from "../utils/auth-route-guard";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const { user, isLoading, profileSetupStatus, profileSetupError, retryProfileSetup, signOut } = useAuth();
  const pathname = usePathname();
  const pushRegistrationUserIdRef = useRef<string | null>(null);
  const pushRegistrationInFlightUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isRecoveryAuthRoute(pathname)) {
      return;
    }

    if (!user?.id) {
      return;
    }

    if (profileSetupStatus === "username-required" && pathname !== "/choose-username") {
      router.replace("/choose-username");
      return;
    }

    if (profileSetupStatus === "ready" && pathname === "/choose-username") {
      router.replace("/(tabs)");
    }
  }, [pathname, profileSetupStatus, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      pushRegistrationUserIdRef.current = null;
      pushRegistrationInFlightUserIdRef.current = null;
      return;
    }

    const userId = user.id;

    if (pushRegistrationUserIdRef.current === userId) {
      return;
    }

    if (pushRegistrationInFlightUserIdRef.current === userId) {
      return;
    }

    pushRegistrationInFlightUserIdRef.current = userId;
    let isMounted = true;

    async function registerPushToken() {
      const registration = await registerForPushNotificationsAsync();
      if (!isMounted) return;

      if (registration.status !== "granted" || !registration.token) {
        pushRegistrationUserIdRef.current = userId;
        pushRegistrationInFlightUserIdRef.current = null;
        return;
      }

      try {
        await upsertUserPushToken(userId, registration.token, Platform.OS);
        if (!isMounted) return;
        pushRegistrationUserIdRef.current = userId;
      } catch (error) {
        if (!isMounted) return;
        console.warn(
          "[RecordQuest][push] failed to save token:",
          error instanceof Error ? error.message : "unknown error"
        );
      } finally {
        if (isMounted) {
          pushRegistrationInFlightUserIdRef.current = null;
        }
      }
    }

    void registerPushToken();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  if (isLoading || (user?.id && profileSetupStatus === "loading")) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A78BFA" />
      </View>
    );
  }

  if (user?.id && profileSetupStatus === "temporary-error") {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.gateTitle}>Profile Setup Needed</Text>
        <Text style={styles.gateMessage}>
          {profileSetupError ?? "We couldn't finish loading your profile. Please try again."}
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => void retryProfileSetup()}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => void signOut()}>
          <Text style={styles.secondaryButtonText}>Sign Out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="auth/reset-password" />

      <Stack.Protected guard={!!user && profileSetupStatus === "ready"}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>

      <Stack.Protected guard={!!user && profileSetupStatus === "username-required"}>
        <Stack.Screen name="choose-username" />
      </Stack.Protected>

      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#050509",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  gateTitle: {
    color: "#FFF4D6",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  gateMessage: {
    color: "#C4BEE0",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: "#7C3AED",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#5F32D4",
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  primaryButtonText: {
    color: "#FFF4D6",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3E3B5C",
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: "#C4BEE0",
    fontSize: 14,
    fontWeight: "600",
  },
});
