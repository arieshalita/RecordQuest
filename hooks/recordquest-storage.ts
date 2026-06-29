import AsyncStorage from "@react-native-async-storage/async-storage";

export type RecordItem = {
  id: number;
  album: string;
  artist: string;
  year: string;
  genre: string;
  cover: string;
  purchasedAt?: string;
  purchaseDate?: string;
  condition?: string;
  price?: string;
  notes?: string;
  favoriteTrack?: string;
  rating?: number;
};

export const RECORDS_KEY = "recordquest_records";
export const WISHLIST_KEY = "recordquest_wishlist";
export const ACTIVITY_KEY = "recordquest_activity";
export const STORE_CHECKINS_KEY = "recordquest_store_checkins";

type RecordQuestState = {
  records: RecordItem[];
  wishlist: RecordItem[];
  activity: string[];
  storeCheckIns: Record<string, number>;
};

export async function loadRecordQuestState(initialState: RecordQuestState) {
  try {
    const [savedRecords, savedWishlist, savedActivity, savedCheckIns] = await Promise.all([
      AsyncStorage.getItem(RECORDS_KEY),
      AsyncStorage.getItem(WISHLIST_KEY),
      AsyncStorage.getItem(ACTIVITY_KEY),
      AsyncStorage.getItem(STORE_CHECKINS_KEY),
    ]);

    const parsedRecords = savedRecords ? (JSON.parse(savedRecords) as RecordItem[]) : null;
    const parsedWishlist = savedWishlist ? (JSON.parse(savedWishlist) as RecordItem[]) : null;
    const parsedActivity = savedActivity ? (JSON.parse(savedActivity) as string[]) : null;
    const parsedCheckIns = savedCheckIns ? (JSON.parse(savedCheckIns) as Record<string, number>) : null;

    return {
      records: Array.isArray(parsedRecords) ? parsedRecords : initialState.records,
      wishlist: Array.isArray(parsedWishlist) ? parsedWishlist : initialState.wishlist,
      activity: Array.isArray(parsedActivity) ? parsedActivity : initialState.activity,
      storeCheckIns: parsedCheckIns && typeof parsedCheckIns === "object" ? parsedCheckIns : initialState.storeCheckIns,
    } satisfies RecordQuestState;
  } catch (error) {
    console.warn("Error loading saved data:", error);
    return initialState;
  }
}

export async function saveRecordQuestState(state: RecordQuestState) {
  try {
    await Promise.all([
      AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(state.records)),
      AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(state.wishlist)),
      AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(state.activity)),
      AsyncStorage.setItem(STORE_CHECKINS_KEY, JSON.stringify(state.storeCheckIns)),
    ]);
  } catch (error) {
    console.warn("Error saving data:", error);
  }
}
