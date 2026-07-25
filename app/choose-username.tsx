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
import { AuthScreenShell } from "../components/auth/AuthScreenShell";
import { sanitizeUsername, validateUsername } from "../hooks/profile-identity";
import { useAuth } from "../providers/AuthProvider";

export default function ChooseUsernameScreen() {
  const { completeUsername, profileSetupError, signOut } = useAuth();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedUsername = sanitizeUsername(username);
  const usernameValidationError = validateUsername(normalizedUsername);

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    setError("");

    const normalized = sanitizeUsername(username);
    const validationError = validateUsername(normalized);

    if (validationError) {
      setError(validationError);
      return;
    }

    setUsername(normalized);
    setIsSubmitting(true);

    try {
      const result = await completeUsername(normalized);

      if (!result.success) {
        setError(result.error ?? "Could not update your username right now. Please try again.");
        return;
      }

      router.replace("/(tabs)");
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = Boolean(normalizedUsername) && !usernameValidationError;

  return (
    <AuthScreenShell
      title="Choose a Username"
      subtitle="Your account is ready. Pick a username to finish setup."
      footer={
        <Pressable onPress={() => void signOut()}>
          <Text style={styles.linkText}>Sign out</Text>
        </Pressable>
      }
    >
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          placeholder="your_username"
          placeholderTextColor="#8B8B96"
          style={styles.input}
        />
      </View>

      {usernameValidationError && username ? (
        <Text style={styles.errorText}>{usernameValidationError}</Text>
      ) : (
        <Text style={styles.helperText}>
          Use 3-24 characters: lowercase letters, numbers, underscores, and periods.
        </Text>
      )}

      {profileSetupError ? <Text style={styles.errorText}>{profileSetupError}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        style={[styles.primaryButton, (isSubmitting || !canSubmit) ? styles.disabledButton : null]}
        onPress={handleSubmit}
        disabled={isSubmitting || !canSubmit}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFF4D6" />
        ) : (
          <Text style={styles.primaryButtonText}>Continue</Text>
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
  helperText: {
    color: "#AFA9D6",
    marginTop: -6,
    marginBottom: 12,
    fontSize: 12,
  },
  errorText: {
    color: "#F59E0B",
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
