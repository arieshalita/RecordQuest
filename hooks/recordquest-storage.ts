import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  isSupabaseDataModeEnabled,
  RECORDQUEST_DATA_MODE,
} from "../constants/data-mode";
import { getCurrentSession } from "./supabase-client";
import {
  ensureUserProfile,
  loadActivity,
  loadRecords,
  loadStoreCheckins,
  loadWishlist,
  saveActivity,
  saveRecords,
  saveStoreCheckins,
  saveWishlist,
} from "./recordquest-supabase-service";
import type { RecordItem } from "./types";

export type { RecordItem };

export type RecordQuestState = {
  records: RecordItem[];
  wishlist: RecordItem[];
  activity: string[];
  storeCheckIns: Record<string, number>;
};

// TODO: Accounts Phase – New UserState type for authenticated user context
// export type UserState = {
//   userId: string;
//   email: string;
//   profile: {
//     name: string;
//     bio?: string;
//     avatar?: string;
//   };
//   createdAt: string;
//   lastSyncedAt?: string;
// };

// TODO: Accounts Phase – Add user-scoped storage keys
// Storage keys will be scoped per user:
// e.g., recordquest_records_${userId}, recordquest_wishlist_${userId}

export const RECORDS_KEY = "recordquest_records";
export const WISHLIST_KEY = "recordquest_wishlist";
export const ACTIVITY_KEY = "recordquest_activity";
export const STORE_CHECKINS_KEY = "recordquest_store_checkins";

// TODO: Accounts Phase – Add auth token storage key
// export const AUTH_TOKEN_KEY = "recordquest_auth_token";
// export const CURRENT_USER_KEY = "recordquest_current_user";

async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const session = await getCurrentSession();
    return session?.user?.id ?? null;
  } catch (error) {
    console.warn("Unable to resolve current user for data mode:", error);
    return null;
  }
}

async function loadLocalState(initialState: RecordQuestState): Promise<RecordQuestState> {
  const [savedRecords, savedWishlist, savedActivity, savedCheckIns] = await Promise.all([
    AsyncStorage.getItem(RECORDS_KEY),
    AsyncStorage.getItem(WISHLIST_KEY),
    AsyncStorage.getItem(ACTIVITY_KEY),
    AsyncStorage.getItem(STORE_CHECKINS_KEY),
  ]);

  const parsedRecords = savedRecords ? (JSON.parse(savedRecords) as RecordItem[]) : null;
  const parsedWishlist = savedWishlist ? (JSON.parse(savedWishlist) as RecordItem[]) : null;
  const parsedActivity = savedActivity ? (JSON.parse(savedActivity) as string[]) : null;
  const parsedCheckIns = savedCheckIns
    ? (JSON.parse(savedCheckIns) as Record<string, number>)
    : null;

  return {
    records: Array.isArray(parsedRecords) ? parsedRecords : initialState.records,
    wishlist: Array.isArray(parsedWishlist) ? parsedWishlist : initialState.wishlist,
    activity: Array.isArray(parsedActivity) ? parsedActivity : initialState.activity,
    storeCheckIns:
      parsedCheckIns && typeof parsedCheckIns === "object"
        ? parsedCheckIns
        : initialState.storeCheckIns,
  } satisfies RecordQuestState;
}

async function saveLocalState(state: RecordQuestState): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(state.records)),
    AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(state.wishlist)),
    AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(state.activity)),
    AsyncStorage.setItem(STORE_CHECKINS_KEY, JSON.stringify(state.storeCheckIns)),
  ]);
}

export async function loadRecordQuestState(initialState: RecordQuestState) {
  try {
    const userId = await getAuthenticatedUserId();

    if (isSupabaseDataModeEnabled() && userId) {
      const [records, wishlist, activity, storeCheckIns] = await Promise.all([
        loadRecords(userId),
        loadWishlist(userId),
        loadActivity(userId),
        loadStoreCheckins(userId),
      ]);

      if (
        records.length === 0 &&
        wishlist.length === 0 &&
        activity.length === 0 &&
        Object.keys(storeCheckIns).length === 0
      ) {
        await ensureUserProfile(userId);
      }

      return {
        records,
        wishlist,
        activity,
        storeCheckIns,
      } satisfies RecordQuestState;
    }

    if (isSupabaseDataModeEnabled() && !userId) {
      console.warn("[RecordQuest][storage] Supabase mode active but no authenticated user found; using AsyncStorage fallback");
    }

    return await loadLocalState(initialState);
  } catch (error) {
    console.warn("Error loading saved data:", error);
    return await loadLocalState(initialState);
  }
}

