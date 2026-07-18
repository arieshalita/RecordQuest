import { useEffect, useRef } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "../providers/AuthProvider";
import { registerForPushNotificationsAsync } from "../hooks/push-notifications";
import { upsertUserPushToken } from "../hooks/recordquest-supabase-service";

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
  const { user, isLoading } = useAuth();
  const pushRegistrationUserIdRef = useRef<string | null>(null);
  const pushRegistrationInFlightUserIdRef = useRef<string | null>(null);

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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A78BFA" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth/callback" />

      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
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
  },
});
