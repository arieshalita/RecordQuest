import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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
  signOut as supabaseSignOut,
  signUpWithEmail,
  type AuthResponse,
} from "../hooks/supabase-client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string, staySignedIn: boolean) => Promise<AuthResponse>;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<AuthResponse>;
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
  const [isLoading, setIsLoading] = useState(true);

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

      setSession(activeSession);
      setUser(activeSession?.user ?? null);
      setIsLoading(false);
    }

    restoreSession();

    const unsubscribe = onAuthStateChange((authenticated, authUser, authSession) => {
      setUser(authenticated ? authUser : null);
      setSession(authenticated ? authSession : null);

      if (!authenticated) {
        setSession(null);
      }
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
      isLoading,
      signIn: async (email: string, password: string, staySignedIn: boolean) => {
        const result = await signInWithEmail(email, password);

        if (!result.success && __DEV__) {
          console.warn("[RecordQuest][auth] signIn failed:", result.error ?? "unknown error");
        }

        if (result.success && result.session) {
          await setStaySignedInPreference(staySignedIn);
          setSession(result.session);
          setUser(result.session.user);
        } else if (result.success) {
          setSession(null);
          setUser(null);
        }

        return result;
      },
      signUp: async (email: string, password: string) => {
        const result = await signUpWithEmail(email, password);

        if (!result.success && __DEV__) {
          console.warn("[RecordQuest][auth] signUp failed:", result.error ?? "unknown error");
        }

        if (result.success && result.session) {
          setSession(result.session);
          setUser(result.session.user);
        } else if (result.success) {
          setSession(null);
          setUser(null);
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
          setSession(null);
          setUser(null);
          router.replace("/(auth)/sign-in");
        }

        return result;
      },
    }),
    [isLoading, session, user]
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
