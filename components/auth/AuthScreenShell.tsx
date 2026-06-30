import type { PropsWithChildren, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface AuthScreenShellProps extends PropsWithChildren {
  title: string;
  subtitle: string;
  footer?: ReactNode;
}

export function AuthScreenShell({
  title,
  subtitle,
  children,
  footer,
}: AuthScreenShellProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>RecordQuest</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            {children}
          </View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050509",
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  brandBlock: {
    marginBottom: 18,
  },
  brandName: {
    color: "#FFF4D6",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 8,
    color: "#C4BEE0",
    fontSize: 15,
  },
  card: {
    backgroundColor: "#121022",
    borderColor: "#3E3B5C",
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    color: "#FFF4D6",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 18,
  },
  footer: {
    marginTop: 16,
    alignItems: "center",
  },
});
