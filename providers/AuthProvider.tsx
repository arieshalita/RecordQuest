import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { router } from "expo-router";
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
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<AuthResponse>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const activeSession = await getCurrentSession();

      if (!isMounted) {
        return;
      }

      setSession(activeSession);
      setUser(activeSession?.user ?? null);
      setIsLoading(false);
    }

    restoreSession();

    const unsubscribe = onAuthStateChange((authenticated, authUser) => {
      console.log("[RecordQuest][auth] auth state changed", {
        authenticated,
        userId: authUser?.id ?? null,
      });
      setUser(authenticated ? authUser : null);

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
      signIn: async (email: string, password: string) => {
        const result = await signInWithEmail(email, password);

        if (result.success) {
          setSession(result.session ?? null);
          setUser(result.user ?? null);
        }

        return result;
      },
      signUp: async (email: string, password: string) => {
        const result = await signUpWithEmail(email, password);

        if (result.success) {
          setSession(result.session ?? null);
          setUser(result.user ?? null);
        }

        return result;
      },
      signOut: async () => {
        console.log("[RecordQuest][auth] signOut action called");
        const result = await supabaseSignOut();
        console.log("[RecordQuest][auth] Supabase signOut result", {
          success: result.success,
          error: result.error ?? null,
        });

        if (result.success) {
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