export async function saveRecordQuestState(state: RecordQuestState) {
  try {
    await saveLocalState(state);

    if (!isSupabaseDataModeEnabled()) {
      return;
    }

    const userId = await getAuthenticatedUserId();
    if (!userId) {
      console.warn("[RecordQuest][storage] skipping Supabase save because no authenticated user id is available");
      return;
    }

    await Promise.all([
      saveRecords(userId, state.records),
      saveWishlist(userId, state.wishlist),
      saveActivity(userId, state.activity),
      saveStoreCheckins(userId, state.storeCheckIns),
    ]);
  } catch (error) {
    console.warn("Error saving data:", error);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// TODO: ACCOUNTS PHASE – Supabase Cloud Sync Functions
// These functions will be implemented in Phase 2.1 (Supabase Setup)
// Current behavior: All data stays in AsyncStorage only.
// After Supabase setup: These functions will handle:
//   1. User authentication via Supabase Auth
//   2. Cloud data sync for multi-device support
//   3. Remote backup and recovery
// ═════════════════════════════════════════════════════════════════════════

/**
 * TODO: ACCOUNTS PHASE – Get current authenticated user ID from Supabase Auth
 * Will replace/supplement local storage checks
 * Integration: After Supabase Auth setup
 * @returns userId if authenticated, null if not
 */
// export async function getCurrentUserId(): Promise<string | null> {
//   // TODO: Implement with Supabase Auth
//   // const { data: { user } } = await supabase.auth.getUser();
//   // return user?.id || null;
// }

/**
 * TODO: ACCOUNTS PHASE – Load user data from Supabase instead of AsyncStorage
 * Will fetch user-specific records, wishlist, activities from remote database
 * Integration: After Supabase Auth & Database schema setup
 * @param userId - User's unique ID from Supabase Auth
 * @returns User's RecordQuestState from cloud
 */
// export async function loadFromSupabase(userId: string): Promise<RecordQuestState> {
//   // TODO: Implement with Supabase
//   // const { data: records } = await supabase
//   //   .from("records")
//   //   .select("*")
//   //   .eq("user_id", userId);
//   // Similar queries for wishlist, activity, store_checkins
//   // Return merged state
// }

/**
 * TODO: ACCOUNTS PHASE – Sync user data to Supabase cloud
 * Will be called after every state save to keep cloud in sync
 * Integration: After Supabase Auth & Database schema setup
 * @param userId - User's unique ID from Supabase Auth
 * @param state - Complete RecordQuestState to sync
 */
// export async function syncToSupabase(userId: string, state: RecordQuestState): Promise<void> {
//   // TODO: Implement with Supabase
//   // Upsert records with user_id relationship
//   // Track lastSyncedAt timestamp
//   // Handle conflict resolution for offline edits
//   // const { error } = await supabase
//   //   .from("records")
//   //   .upsert(state.records.map(r => ({ ...r, user_id: userId })));
// }

/**
 * TODO: ACCOUNTS PHASE – Clear local data on logout
 * Will remove all cached user data from AsyncStorage
 * Integration: After Supabase Auth logout implemented
 */
// export async function clearLocalUserData(): Promise<void> {
//   // TODO: Implement with AsyncStorage cleanup
//   // await Promise.all([
//   //   AsyncStorage.removeItem(RECORDS_KEY),
//   //   AsyncStorage.removeItem(WISHLIST_KEY),
//   //   AsyncStorage.removeItem(ACTIVITY_KEY),
//   //   AsyncStorage.removeItem(STORE_CHECKINS_KEY),
//   // ]);
// }

/**
 * TODO: ACCOUNTS PHASE – Merge offline edits with cloud data
 * Will handle conflicts when device comes back online
 * Integration: After sync conflict resolution strategy is defined
 * @param localState - User's local AsyncStorage data
 * @param cloudState - User's remote Supabase data
 * @returns Merged state (cloud wins by default, or customizable strategy)
 */
// export function mergeCloudAndLocalState(
//   localState: RecordQuestState,
//   cloudState: RecordQuestState
// ): RecordQuestState {
//   // TODO: Implement merge strategy
//   // Option 1: Cloud wins (default for read-only data)
//   // Option 2: Local wins (for recent edits)
//   // Option 3: Timestamp-based (newest wins)
//   // Option 4: Union strategy (combine unique records from both)
// }
