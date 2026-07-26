import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { AuthScreenShell } from "../../components/auth/AuthScreenShell";
import { supabase } from "../../hooks/supabase-client";
import { mapRecoveryUpdateError, validateRecoveryPassword } from "../../utils/auth-recovery";

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError || !data.session?.user) {
        setHasValidSession(false);
        setError("This password reset link is invalid or has expired. Request a new one.");
        setIsCheckingSession(false);
        return;
      }

      setHasValidSession(true);
      setError("");
      setIsCheckingSession(false);
    }

    void verifySession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleUpdatePassword() {
    if (isSubmitting) {
      return;
    }

    setError("");
    setMessage("");

    const validation = validateRecoveryPassword(password, confirmPassword);
    if (!validation.valid) {
      setError(validation.error ?? "Enter and confirm your new password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.user) {
        setError("This password reset link is invalid or has expired. Request a new one.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: validation.normalizedPassword,
      });

      if (updateError) {
        if (__DEV__) {
          console.warn("[RecordQuest][auth-recovery] update password failed", {
            message: updateError.message,
          });
        }
        setError(mapRecoveryUpdateError(updateError.message));
        return;
      }

      setMessage("Your password has been updated. You can now sign in with your new password.");

      await supabase.auth.signOut({ scope: "local" });

      setTimeout(() => {
        router.replace("/(auth)/sign-in?reset=success");
      }, 900);
    } catch (unexpectedError) {
      if (__DEV__) {
        console.warn("[RecordQuest][auth-recovery] unexpected update password error", {
          message: unexpectedError instanceof Error ? unexpectedError.message : "unknown error",
        });
      }
      setError("We couldn't update your password right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreenShell
      title="Reset Password"
      subtitle="Set a new password for your RecordQuest account."
      footer={
        <View style={styles.footerRow}>
          <Pressable onPress={() => router.replace("/(auth)/forgot-password")}>
            <Text style={styles.linkText}>Request new reset link</Text>
          </Pressable>
          <Pressable onPress={() => router.replace("/(auth)/sign-in")}>
            <Text style={styles.linkText}>Back to Sign In</Text>
          </Pressable>
        </View>
      }
    >
      {isCheckingSession ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#A78BFA" />
          <Text style={styles.loadingText}>Verifying reset link...</Text>
        </View>
      ) : null}

      {!isCheckingSession && hasValidSession ? (
        <>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              placeholder="Minimum 8 characters"
              placeholderTextColor="#8B8B96"
              style={styles.input}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="newPassword"
              placeholder="Re-enter your new password"
              placeholderTextColor="#8B8B96"
              style={styles.input}
              editable={!isSubmitting}
            />
          </View>

          <Pressable
            style={[styles.primaryButton, isSubmitting ? styles.disabledButton : null]}
            onPress={handleUpdatePassword}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF4D6" />
            ) : (
              <Text style={styles.primaryButtonText}>Update Password</Text>
            )}
          </Pressable>
        </>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {message ? <Text style={styles.successText}>{message}</Text> : null}
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    color: "#D6C2A1",
    fontSize: 14,
    marginBottom: 7,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#1A1830",
    borderColor: "#3E3B5C",
    borderWidth: 1,
    borderRadius: 16,
    color: "#FFF4D6",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  loadingText: {
    color: "#C4BEE0",
    fontSize: 13,
  },
  errorText: {
    color: "#F59E0B",
    marginTop: 12,
    fontSize: 13,
  },
  successText: {
    color: "#C7F9CC",
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    marginTop: 4,
    backgroundColor: "#7C3AED",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#5F32D4",
  },
  disabledButton: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: "#FFF4D6",
    fontSize: 16,
    fontWeight: "700",
  },
  footerRow: {
    gap: 10,
  },
  linkText: {
    color: "#A78BFA",
    fontSize: 14,
    fontWeight: "600",
  },
});
