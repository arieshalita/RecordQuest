/**
 * Supabase Client Configuration & Auth Helpers
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * REQUIRED .env VARIABLES:
 * ════════════════════════════════════════════════════════════════════════════
 * Add these to your .env file (create one in project root if it doesn't exist):
 * 
 * EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
 * EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
 * 
 * Where to find these values:
 * 1. Go to https://supabase.com and log in
 * 2. Select your RecordQuest project
 * 3. Go to Settings → API
 * 4. Copy "Project URL" and "anon public" key
 * 
 * For local development:
 * - Copy these values to .env file (Expo reads EXPO_PUBLIC_* prefix)
 * - Run: npx expo start
 * - Env variables load automatically
 * 
 * For production:
 * - Add these as environment variables in your deployment platform
 * - Do NOT commit .env to git (add to .gitignore)
 * ════════════════════════════════════════════════════════════════════════════
 */

import {
  createClient,
  SupabaseClient,
  type Session,
  type User,
} from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Read environment variables with Expo public prefix
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Validate that required environment variables are set
 */
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration. Please add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file."
  );
}

/**
 * Initialize Supabase client
 * This client is used for all Supabase operations (auth, database, etc.)
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

/**
 * Type for auth responses
 */
export interface AuthResponse {
  success: boolean;
  error?: string;
  user?: User | null;
  session?: Session | null;
}

/**
 * PLACEHOLDER: Sign up with email and password
 * 
 * TODO: Accounts Phase 2.1 – Implement authentication
 * This will be called from LoginScreen when user creates account.
 * 
 * Current behavior: Returns error (not yet implemented)
 * Future behavior:
 * - Validate email format and password strength
 * - Call supabase.auth.signUp() with email/password
 * - Handle confirmation email if email verification required
 * - Trigger profile creation in user_profiles table
 * - Return session token for automatic login
 * 
 * @param email User email address
 * @param password User password (min 8 chars recommended)
 * @returns AuthResponse with session or error
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown signup error",
    };
  }
}

/**
 * PLACEHOLDER: Sign in with email and password
 * 
 * TODO: Accounts Phase 2.1 – Implement authentication
 * This will be called from LoginScreen when user logs in.
 * 
 * Current behavior: Returns error (not yet implemented)
 * Future behavior:
 * - Validate email/password format
 * - Call supabase.auth.signInWithPassword()
 * - Store session token in memory
 * - Set isAuthenticated flag in app state
 * - Trigger data load from Supabase (via loadRecordQuestState)
 * - Show app screens instead of login screen
 * 
 * @param email User email address
 * @param password User password
 * @returns AuthResponse with session or error
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown signin error",
    };
  }
}

/**
 * PLACEHOLDER: Sign out current user
 * 
 * TODO: Accounts Phase 2.1 – Implement authentication
 * This will be called when user taps logout in ProfileScreen.
 * 
 * Current behavior: Returns error (not yet implemented)
 * Future behavior:
 * - Call supabase.auth.signOut()
 * - Clear session from memory
 * - Clear local user data cache (via clearLocalUserData)
 * - Reset app state to initial
 * - Show login screen instead of app screens
 * 
 * @returns AuthResponse confirming logout
 */
export async function signOut(): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown signout error",
    };
  }
}

/**
 * PLACEHOLDER: Get current authenticated session
 * 
 * TODO: Accounts Phase 2.1 – Implement authentication
 * This will be called on app startup (App component useEffect).
 * 
 * Current behavior: Returns no session (not yet implemented)
 * Future behavior:
 * - Check if user is already logged in (from stored session token)
 * - Return session if valid
 * - Return null if no session or session expired
 * - Used to decide: show login screen vs app screens
 * 
 * @returns Current session object or null if not authenticated
 */
export async function getCurrentSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Error getting session:", error.message);
      return null;
    }

    return data.session;
  } catch (err: unknown) {
    console.error("Error getting session:", err);
    return null;
  }
}

/**
 * PLACEHOLDER: Set up auth state change listener
 * 
 * TODO: Accounts Phase 2.1 – Implement authentication
 * This will be called in App component once to listen for auth changes.
 * 
 * Current behavior: Callback never fires (not yet implemented)
 * Future behavior:
 * - Listen to Supabase auth state changes (login, logout, token refresh)
 * - Call callback when user logs in/out
 * - Used to update app UI automatically on auth changes
 * 
 * @param callback Function to call when auth state changes
 * @returns Unsubscribe function to stop listening
 */
export function onAuthStateChange(
  callback: (authenticated: boolean, user: User | null, session: Session | null) => void
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(!!session, session?.user ?? null, session ?? null);
  });

  return () => {
    subscription.unsubscribe();
  };
}
