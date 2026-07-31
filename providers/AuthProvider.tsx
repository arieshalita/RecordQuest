import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import {
  getCurrentSession,
  onAuthStateChange,
  signInWithEmail,
  resendSignupConfirmationEmail,
  deleteAccount as supabaseDeleteAccount,
  signOut as supabaseSignOut,
  signUpWithEmail,
  type AuthResponse,
} from "../hooks/supabase-client";
import {
  completeOwnUsername,
  ensureOwnProfileFromAuthMetadata,
} from "../hooks/profile-identity";
import { clearLocalUserData } from "../hooks/recordquest-storage";

type AuthFlowResult = AuthResponse & {
  usernameSetupRequired?: boolean;
};

export type ProfileSetupStatus = "loading" | "ready" | "username-required" | "temporary-error";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  recoveryActive: boolean;
  isLoading: boolean;
  profileSetupStatus: ProfileSetupStatus;
  profileSetupError: string | null;
  signIn: (email: string, password: string, staySignedIn: boolean) => Promise<AuthFlowResult>;
  signUp: (email: string, password: string, username?: string) => Promise<AuthFlowResult>;
  resendConfirmationEmail: (email: string) => Promise<AuthResponse>;
  signOut: () => Promise<AuthResponse>;
  deleteAccount: () => Promise<AuthResponse>;
  retryProfileSetup: () => Promise<void>;
  completeUsername: (username: string) => Promise<{ success: boolean; error?: string }>;
  beginRecoveryFlow: () => void;
  clearRecoveryFlow: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STAY_SIGNED_IN_KEY = "recordquest_stay_signed_in";

async function getStaySignedInPreference(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(STAY_SIGNED_IN_KEY);

    if (stored === null) {
      return true;
    }

    return stored === "true";
  } catch (error) {
    console.warn("[RecordQuest][auth] could not read stay-signed-in preference:", error);
    return true;
  }
}

async function setStaySignedInPreference(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STAY_SIGNED_IN_KEY, value ? "true" : "false");
  } catch (error) {
    console.warn("[RecordQuest][auth] could not save stay-signed-in preference:", error);
  }
}

