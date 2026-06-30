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
import { useAuth } from "../../providers/AuthProvider";

export default function CreateAccountScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreateAccount() {
    setError("");
    setSuccessMessage("");

    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("Complete all fields to continue.");
      return;
    }

    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const result = await signUp(email, password);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Could not create account.");
      return;
    }

    if (result.session) {
      router.replace("/");
      return;
    }

    setSuccessMessage(
      "Account created. Check your email to verify your account, then sign in."
    );
  }

  return (
    <AuthScreenShell
      title="Create Account"
      subtitle="Join RecordQuest and keep your collection backed up."
      footer={
        <Pressable onPress={() => router.replace("/sign-in")}> 
          <Text style={styles.linkText}>Already have an account? Sign in</Text>
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

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          placeholder="Minimum 8 characters"
          placeholderTextColor="#8B8B96"
          style={styles.input}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          textContentType="newPassword"
          placeholder="Re-enter your password"
          placeholderTextColor="#8B8B96"
          style={styles.input}
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

      <Pressable
        style={[styles.primaryButton, isSubmitting ? styles.disabledButton : null]}
        onPress={handleCreateAccount}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFF4D6" />
        ) : (
          <Text style={styles.primaryButtonText}>Create Account</Text>
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
