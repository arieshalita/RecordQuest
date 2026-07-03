import { useEffect, useRef } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "../providers/AuthProvider";
import {
  registerForPushNotificationsAsync,
  sendDevTestNotificationToExpoToken,
} from "../hooks/push-notifications";
import {
  getLatestUserPushToken,
  upsertUserPushToken,
} from "../hooks/recordquest-supabase-service";

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
  const devTestSendInFlightRef = useRef(false);

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

  async function sendDevTestPushToCurrentUser() {
    if (!__DEV__) return;

    if (!user?.id) {
      console.warn("[RecordQuest][push] dev test skipped: no signed-in user");
      return;
    }

    if (devTestSendInFlightRef.current) {
      console.warn("[RecordQuest][push] dev test skipped: send already in progress");
      return;
    }

    devTestSendInFlightRef.current = true;

    try {
      const token = await getLatestUserPushToken(user.id);

      if (!token) {
        console.warn("[RecordQuest][push] dev test skipped: no saved token for user");
        return;
      }

      const result = await sendDevTestNotificationToExpoToken(token);

      if (!result.success) {
        console.warn("[RecordQuest][push] dev test failed:", result.message ?? "unknown error");
        return;
      }

      console.log("[RecordQuest][push] dev test success");
    } catch (error) {
      console.warn(
        "[RecordQuest][push] dev test error:",
        error instanceof Error ? error.message : "unknown error"
      );
    } finally {
      devTestSendInFlightRef.current = false;
    }
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>

        <Stack.Protected guard={!user}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>

      {__DEV__ && user?.id ? (
        <Pressable
          style={styles.devPushButton}
          onPress={() => {
            void sendDevTestPushToCurrentUser();
          }}
        >
          <Text style={styles.devPushButtonText}>Send Test Push</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#050509",
    alignItems: "center",
    justifyContent: "center",
  },
  devPushButton: {
    position: "absolute",
    right: 14,
    bottom: 28,
    backgroundColor: "#111827",
    borderColor: "#374151",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    opacity: 0.92,
  },
  devPushButtonText: {
    color: "#F3F4F6",
    fontSize: 12,
    fontWeight: "600",
  },
});