async function resetStaySignedInPreference(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STAY_SIGNED_IN_KEY);
  } catch (error) {
    console.warn("[RecordQuest][auth] could not reset stay-signed-in preference:", error);
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [recoveryActive, setRecoveryActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileSetupStatus, setProfileSetupStatus] = useState<ProfileSetupStatus>("loading");
  const [profileSetupError, setProfileSetupError] = useState<string | null>(null);
  const recoveryActiveRef = useRef(false);

  function setRecoveryFlowState(nextRecoveryActive: boolean): void {
    recoveryActiveRef.current = nextRecoveryActive;
    setRecoveryActive(nextRecoveryActive);
  }

  function beginRecoveryFlow(): void {
    setRecoveryFlowState(true);
  }

  function clearRecoveryFlow(): void {
    setRecoveryFlowState(false);
  }

  function applySignedOutState(): void {
    setUser(null);
    setSession(null);
    setRecoveryFlowState(false);
    setProfileSetupStatus("ready");
    setProfileSetupError(null);
  }

  async function resolveProfileBootstrapGate(): Promise<AuthFlowResult> {
    if (recoveryActiveRef.current) {
      return {
        success: true,
        usernameSetupRequired: false,
      };
    }

    const profileBootstrap = await ensureOwnProfileFromAuthMetadata();

    if (profileBootstrap.success && profileBootstrap.status === "ready") {
      setProfileSetupStatus("ready");
      setProfileSetupError(null);
      return {
        success: true,
        usernameSetupRequired: false,
      };
    }

    if (profileBootstrap.status === "username-required") {
      setProfileSetupStatus("username-required");
      setProfileSetupError(
        profileBootstrap.error ??
          "We couldn't finish setting up your username. Please choose another username and try again."
      );

      return {
        success: false,
        usernameSetupRequired: true,
        error:
          profileBootstrap.error ??
          "We couldn't finish setting up your username. Please choose another username and try again.",
      };
    }

    if (profileBootstrap.status === "temporary-error") {
      setProfileSetupStatus("temporary-error");
      setProfileSetupError(profileBootstrap.error ?? "We couldn't initialize your profile right now. Please retry.");

      return {
        success: false,
        usernameSetupRequired: false,
        error: profileBootstrap.error ?? "We couldn't initialize your profile right now. Please retry.",
      };
    }

    if (profileBootstrap.status === "auth-invalid") {
      await supabaseSignOut();
      applySignedOutState();

      return {
        success: false,
        usernameSetupRequired: false,
        error: profileBootstrap.error ?? "Your session is no longer valid. Please sign in again.",
      };
    }

    return {
      success: false,
      usernameSetupRequired: false,
      error: "We couldn't initialize your profile right now. Please retry.",
    };
  }

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const staySignedIn = await getStaySignedInPreference();
      let activeSession = await getCurrentSession();

      if (!staySignedIn && activeSession) {
        const signOutResult = await supabaseSignOut();

        if (!signOutResult.success && __DEV__) {
          console.warn(
            "[RecordQuest][auth] failed to clear persisted session on cold launch:",
            signOutResult.error ?? "unknown error"
          );
        }

        activeSession = null;
      }

      if (!isMounted) {
        return;
      }

      if (!activeSession?.user) {
        applySignedOutState();
        setIsLoading(false);
        return;
      }

      if (recoveryActiveRef.current) {
        setSession(activeSession);
        setUser(activeSession.user);
        setProfileSetupStatus("ready");
        setProfileSetupError(null);
        setIsLoading(false);
        return;
      }

      setSession(activeSession);
      setUser(activeSession.user);
      setProfileSetupStatus("loading");
      setProfileSetupError(null);

      if (activeSession.user) {
        const bootstrapGate = await resolveProfileBootstrapGate();

        if (!bootstrapGate.success) {
          if (__DEV__) {
            console.warn(
              "[RecordQuest][auth] profile bootstrap blocked restored session:",
              bootstrapGate.error ?? "unknown error"
            );
          }

          setSession(activeSession);
          setUser(activeSession.user);
        }
      }

      setIsLoading(false);
    }

    restoreSession();

    const unsubscribe = onAuthStateChange((event, authenticated, authUser, authSession) => {
      if (event === "SIGNED_OUT") {
        applySignedOutState();
        return;
      }

      const isRecoveryEvent = event === "PASSWORD_RECOVERY" || recoveryActiveRef.current;

      if (event === "PASSWORD_RECOVERY") {
        setRecoveryFlowState(true);
      }

      setUser(authUser);
      setSession(authSession);
      setProfileSetupStatus(isRecoveryEvent ? "ready" : "loading");
      setProfileSetupError(null);

      if (isRecoveryEvent) {
        if (__DEV__) {
          console.log("[RecordQuest][auth] auth event handled", {
            authEvent: event,
            recoveryActive: true,
            routeCategory: "recovery",
            chosenNavigationTarget: "/auth/reset-password",
            normalRedirectSuppressed: true,
          });
        }

        return;
      }

      void (async () => {
        const bootstrapGate = await resolveProfileBootstrapGate();

        if (!isMounted) {
          return;
        }

        if (!bootstrapGate.success) {
          if (__DEV__) {
            console.warn(
              "[RecordQuest][auth] auth state session blocked by bootstrap:",
              bootstrapGate.error ?? "unknown error"
            );
          }

          return;
        }
      })();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      recoveryActive,
      isLoading,
      profileSetupStatus,
      profileSetupError,
      beginRecoveryFlow,
      clearRecoveryFlow,
      signIn: async (email: string, password: string, staySignedIn: boolean) => {
        const result = await signInWithEmail(email, password);
        let usernameSetupRequired = false;

        if (!result.success && __DEV__) {
          console.warn("[RecordQuest][auth] signIn failed:", result.error ?? "unknown error");
        }

        if (result.success && result.session) {
          clearRecoveryFlow();
          setSession(result.session);
          setUser(result.session.user);
          setProfileSetupStatus("loading");
          setProfileSetupError(null);

          const bootstrapGate = await resolveProfileBootstrapGate();
          usernameSetupRequired = Boolean(bootstrapGate.usernameSetupRequired);

          if (!bootstrapGate.success) {
            if (__DEV__) {
              console.warn(
                "[RecordQuest][auth] signIn blocked by bootstrap:",
                bootstrapGate.error ?? "unknown error"
              );
            }

            return {
              success: false,
              error: bootstrapGate.error,
              user: result.user,
              session: result.session,
              usernameSetupRequired,
            };
          }

          await setStaySignedInPreference(staySignedIn);
        } else if (result.success) {
          applySignedOutState();
        }

        return {
          ...result,
          usernameSetupRequired,
        };
      },
      signUp: async (email: string, password: string, username?: string) => {
        const result = await signUpWithEmail(email, password, username);
        let usernameSetupRequired = false;

        if (!result.success && __DEV__) {
          console.warn("[RecordQuest][auth] signUp failed:", result.error ?? "unknown error");
        }

        if (result.success && result.session) {
          clearRecoveryFlow();
          setSession(result.session);
          setUser(result.session.user);
          setProfileSetupStatus("loading");
          setProfileSetupError(null);

          const bootstrapGate = await resolveProfileBootstrapGate();
          usernameSetupRequired = Boolean(bootstrapGate.usernameSetupRequired);

          if (!bootstrapGate.success) {
            if (__DEV__) {
              console.warn(
                "[RecordQuest][auth] signUp blocked by bootstrap:",
                bootstrapGate.error ?? "unknown error"
              );
            }

            return {
              success: false,
              error: bootstrapGate.error,
              user: result.user,
              session: result.session,
              usernameSetupRequired,
            };
          }
        } else if (result.success) {
          applySignedOutState();
        }

        return {
          ...result,
          usernameSetupRequired,
        };
      },
      resendConfirmationEmail: async (email: string) => {
        const result = await resendSignupConfirmationEmail(email);

        if (!result.success && __DEV__) {
          console.warn("[RecordQuest][auth] resendConfirmationEmail failed:", result.error ?? "unknown error");
        }

        return result;
      },
      signOut: async () => {
        const result = await supabaseSignOut();

        if (!result.success && __DEV__) {
          console.warn("[RecordQuest][auth] signOut failed:", result.error ?? "unknown error");
        }

        if (result.success) {
          await resetStaySignedInPreference();
          applySignedOutState();
          router.replace("/(auth)/sign-in");
        }

        return result;
      },
      deleteAccount: async () => {
        const currentUserId = session?.user?.id ?? user?.id ?? null;

        if (!currentUserId) {
          return {
            success: false,
            error: "You must be signed in to delete your account.",
          };
        }

        const result = await supabaseDeleteAccount();

        if (!result.success) {
          return result;
        }

        await clearLocalUserData(currentUserId);
        await resetStaySignedInPreference();

        return {
          success: true,
        };
      },
      retryProfileSetup: async () => {
        if (!session?.user) {
          return;
        }

        setProfileSetupStatus("loading");
        setProfileSetupError(null);
        await resolveProfileBootstrapGate();
      },
      completeUsername: async (username: string) => {
        if (!session?.user) {
          return {
            success: false,
            error: "You must be signed in to continue.",
          };
        }

        const result = await completeOwnUsername(username);

        if (!result.success) {
          setProfileSetupStatus("username-required");
          setProfileSetupError(result.error ?? "Could not update your username right now.");
          return {
            success: false,
            error: result.error,
          };
        }

        setProfileSetupStatus("loading");
        setProfileSetupError(null);
        const bootstrapGate = await resolveProfileBootstrapGate();

        if (!bootstrapGate.success) {
          return {
            success: false,
            error: bootstrapGate.error,
          };
        }

        return {
          success: true,
        };
      },
    }),
    [beginRecoveryFlow, clearRecoveryFlow, isLoading, profileSetupError, profileSetupStatus, recoveryActive, session, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return context;
}
