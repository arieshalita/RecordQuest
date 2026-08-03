import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { AuthScreenShell } from "../../components/auth/AuthScreenShell";
import { supabase } from "../../hooks/supabase-client";
import { MIN_PASSWORD_LENGTH } from "../../utils/auth-input";
import { submitRecoveryPasswordUpdate } from "../../utils/auth-recovery-flow";

export default function ResetPasswordScreen() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function verifyRecoverySession() {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }

      if (sessionError || !data.session?.user) {
        setHasValidSession(false);
        setError("This password reset session is no longer valid. Request a new reset link.");
        setIsCheckingSession(false);
        return;
      }

      setHasValidSession(true);
      setError("");
      setIsCheckingSession(false);
    }

    void verifyRecoverySession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const result = await submitRecoveryPasswordUpdate(
        {
          password: newPassword,
          confirmPassword,
          minLength: MIN_PASSWORD_LENGTH,
        },
        {
          getSession: () => supabase.auth.getSession(),
          updateUser: (password) => supabase.auth.updateUser({ password }),
          signOutLocal: () => supabase.auth.signOut({ scope: "local" }),
        },
      );

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.replace(result.nextHref);
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
            <Text style={styles.linkText}>Request New Link</Text>
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
          <Text style={styles.loadingText}>Verifying reset session...</Text>
        </View>
      ) : null}

      {!isCheckingSession && hasValidSession ? (
        <>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              textContentType="newPassword"
              placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
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
            onPress={handleSubmit}
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
