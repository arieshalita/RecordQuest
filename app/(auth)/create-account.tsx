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
import {
  sanitizeUsername,
  validateUsername,
} from "../../hooks/profile-identity";
import { useAuth } from "../../providers/AuthProvider";
import { isValidEmail, mapSignUpErrorMessage, normalizeEmail } from "../../utils/auth-input";

export default function CreateAccountScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedUsername = sanitizeUsername(username);
  const usernameValidationError = validateUsername(normalizedUsername);

  async function handleCreateAccount() {
    setError("");
    setSuccessMessage("");

    const normalizedEmail = normalizeEmail(email);
    const normalizedSignupUsername = sanitizeUsername(username);
    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (!normalizedEmail || !normalizedSignupUsername || !trimmedPassword || !trimmedConfirmPassword) {
      setError("Complete all fields to continue.");
      return;
    }

    const usernameError = validateUsername(normalizedSignupUsername);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (trimmedPassword.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setEmail(normalizedEmail);
    setUsername(normalizedSignupUsername);

    setIsSubmitting(true);
    try {
      const result = await signUp(normalizedEmail, trimmedPassword, normalizedSignupUsername);

      if (!result.success) {
        if (result.usernameSetupRequired) {
          if (result.session) {
            router.replace("/choose-username");
            return;
          }

          setError(result.error ?? "We couldn't finish setting up your username. Please choose another one and try again.");
          return;
        }

        setError(mapSignUpErrorMessage(result.error));
        return;
      }

      if (result.session) {
        router.replace("/(tabs)");
        return;
      }

      setSuccessMessage(
        "Account created. Check your email to verify your account, then sign in."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedUsernameForSubmit = sanitizeUsername(username);
  const trimmedPassword = password.trim();
  const trimmedConfirmPassword = confirmPassword.trim();
  const usernameReadyForSubmit =
    Boolean(normalizedUsernameForSubmit) &&
    !usernameValidationError;
  const canSubmit =
    usernameReadyForSubmit &&
    isValidEmail(normalizedEmail) &&
    trimmedPassword.length >= 8 &&
    trimmedPassword === trimmedConfirmPassword;

  const showUsernameHint = Boolean(username) || Boolean(usernameValidationError);

  const usernameStatusText = usernameValidationError
    ? usernameValidationError
    : showUsernameHint
      ? "Usernames must be 3-24 chars: lowercase letters, numbers, underscores, and periods."
      : "";

  const usernameStatusStyle = usernameValidationError
    ? styles.errorText
    : styles.helperText;

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

      {usernameStatusText ? <Text style={usernameStatusStyle}>{usernameStatusText}</Text> : null}

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
        style={[styles.primaryButton, (isSubmitting || !canSubmit) ? styles.disabledButton : null]}
        onPress={handleCreateAccount}
        disabled={isSubmitting || !canSubmit}
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
  helperText: {
    color: "#AFA9D6",
    marginTop: -6,
    marginBottom: 12,
    fontSize: 12,
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
