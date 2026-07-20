import { useRef, useState } from "react";
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
import {
  isEmailNotConfirmedError,
  isValidEmail,
  mapSignInErrorMessage,
  normalizeEmail,
} from "../../utils/auth-input";

export default function SignInScreen() {
  const { signIn, resendConfirmationEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [error, setError] = useState("");
  const [rawSignInError, setRawSignInError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const resendInFlightRef = useRef(false);

  async function handleSignIn() {
    setError("");
    setRawSignInError(null);
    setResendMessage("");
    setResendError("");

    const normalizedEmail = normalizeEmail(email);
    const trimmedPassword = password.trim();

    if (!normalizedEmail || !trimmedPassword) {
      setError("Enter your email and password.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (trimmedPassword.length < 8) {
      setError("Use your full password to sign in.");
      return;
    }

    setEmail(normalizedEmail);

    setIsSubmitting(true);
    try {
      const result = await signIn(normalizedEmail, trimmedPassword, staySignedIn);

      if (!result.success) {
        setRawSignInError(result.error ?? null);
        setError(mapSignInErrorMessage(result.error));
        return;
      }

      setRawSignInError(null);
      if (result.session) {
        router.replace("/(tabs)");
        return;
      }

      setError("Could not sign in right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendConfirmationEmail() {
    if (resendInFlightRef.current || isResending) {
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isEmailNotConfirmedError(rawSignInError) || !isValidEmail(normalizedEmail)) {
      return;
    }

    resendInFlightRef.current = true;
    setIsResending(true);
    setResendError("");
    setResendMessage("");

    try {
      const result = await resendConfirmationEmail(normalizedEmail);

      if (!result.success) {
        setResendError("Could not resend confirmation email right now. Please try again.");
        return;
      }

      setResendMessage("Confirmation email sent. Check your inbox and open the newest email.");
    } finally {
      resendInFlightRef.current = false;
      setIsResending(false);
    }
  }

  const normalizedEmail = normalizeEmail(email);
  const trimmedPassword = password.trim();
  const canSubmit = isValidEmail(normalizedEmail) && trimmedPassword.length >= 8;
  const showResendConfirmationAction = isEmailNotConfirmedError(rawSignInError) && isValidEmail(normalizedEmail);

  return (
    <AuthScreenShell
      title="Sign In"
      subtitle="Your collection. Your stats. Synced safely."
      footer={
        <Pressable onPress={() => router.push("/create-account")}> 
          <Text style={styles.linkText}>Need an account? Create one</Text>
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
          textContentType="password"
          placeholder="Enter your password"
          placeholderTextColor="#8B8B96"
          style={styles.input}
        />
      </View>

      <Pressable
        style={styles.staySignedInRow}
        onPress={() => setStaySignedIn((current) => !current)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: staySignedIn }}
        accessibilityLabel="Stay signed in"
      >
        <View style={[styles.checkbox, staySignedIn ? styles.checkboxChecked : null]}>
          {staySignedIn ? <Text style={styles.checkboxCheck}>✓</Text> : null}
        </View>
        <Text style={styles.staySignedInText}>Stay signed in</Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {showResendConfirmationAction ? (
        <View style={styles.resendCard}>
          <Text style={styles.resendText}>
            Didn&apos;t get the confirmation email? Send a fresh copy to the address above.
          </Text>
          <Pressable
            style={[styles.resendButton, isResending ? styles.disabledButton : null]}
            onPress={handleResendConfirmationEmail}
            disabled={isResending}
          >
            {isResending ? (
              <ActivityIndicator size="small" color="#FFF4D6" />
            ) : (
              <Text style={styles.resendButtonText}>Resend confirmation email</Text>
            )}
          </Pressable>
          {resendMessage ? <Text style={styles.resendSuccessText}>{resendMessage}</Text> : null}
          {resendError ? <Text style={styles.resendErrorText}>{resendError}</Text> : null}
        </View>
      ) : null}

      <Pressable
        style={[styles.primaryButton, (isSubmitting || !canSubmit) ? styles.disabledButton : null]}
        onPress={handleSignIn}
        disabled={isSubmitting || !canSubmit}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFF4D6" />
        ) : (
          <Text style={styles.primaryButtonText}>Sign In</Text>
        )}
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => router.push("/forgot-password")}> 
        <Text style={styles.secondaryButtonText}>Forgot Password?</Text>
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
  staySignedInRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#13111F",
    borderWidth: 1,
    borderColor: "#3E3B5C",
    borderRadius: 16,
    minHeight: 48,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#6B6788",
    backgroundColor: "#0E0D16",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: "#7C3AED",
    backgroundColor: "#7C3AED",
  },
  checkboxCheck: {
    color: "#FFF4D6",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 16,
  },
  staySignedInText: {
    color: "#FFF4D6",
    fontSize: 15,
    fontWeight: "600",
  },
  errorText: {
    color: "#F59E0B",
    marginBottom: 12,
    fontSize: 13,
  },
  resendCard: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.28)",
    backgroundColor: "rgba(18, 16, 34, 0.92)",
    gap: 10,
  },
  resendText: {
    color: "#C4BEE0",
    fontSize: 13,
    lineHeight: 19,
  },
  resendButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(124, 58, 237, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.5)",
  },
  resendButtonText: {
    color: "#F4EDFF",
    fontSize: 13,
    fontWeight: "700",
  },
  resendSuccessText: {
    color: "#C7F9CC",
    fontSize: 13,
    lineHeight: 18,
  },
  resendErrorText: {
    color: "#F59E0B",
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
  secondaryButton: {
    marginTop: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: "#C4BEE0",
    fontSize: 14,
    fontWeight: "600",
  },
  linkText: {
    color: "#A78BFA",
    fontSize: 14,
    fontWeight: "600",
  },
});
