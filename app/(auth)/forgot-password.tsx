import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { AuthScreenShell } from "../../components/auth/AuthScreenShell";
import { supabase } from "../../hooks/supabase-client";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleResetPassword() {
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Enter your account email.");
      return;
    }

    setIsSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim()
    );
    setIsSubmitting(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage("Password reset email sent. Check your inbox.");
  }

  return (
    <AuthScreenShell
      title="Forgot Password"
      subtitle="We will send a secure reset link to your email."
      footer={
        <Pressable onPress={() => router.replace("/sign-in")}> 
          <Text style={styles.linkText}>Back to Sign In</Text>
        </Pressable>
      }
    >
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@recordquest.fm"
          placeholderTextColor="#8B8B96"
          style={styles.input}
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {message ? <Text style={styles.successText}>{message}</Text> : null}

      <Pressable
        style={[styles.primaryButton, isSubmitting ? styles.disabledButton : null]}
        onPress={handleResetPassword}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFF4D6" />
        ) : (
          <Text style={styles.primaryButtonText}>Send Reset Link</Text>
        )}
      </Pressable>
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
  errorText: {
    color: "#F59E0B",
    marginBottom: 12,
    fontSize: 13,
  },
  successText: {
    color: "#C4BEE0",
    marginBottom: 12,
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
  linkText: {
    color: "#A78BFA",
    fontSize: 14,
    fontWeight: "600",
  },
});
