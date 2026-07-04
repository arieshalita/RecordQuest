import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

export type PushRegistrationResult = {
  token?: string;
  status: "granted" | "denied" | "unavailable" | "error";
  message?: string;
};

export type PushSendResult = {
  success: boolean;
  message?: string;
  reason?:
    | "missing_token"
    | "invalid_token_format"
    | "http_error"
    | "expo_error_status"
    | "fetch_error";
  httpStatus?: number;
  expoStatus?: string;
};

function isLikelyExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[[^\]]+\]$/.test(token) || /^ExpoPushToken\[[^\]]+\]$/.test(token);
}

function getExpoProjectId(): string | undefined {
  const easProjectId = Constants.expoConfig?.extra?.eas?.projectId;
  const runtimeProjectId = Constants.easConfig?.projectId;

  if (typeof runtimeProjectId === "string" && runtimeProjectId.trim()) {
    return runtimeProjectId;
  }

  if (typeof easProjectId === "string" && easProjectId.trim()) {
    return easProjectId;
  }

  return undefined;
}

export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  const isPhysicalDevice = Device.isDevice;

  if (Platform.OS === "web") {
    return {
      status: "unavailable",
      message: "Push notifications are not supported on web for this flow.",
    };
  }

  if (!isPhysicalDevice) {
    return {
      status: "unavailable",
      message: "Physical device required for Expo push token.",
    };
  }

  try {
    const existingPermissions = await Notifications.getPermissionsAsync();
    let finalStatus = existingPermissions.status;

    if (finalStatus !== "granted") {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermissions.status;
    }

    if (finalStatus !== "granted") {
      return {
        status: "denied",
        message: "Notification permission was not granted.",
      };
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: "default",
      });
    }

    const projectId = getExpoProjectId();

    const tokenResponse = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    if (!tokenResponse.data) {
      return {
        status: "unavailable",
        message: "Push token was unavailable.",
      };
    }

    return {
      status: "granted",
      token: tokenResponse.data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Push registration failed.";
    console.warn("[RecordQuest][push] registration error:", message);
    return {
      status: "error",
      message,
    };
  }
}

export async function sendDevTestNotificationToExpoToken(token: string): Promise<PushSendResult> {
  return sendNotificationToExpoToken(token, "RecordQuest", "Test notification from RecordQuest");
}

export async function sendNotificationToExpoToken(
  token: string,
  title: string,
  body: string
): Promise<PushSendResult> {
  const scopedToken = token.trim();
  const tokenFormatValid = isLikelyExpoPushToken(scopedToken);

  if (!scopedToken) {
    return {
      success: false,
      message: "No Expo push token available.",
      reason: "missing_token",
    };
  }

  if (!tokenFormatValid) {
    return {
      success: false,
      message: "Expo push token format is invalid.",
      reason: "invalid_token_format",
    };
  }

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: scopedToken,
        title,
        body,
        sound: "default",
      }),
    });

    const payload = (await response.json()) as {
      data?: { status?: string; message?: string };
      errors?: Array<{ message?: string }>;
    };

    if (!response.ok) {
      const errorMessage = payload.errors?.[0]?.message ?? "Expo push send request failed.";
      console.warn("[RecordQuest][push] dev test send failed:", errorMessage);
      return {
        success: false,
        message: errorMessage,
        reason: "http_error",
        httpStatus: response.status,
        expoStatus: payload.data?.status,
      };
    }

    const resultStatus = payload.data?.status;
    if (resultStatus !== "ok") {
      const errorMessage = payload.data?.message ?? payload.errors?.[0]?.message ?? "Push send rejected.";
      console.warn("[RecordQuest][push] dev test send rejected:", errorMessage);
      return {
        success: false,
        message: errorMessage,
        reason: "expo_error_status",
        httpStatus: response.status,
        expoStatus: resultStatus,
      };
    }

    return {
      success: true,
      httpStatus: response.status,
      expoStatus: resultStatus,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send notification.";
    console.warn("[RecordQuest][push] send error:", message);
    return {
      success: false,
      message,
      reason: "fetch_error",
    };
  }
}
