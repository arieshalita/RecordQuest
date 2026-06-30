import React, { useEffect, useState, useRef } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import {
  loadRecordQuestState,
  saveRecordQuestState,
  type RecordItem,
} from "../../hooks/recordquest-storage";
import { enrichRecordItem, searchAlbumResults, type AlbumSearchResult } from "../../hooks/album-lookup";
import type { StoreItem, AchievementCategory } from "../../hooks/types";
import { calculateAchievementCategories } from "../../utils/achievements";
import { calculateCollectionAnalytics } from "../../utils/analytics";
import { RecordListScreen } from "../../screens/CollectionScreen";
import { WishlistScreen } from "../../screens/WishlistScreen";
import { AlbumDetailScreen } from "../../screens/AlbumDetailScreen";
import { ProfileScreen } from "../../screens/ProfileScreen";
import { StoreFinderScreen } from "../../screens/StoreFinderScreen";
import { StoreDetailScreen } from "../../screens/StoreDetailScreen";
import { HomeScreen } from "../../screens/HomeScreen";
import { ConfirmPurchaseDetailsModal } from "../../components/ConfirmPurchaseDetailsModal";
import { StatCard } from "../../components/StatCard";
import { TopBar } from "../../components/TopBar";
import { HomeCard } from "../../components/HomeCard";
import { NavItem } from "../../components/NavItem";
import { BottomNavigation } from "../../components/BottomNavigation";
import { Toast } from "../../components/Toast";
import { useAuth } from "../../providers/AuthProvider";
import { isSupabaseDataModeEnabled } from "../../constants/data-mode";

const starterRecords: RecordItem[] = [
  {
    id: 1,
    album: "Random Access Memories",
    artist: "Daft Punk",
    year: "2013",
    genre: "Electronic",
    cover: "https://upload.wikimedia.org/wikipedia/en/a/a7/Random_Access_Memories.jpg",
    purchasedAt: "Rogue Records",
  },
  {
    id: 2,
    album: "(What's the Story) Morning Glory?",
    artist: "Oasis",
    year: "1995",
    genre: "Rock",
    cover:
      "https://upload.wikimedia.org/wikipedia/en/1/17/Oasis_-_%28What%27s_the_Story%29_Morning_Glory_album_cover.jpg",
    purchasedAt: "Local crate shop",
  },
];

const recordStores: StoreItem[] = [
  {
    id: "needham-vinyl",
    name: "Needham Vinyl Exchange",
    neighborhood: "Needham Center",
    address: "123 Chestnut St, Needham, MA",
    hours: "11am–8pm",
    rating: "4.8 • 220 reviews",
    distance: "2.1 mi",
    description: "A curated collection of classic rock, soul, and indie records with a cozy listening lounge.",
  },
  {
    id: "brookline-beats",
    name: "Brookline Beats",
    neighborhood: "Coolidge Corner",
    address: "41 Harvard Ave, Brookline, MA",
    hours: "10am–7pm",
    rating: "4.7 • 180 reviews",
    distance: "5.3 mi",
    description: "Neighborhood shop with a strong selection of jazz, funk, and local Boston pressings.",
  },
  {
    id: "cambridge-sound",
    name: "Cambridge Sound Cave",
    neighborhood: "Central Square",
    address: "58 Mass Ave, Cambridge, MA",
    hours: "11am–9pm",
    rating: "4.9 • 310 reviews",
    distance: "7.0 mi",
    description: "Underground vinyl den with rare finds, live DJs, and a friendly crate-digging crowd.",
  },
  {
    id: "watertown-wax",
    name: "Watertown Wax Works",
    neighborhood: "Watertown Square",
    address: "10 Mt Auburn St, Watertown, MA",
    hours: "12pm–8pm",
    rating: "4.6 • 140 reviews",
    distance: "6.2 mi",
    description: "Bright shop with new and used vinyl, plus a small listening room for previewing stacks.",
  },
];

// ═════════════════════════════════════════════════════════════════════════
// TODO: ACCOUNTS PHASE – Authentication Integration Points
// ═════════════════════════════════════════════════════════════════════════
// Current Architecture: Single local user, all data in AsyncStorage
// 
// After Supabase Setup (Phase 2.1):
// 1. Wrap App in AuthProvider (Supabase Auth context)
//    <AuthProvider>
//      <App />
//    </AuthProvider>
//
// 2. Check user authentication state on app load:
//    - If authenticated: Load user's cloud data
//    - If not authenticated: Show login screen
//    - If offline: Use cached AsyncStorage data
//
// 3. User context will include:
//    - userId: string (from Supabase Auth)
//    - email: string
//    - isAuthenticated: boolean
//    - isLoading: boolean
//    - logout: () => void
//
// 4. Data loading flow becomes:
//    useEffect(() => {
//      if (isAuthenticated) {
//        // Load from Supabase + sync with local
//        const state = await loadRecordQuestState(initialState);
//      } else {
//        // Load from local AsyncStorage only
//        const state = await loadRecordQuestState(initialState);
//      }
//    }, [isAuthenticated]);
//
// 5. Data saving flow becomes:
//    - Save to AsyncStorage (offline support)
//    - If authenticated: Sync to Supabase in background
//
// See: hooks/recordquest-storage.ts for detailed sync comments
// ═════════════════════════════════════════════════════════════════════════

export default function App() {
  const { user } = useAuth();
  const [screen, setScreen] = useState("Home");
  const [records, setRecords] = useState<RecordItem[]>(starterRecords);
  const [wishlist, setWishlist] = useState<RecordItem[]>([]);
  const [album, setAlbum] = useState("");
  const [artist, setArtist] = useState("");
  const [searchResults, setSearchResults] = useState<AlbumSearchResult[]>([]);
  const [selectedMetadata, setSelectedMetadata] = useState<AlbumSearchResult | null>(null);
  const [purchasedAt, setPurchasedAt] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [activity, setActivity] = useState<string[]>([
    "Added Random Access Memories",
    "Started your RecordQuest collection",
  ]);
  const [detailStore, setDetailStore] = useState<StoreItem | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);
  const [detailSource, setDetailSource] = useState<"Collection" | "Wishlist" | null>(null);
  const [isEditingRecord, setIsEditingRecord] = useState(false);
  const [recordDraft, setRecordDraft] = useState<Partial<RecordItem>>({});
  const [storeCheckIns, setStoreCheckIns] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [recordBeingPromoted, setRecordBeingPromoted] = useState<RecordItem | null>(null);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseCondition, setPurchaseCondition] = useState("Good");
  const [purchasedAtDetail, setPurchasedAtDetail] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [successMessageTimer, setSuccessMessageTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const didHydrateRef = useRef(false);

  const achievementCategories = calculateAchievementCategories(records, wishlist, storeCheckIns, activity);
  const unlockedBadgeCount = achievementCategories
    .flatMap((category) => category.badges)
    .filter((badge) => badge.unlocked).length;

  const placeholderCover =
    "https://upload.wikimedia.org/wikipedia/commons/3/3c/No-album-art.png";

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const shouldUseCloudData = isSupabaseDataModeEnabled() && !!user;
      const initialState = {
        records: shouldUseCloudData ? [] : starterRecords,
        wishlist: [],
        activity: shouldUseCloudData
          ? []
          : [
              "Added Random Access Memories",
              "Started your RecordQuest collection",
            ],
        storeCheckIns: {},
      };

      // TODO: Accounts Phase – Data Loading
      // After Supabase setup, this will conditionally load from cloud vs local:
      // if (currentUserId) {
      //   const savedState = await loadFromSupabase(currentUserId);
      // } else {
      //   const savedState = await loadRecordQuestState(initialState);
      // }
      const savedState = await loadRecordQuestState(initialState);

      if (!isMounted) return;

      setRecords(savedState.records);
      setWishlist(savedState.wishlist);
      setActivity(savedState.activity);
      setStoreCheckIns(savedState.storeCheckIns);
      didHydrateRef.current = false;
      setLoaded(true);
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!loaded) return;

    if (!didHydrateRef.current) {
      didHydrateRef.current = true;
      return;
    }

    // TODO: Accounts Phase – Data Persistence & Sync
    // This will now also sync to Supabase if authenticated:
    // await saveRecordQuestState({ records, wishlist, activity, storeCheckIns });
    // (Also triggers background cloud sync in saveRecordQuestState)
    saveRecordQuestState({ records, wishlist, activity, storeCheckIns });
  }, [records, wishlist, activity, storeCheckIns, loaded]);

  // Cleanup success message timer on unmount
  useEffect(() => {
    return () => {
      if (successMessageTimer) {
        clearTimeout(successMessageTimer);
      }
    };
  }, [successMessageTimer]);

  function showSuccess(message: string) {
    if (successMessageTimer) clearTimeout(successMessageTimer);
    setSuccessMessage(message);
    const timer = setTimeout(() => {
      setSuccessMessage("");
    }, 2800);
    setSuccessMessageTimer(timer);
  }

  async function addRecord(toWishlist: boolean) {
    const trimmedAlbum = album.trim();
    const trimmedArtist = artist.trim();
    
    if (!trimmedAlbum || !trimmedArtist) {
      setSearchMessage("Please enter both album name and artist.");
      return;
    }

    const baseItem: RecordItem = {
      id: Date.now(),
      album: trimmedAlbum,
      artist: trimmedArtist,
      year: "Unknown",
      genre: "Vinyl",
      cover: placeholderCover,
      purchasedAt: purchasedAt.trim() || undefined,
      purchaseDate: "",
      condition: "Good",
      price: "",
      notes: "",
    };

    const metadata = selectedMetadata
      ? {
          year: selectedMetadata.year,
          cover: selectedMetadata.cover,
          genre: selectedMetadata.genre,
        }
      : null;
    const newItem = metadata ? enrichRecordItem(baseItem, metadata) : baseItem;
    newItem.purchasedAt = purchasedAt.trim() || undefined;

    if (toWishlist) {
      setWishlist([newItem, ...wishlist]);
      setActivity([`Added ${newItem.album} to wishlist`, ...activity]);
      showSuccess(`✓ Added to Wishlist`);
    } else {
      setRecords([newItem, ...records]);
      setActivity([`Added ${newItem.album} to collection`, ...activity]);
      showSuccess(`✓ Added to Collection`);
    }

    setAlbum("");
    setArtist("");
    setPurchasedAt("");
    setSearchResults([]);
    setSelectedMetadata(null);
    setSearchMessage("");
  }

  async function searchAlbum() {
    if (!album.trim()) {
      setSearchResults([]);
      setSelectedMetadata(null);
      setSearchMessage("Type an album title to search.");
      return;
    }

    setIsSearching(true);
    setSearchMessage("");
    const results = await searchAlbumResults(album, artist);
    setSearchResults(results);
    setSelectedMetadata(null);
    setIsSearching(false);

    if (!results.length) {
      setSearchMessage("No matches found. You can still add the record manually.");
    }
  }

  function handleAlbumInputChange(value: string) {
    setAlbum(value);
    // Clear all search/selection state when user starts typing
    setSelectedMetadata(null);
    setSearchResults([]);
    setSearchMessage("");
  }

  function handleArtistChange(value: string) {
    setArtist(value);
    setSelectedMetadata(null);
    setSearchResults([]);
    setSearchMessage("");
  }

  function markFound(item: RecordItem) {
    setRecordBeingPromoted(item);
    setPurchasedAtDetail("");
    setPurchasePrice("");
    setPurchaseDate("");
    setPurchaseCondition("Good");
    setShowPurchaseModal(true);
  }

  function completePurchaseAndMoveToCollection() {
    if (!recordBeingPromoted) return;

    const updatedRecord = {
      ...recordBeingPromoted,
      purchasedAt: purchasedAtDetail || recordBeingPromoted.purchasedAt || undefined,
      price: purchasePrice || recordBeingPromoted.price || "",
      purchaseDate: purchaseDate || recordBeingPromoted.purchaseDate || "",
      condition: purchaseCondition || recordBeingPromoted.condition || "Good",
    };

    setWishlist(wishlist.filter((w) => w.id !== recordBeingPromoted.id));
    setRecords([updatedRecord, ...records]);
    setActivity([`Found ${updatedRecord.album}`, ...activity]);
    showSuccess(`✓ Found ${updatedRecord.album}`);

    setShowPurchaseModal(false);
    setRecordBeingPromoted(null);
    setPurchasedAtDetail("");
    setPurchasePrice("");
    setPurchaseDate("");
    setPurchaseCondition("Good");
  }

  function openDirections(address: string) {
    const query = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });

    if (url) {
      Linking.openURL(url).catch((error) => console.warn("Unable to open maps:", error));
    }
  }

  function checkIn(store: StoreItem) {
    setActivity((currentActivity) => [`Checked in at ${store.name}`, ...currentActivity]);
    setStoreCheckIns((current) => ({
      ...current,
      [store.id]: (current[store.id] ?? 0) + 1,
    }));
    showSuccess(`✓ Checked in at ${store.name}`);
  }

  function removeRecord(item: RecordItem) {
    setRecords(records.filter((record) => record.id !== item.id));
    setActivity([`Removed ${item.album} from collection`, ...activity]);
    showSuccess(`✓ Removed from Collection`);
  }

  function removeWishlist(item: RecordItem) {
    setWishlist(wishlist.filter((wish) => wish.id !== item.id));
    setActivity([`Removed ${item.album} from wishlist`, ...activity]);
    showSuccess(`✓ Removed from Wishlist`);
  }

  function openRecordDetail(item: RecordItem, source: "Collection" | "Wishlist") {
    setSelectedRecord(item);
    setDetailSource(source);
    setRecordDraft(item);
    setIsEditingRecord(false);
    setScreen("AlbumDetail");
  }

  function updateRecordDraft(field: keyof RecordItem, value: string | number) {
    setRecordDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function saveRecordDetail() {
    if (!selectedRecord || !detailSource) return;

    const updatedRecord: RecordItem = {
      ...selectedRecord,
      ...recordDraft,
    } as RecordItem;

    if (detailSource === "Collection") {
      setRecords((current) => current.map((record) => (record.id === updatedRecord.id ? updatedRecord : record)));
    } else {
      setWishlist((current) => current.map((record) => (record.id === updatedRecord.id ? updatedRecord : record)));
    }

    setSelectedRecord(updatedRecord);
    setRecordDraft(updatedRecord);
    setIsEditingRecord(false);
    setActivity((currentActivity) => [`Updated ${updatedRecord.album}`, ...currentActivity]);
    showSuccess(`✓ Saved`);
  }

  function deleteRecordDetail() {
    if (!selectedRecord || !detailSource) return;

    if (detailSource === "Collection") {
      setRecords((current) => current.filter((record) => record.id !== selectedRecord.id));
      setActivity((currentActivity) => [`Deleted ${selectedRecord.album} from collection`, ...currentActivity]);
      showSuccess(`✓ Removed from Collection`);
    } else {
      setWishlist((current) => current.filter((record) => record.id !== selectedRecord.id));
      setActivity((currentActivity) => [`Deleted ${selectedRecord.album} from wishlist`, ...currentActivity]);
      showSuccess(`✓ Removed from Wishlist`);
    }

    setSelectedRecord(null);
    setDetailSource(null);
    setIsEditingRecord(false);
    setRecordDraft({});
    setScreen(detailSource === "Collection" ? "Collection" : "Wishlist");
  }

  function closeRecordDetail() {
    // Save the destination before clearing state
    const targetScreen = detailSource === "Collection" ? "Collection" : detailSource === "Wishlist" ? "Wishlist" : "Home";
    
    setSelectedRecord(null);
    setDetailSource(null);
    setIsEditingRecord(false);
    setRecordDraft({});
    setScreen(targetScreen);
  }

  if (!loaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.cloudLoadingContainer}>
          <ActivityIndicator size="large" color="#A78BFA" />
          <Text style={styles.cloudLoadingText}>Loading your collection...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      {screen === "Home" && (
        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.logo}>RecordQuest</Text>
          <Text style={styles.tagline}>Discover. Collect. Spin.</Text>

          <View style={styles.hero}>
            <View style={styles.heroGlow} />
            <Text style={styles.heroKicker}>TODAY'S QUEST</Text>
            <Text style={styles.heroTitle}>Find your next favorite record.</Text>
            <Text style={styles.heroText}>
              Track your collection, build a wishlist, and turn crate digging into a game.
            </Text>
          </View>

          <View style={styles.statsRow}>
            <StatCard value={records.length} label="Records" />
            <StatCard value={wishlist.length} label="Wishlist" />
            <StatCard value={3} label="Badges" />
          </View>

          <Text style={styles.sectionTitle}>Explore</Text>

          <HomeCard title="Find Stores" subtitle="Record shops and crate spots" onPress={() => setScreen("Stores")} />
          <HomeCard title="My Collection" subtitle="Albums you own" onPress={() => setScreen("Collection")} />
          <HomeCard title="Wishlist" subtitle="Records you’re hunting for" onPress={() => setScreen("Wishlist")} />
          <HomeCard title="Profile" subtitle="Stats, badges, and activity" onPress={() => setScreen("Profile")} />
        </ScrollView>
      )}

      {screen === "Collection" && (
        <RecordListScreen
          title="My Collection"
          subtitle="Your personal vinyl shelf."
          records={records}
          album={album}
          artist={artist}
          purchasedAt={purchasedAt}
          setPurchasedAt={setPurchasedAt}
          searchResults={searchResults}
          selectedMetadata={selectedMetadata}
          isSearching={isSearching}
          searchMessage={searchMessage}
          onAlbumChange={handleAlbumInputChange}
          onArtistChange={handleArtistChange}
          onSearch={searchAlbum}
          onSelectResult={(result) => {
            setAlbum(result.album);
            setArtist(result.artist);
            setSelectedMetadata(result);
            setSearchResults([]);
            setSearchMessage(`Selected ${result.album}.`);
          }}
          onAdd={() => addRecord(false)}
          onRemove={removeRecord}
          onViewRecord={(record: RecordItem) => openRecordDetail(record, "Collection")}
          back={() => setScreen("Home")}
        />
      )}

      {screen === "Wishlist" && (
        <RecordListScreen
          title="Wishlist"
          subtitle="Records you want to find."
          records={wishlist}
          album={album}
          artist={artist}
          purchasedAt={purchasedAt}
          setPurchasedAt={setPurchasedAt}
          searchResults={searchResults}
          selectedMetadata={selectedMetadata}
          isSearching={isSearching}
          searchMessage={searchMessage}
          onAlbumChange={handleAlbumInputChange}
          onArtistChange={handleArtistChange}
          onSearch={searchAlbum}
          onSelectResult={(result) => {
            setAlbum(result.album);
            setArtist(result.artist);
            setSelectedMetadata(result);
            setSearchResults([]);
            setSearchMessage(`Selected ${result.album}.`);
          }}
          onAdd={() => addRecord(true)}
          onFound={markFound}
          onViewRecord={(record: RecordItem) => openRecordDetail(record, "Wishlist")}
          back={() => setScreen("Home")}
          isWishlist={true}
        />
      )}

      {screen === "StoreDetail" && detailStore && (
        <StoreDetailScreen
          detailStore={detailStore}
          storeCheckIns={storeCheckIns}
          openDirections={openDirections}
          checkIn={checkIn}
          onBack={() => {
            setDetailStore(null);
            setScreen("Stores");
          }}
        />
      )}

      {screen === "AlbumDetail" && selectedRecord && (
        <AlbumDetailScreen
          selectedRecord={selectedRecord}
          isEditingRecord={isEditingRecord}
          recordDraft={recordDraft}
          updateRecordDraft={updateRecordDraft}
          saveRecordDetail={saveRecordDetail}
          deleteRecordDetail={deleteRecordDetail}
          setIsEditingRecord={setIsEditingRecord}
          closeRecordDetail={closeRecordDetail}
        />
      )}

      {screen === "Profile" && (
        <ProfileScreen
          records={records}
          wishlist={wishlist}
          unlockedBadgeCount={unlockedBadgeCount}
          achievementCategories={achievementCategories}
          activity={activity}
          storeCheckIns={storeCheckIns}
          onBack={() => setScreen("Home")}
        />
      )}

      {screen === "Stores" && !detailStore && (
        <ScrollView contentContainerStyle={styles.page}>
          <TopBar title="Find Stores" back={() => setScreen("Home")} />
          <Text style={styles.screenSubtitle}>Local record stores around Needham</Text>
          {recordStores.length === 0 ? (
            <View style={styles.emptyFeatureCard}>
              <Text style={styles.emptyFeatureTitle}>No stores found</Text>
              <Text style={styles.emptyFeatureText}>Try adjusting your location</Text>
            </View>
          ) : (
            recordStores.map((store) => (
              <View key={store.id} style={styles.storeCard}>
                <View style={styles.storeHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.storeName}>{store.name}</Text>
                    <Text style={styles.storeNeighborhood}>{store.neighborhood}</Text>
                  </View>
                  <Text style={styles.storeDistance}>{store.distance}</Text>
                </View>
                <Text style={styles.storeAddress}>{store.address}</Text>
                <View style={styles.storeMetaRow}>
                  <Text style={styles.storeMetaText}>{store.hours}</Text>
                  <Text style={styles.storeMetaText}>{store.rating}</Text>
                  <Text style={styles.storeMetaText}>{`Visits ${storeCheckIns[store.id] ?? 0}`}</Text>
                </View>
                <View style={styles.storeButtonsRow}>
                  <Pressable style={styles.storeButton} onPress={() => openDirections(store.address)}>
                    <Text style={styles.storeButtonText}>Directions</Text>
                  </Pressable>
                  <Pressable style={[styles.storeButton, styles.viewStoreButton]} onPress={() => {
                    setDetailStore(store);
                    setScreen("StoreDetail");
                  }}>
                    <Text style={styles.storeButtonText}>View Store</Text>
                  </Pressable>
                  <Pressable style={[styles.storeButton, styles.checkInButton]} onPress={() => checkIn(store)}>
                    <Text style={[styles.storeButtonText, styles.checkInButtonText]}>Check In</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <View style={styles.nav}>
        <NavItem label="Home" active={screen === "Home"} onPress={() => setScreen("Home")} />
        <NavItem label="Library" active={screen === "Collection"} onPress={() => setScreen("Collection")} />
        <NavItem label="Stores" active={screen === "Stores" || screen === "StoreDetail"} onPress={() => {
          setDetailStore(null);
          setScreen("Stores");
        }} />
        <NavItem label="Wishlist" active={screen === "Wishlist"} onPress={() => setScreen("Wishlist")} />
        <NavItem label="Profile" active={screen === "Profile"} onPress={() => setScreen("Profile")} />
      </View>

      <ConfirmPurchaseDetailsModal
        visible={showPurchaseModal}
        record={recordBeingPromoted}
        purchasedAtDetail={purchasedAtDetail}
        setPurchasedAtDetail={setPurchasedAtDetail}
        purchasePrice={purchasePrice}
        setPurchasePrice={setPurchasePrice}
        purchaseDate={purchaseDate}
        setPurchaseDate={setPurchaseDate}
        purchaseCondition={purchaseCondition}
        setPurchaseCondition={setPurchaseCondition}
        onConfirm={completePurchaseAndMoveToCollection}
        onCancel={() => {
          setShowPurchaseModal(false);
          setRecordBeingPromoted(null);
          setPurchasedAtDetail("");
          setPurchasePrice("");
          setPurchaseDate("");
          setPurchaseCondition("Good");
        }}
      />

      {successMessage !== "" && (
        <View style={styles.successMessageContainer}>
          <Text style={styles.successMessageText}>{successMessage}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#050509",
  },
  page: {
    padding: 28,
    paddingBottom: 140,
  },
  logo: {
    color: "#FFF4D6",
    fontSize: 48,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 16,
    letterSpacing: -1.4,
  },
  tagline: {
    color: "#C4BEE0",
    fontSize: 17,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 32,
    lineHeight: 25,
    fontWeight: "500",
  },
  hero: {
    backgroundColor: "#120f22",
    borderRadius: 30,
    padding: 34,
    marginBottom: 36,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.22)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 14,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: -24,
    right: -24,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(124, 58, 237, 0.14)",
  },
  heroKicker: {
    color: "#d5b9ff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.6,
    marginBottom: 14,
  },
  heroTitle: {
    color: "#fff4d6",
    fontSize: 35,
    fontWeight: "900",
    lineHeight: 44,
    marginBottom: 16,
  },
  heroText: {
    color: "#d6c2a1",
    fontSize: 16,
    lineHeight: 27,
    maxWidth: "96%",
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 36,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(20, 18, 40, 0.98)",
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.22)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 10,
  },
  statValue: {
    color: "#F59E0B",
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 40,
  },
  statLabel: {
    color: "#C7C7D1",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10,
    letterSpacing: 0.3,
  },
  sectionTitle: {
    color: "#FFF4D6",
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 22,
    marginTop: 20,
    letterSpacing: 0.2,
  },
  homeCard: {
    backgroundColor: "rgba(24, 23, 46, 0.96)",
    borderRadius: 28,
    padding: 26,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.28)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  homeCardTitle: {
    color: "#fff4d6",
    fontSize: 18,
    fontWeight: "900",
    maxWidth: "80%",
  },
  homeCardSubtitle: {
    color: "#c8b6d5",
    fontSize: 13,
    marginTop: 6,
    maxWidth: "80%",
    lineHeight: 18,
  },
  homeArrow: {
    color: "#d6c0ff",
    fontSize: 28,
    fontWeight: "300",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 18,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#171523",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2b2b44",
  },
  iconText: {
    color: "#FFF4D6",
    fontSize: 28,
    fontWeight: "700",
  },
  topTitle: {
    color: "#FFF4D6",
    fontSize: 32,
    fontWeight: "900",
  },
  screenSubtitle: {
    color: "#C4BEE0",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 22,
    lineHeight: 23,
  },
  addPanel: {
    backgroundColor: "rgba(20, 18, 38, 0.96)",
    borderRadius: 28,
    padding: 26,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.20)",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 10,
  },
  input: {
    backgroundColor: "rgba(30, 26, 50, 0.98)",
    color: "#f3e7ce",
    borderRadius: 26,
    padding: 17,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(104, 79, 191, 0.26)",
    fontWeight: "500",
  },
  searchRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  albumInput: {
    flex: 1,
  },
  searchButton: {
    backgroundColor: "#8f63ff",
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 17,
    minWidth: 120,
    borderWidth: 1,
    borderColor: "#6d4ad8",
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonText: {
    color: "#fff4d6",
    fontWeight: "800",
    fontSize: 15,
  },
  addButton: {
    backgroundColor: "#8f63ff",
    borderRadius: 26,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#6d4ad8",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  searchStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    marginBottom: 6,
  },
  searchStatusText: {
    color: "#C7C7D1",
    fontSize: 13,
    fontWeight: "500",
  },
  searchMessage: {
    color: "#A7A7B3",
    fontSize: 13,
    marginBottom: 12,
    fontWeight: "500",
  },
  selectedCard: {
    backgroundColor: "rgba(24, 22, 45, 0.96)",
    borderRadius: 26,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.24)",
  },
  selectedLabel: {
    color: "#A78BFA",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.0,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  selectedTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  selectedArtist: {
    color: "#C7C7D1",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "500",
  },
  resultsList: {
    gap: 12,
    marginBottom: 12,
  },
  resultCard: {
    backgroundColor: "rgba(23, 23, 40, 0.97)",
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.22)",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
  resultCover: {
    width: 68,
    height: 68,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: "#272738",
  },
  resultTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    maxWidth: "82%",
  },
  resultArtist: {
    color: "#C7C7D1",
    fontSize: 13,
    marginTop: 4,
    maxWidth: "82%",
  },
  recordCard: {
    backgroundColor: "rgba(22, 22, 34, 0.98)",
    borderRadius: 28,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.20)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  cardInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 20,
  },
  cover: {
    width: 150,
    height: 150,
    borderRadius: 26,
    backgroundColor: "#312f50",
    flexShrink: 0,
  },
  albumTitle: {
    color: "#fff4d6",
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 27,
    maxWidth: "85%",
    letterSpacing: 0.2,
  },
  purchaseText: {
    color: "#b8af9e",
    fontSize: 12,
    marginTop: 10,
    maxWidth: "85%",
    fontWeight: "500",
  },
  artistName: {
    color: "#c5b094",
    fontSize: 14,
    marginTop: 7,
    maxWidth: "85%",
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginTop: 14,
    marginBottom: 4,
  },
  genrePill: {
    color: "#FFFFFF",
    backgroundColor: "#7C3AED",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 11,
    fontWeight: "800",
  },
  yearText: {
    color: "#c8bda7",
    fontSize: 12,
    fontWeight: "600",
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
  },
  foundButton: {
    backgroundColor: "#f4b747",
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 15,
    minWidth: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  foundText: {
    color: "#050509",
    fontWeight: "900",
    fontSize: 13,
  },
  removeButton: {
    backgroundColor: "#2f2a44",
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "#463c7f",
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: {
    color: "#d3c6a7",
    fontWeight: "700",
    fontSize: 13,
  },
  profileCard: {
    backgroundColor: "#11111A",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "#272738",
    flexDirection: "row",
    gap: 18,
    alignItems: "flex-start",
    marginBottom: 22,
  },
  storeCard: {
    backgroundColor: "rgba(18, 16, 38, 0.98)",
    borderRadius: 26,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.20)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 10,
  },
  storeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  storeName: {
    color: "#fff4d6",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  storeNeighborhood: {
    color: "#c8b294",
    fontSize: 13,
    marginTop: 3,
    fontWeight: "500",
  },
  storeDistance: {
    color: "#c8b294",
    fontSize: 13,
    fontWeight: "700",
  },
  storeAddress: {
    color: "#d3c9b1",
    fontSize: 13,
    marginBottom: 12,
    fontWeight: "500",
  },
  storeMetaRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  storeMetaText: {
    color: "#c8bda7",
    fontSize: 13,
  },
  storeDescription: {
    color: "#d3c9b1",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  storeDetailCard: {
    backgroundColor: "rgba(18, 16, 38, 0.96)",
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 7,
  },
  storeDetailName: {
    color: "#fff4d6",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 10,
  },
  storeButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  storeButton: {
    flex: 1,
    backgroundColor: "#26204a",
    borderRadius: 28,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3d3378",
  },
  viewStoreButton: {
    backgroundColor: "#2f2558",
    borderColor: "#4f3ea8",
  },
  checkInButton: {
    backgroundColor: "#7c3aed",
    borderColor: "#5f32d4",
  },
  storeButtonText: {
    color: "#fff4d6",
    fontWeight: "800",
    fontSize: 13,
  },
  checkInButtonText: {
    color: "#ffffff",
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
  },
  profileName: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 4,
  },
  profileSub: {
    color: "#C7C7D1",
    fontSize: 14,
    marginBottom: 4,
    fontWeight: "500",
  },
  profileBio: {
    color: "#a7a1bd",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 18,
    maxWidth: "92%",
  },
  badgeGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  achievementCategory: {
    marginBottom: 22,
  },
  achievementCategoryTitle: {
    color: "#d6c2a1",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  achievementGrid: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  badgeCard: {
    flexBasis: "48%",
    minWidth: "48%",
    backgroundColor: "#11111A",
    borderRadius: 22,
    padding: 16,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#272738",
    marginBottom: 12,
  },
  badgeCardUnlocked: {
    borderColor: "#A78BFA",
    backgroundColor: "rgba(124, 58, 237, 0.14)",
  },
  badgeCardLocked: {
    backgroundColor: "#09090F",
  },
  badgeEmoji: {
    fontSize: 28,
  },
  badgeEmojiUnlocked: {
    opacity: 1,
  },
  badgeEmojiLocked: {
    opacity: 0.45,
  },
  badgeLabel: {
    color: "#C7C7D1",
    fontSize: 13,
    textAlign: "left",
    marginTop: 10,
    fontWeight: "900",
  },
  badgeLabelUnlocked: {
    color: "#F8F4FF",
  },
  badgeLabelLocked: {
    color: "#8F8A9D",
  },
  badgeRequirement: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  badgeRequirementUnlocked: {
    color: "#C7C7D1",
  },
  badgeRequirementLocked: {
    color: "#7A7587",
  },
  badgeProgress: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "900",
  },
  badgeProgressUnlocked: {
    color: "#F3E8FF",
  },
  badgeProgressLocked: {
    color: "#8F8A9D",
  },
  badgeStatus: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  badgeStatusUnlocked: {
    color: "#A78BFA",
  },
  badgeStatusLocked: {
    color: "#57516C",
  },
  analyticsCard: {
    backgroundColor: "rgba(18, 16, 38, 0.96)",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.20)",
    flex: 1,
    minWidth: "48%",
    minHeight: 140,
  },
  analyticsCardIcon: {
    fontSize: 26,
    marginBottom: 10,
  },
  analyticsCardValue: {
    color: "#fff4d6",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 6,
    textAlign: "center",
    maxWidth: "100%",
    flex: 1,
  },
  analyticsCardLabel: {
    color: "#a7a1bd",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 12,
    fontWeight: "600",
    marginTop: 4,
    maxWidth: "100%",
  },
  analyticsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  analyticsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 20,
  },
  analyticsSectionIcon: {
    fontSize: 19,
    marginRight: 8,
  },
  analyticsSectionTitle: {
    color: "#d6c2a1",
    fontSize: 14,
    fontWeight: "800",
  },
  activityCard: {
    backgroundColor: "#11111A",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#272738",
  },
  activityText: {
    color: "#C7C7D1",
    fontSize: 14,
    lineHeight: 20,
  },
  emptyFeatureCard: {
    backgroundColor: "#15151E",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "#2F2F42",
  },
  emptyFeatureTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },
  emptyFeatureText: {
    color: "#A7A7B3",
    fontSize: 16,
    lineHeight: 24,
  },
  detailCard: {
    backgroundColor: "rgba(18, 16, 38, 0.96)",
    borderRadius: 30,
    padding: 26,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 7,
  },
  detailCover: {
    width: "100%",
    height: 280,
    borderRadius: 30,
    marginBottom: 20,
    backgroundColor: "#272738",
  },
  detailTitle: {
    color: "#fff4d6",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 8,
    maxWidth: "98%",
  },
  detailArtist: {
    color: "#c8b294",
    fontSize: 15,
    marginBottom: 20,
    maxWidth: "98%",
  },
  detailInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  detailInfoLabel: {
    color: "#a7a1bd",
    fontSize: 12,
    fontWeight: "700",
  },
  detailInfoValue: {
    color: "#f3e7ce",
    fontSize: 13,
    maxWidth: "55%",
    textAlign: "right",
  },
  notesSection: {
    marginTop: 22,
  },
  notesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  notesTitle: {
    color: "#fff4d6",
    fontSize: 15,
    fontWeight: "900",
  },
  editButton: {
    backgroundColor: "rgba(124, 58, 237, 0.16)",
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "#845ef7",
    alignItems: "center",
  },
  editButtonText: {
    color: "#d4c0ff",
    fontWeight: "700",
    fontSize: 13,
  },
  notesInput: {
    backgroundColor: "rgba(29, 26, 47, 0.96)",
    color: "#f3e7ce",
    borderRadius: 20,
    padding: 16,
    minHeight: 110,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.22)",
  },
  notesText: {
    color: "#d6c2a1",
    fontSize: 14,
    lineHeight: 24,
    fontWeight: "400",
  },
  journalCard: {
    backgroundColor: "rgba(24, 22, 45, 0.96)",
    borderRadius: 24,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.22)",
  },
  journalHeader: {
    color: "#fff4d6",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 20,
  },
  journalField: {
    marginBottom: 20,
  },
  journalLabel: {
    color: "#8a8498",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  journalInput: {
    backgroundColor: "rgba(29, 26, 47, 0.96)",
    color: "#f3e7ce",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.24)",
  },
  journalValue: {
    color: "#f3e7ce",
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "500",
  },
  columnRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 18,
  },
  journalHalfField: {
    flex: 1,
  },
  ratingRow: {
    marginTop: 16,
  },
  starsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  starButton: {
    padding: 6,
  },
  starText: {
    fontSize: 22,
  },
  starActive: {
    color: "#FBBF24",
  },
  starInactive: {
    color: "#6B7280",
  },
  detailFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 22,
  },
  journalStoryInput: {
    minHeight: 150,
    textAlignVertical: "top",
    borderRadius: 24,
    padding: 18,
    color: "#f3e7ce",
    backgroundColor: "rgba(29, 26, 47, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.24)",
  },
  journalStoryText: {
    color: "#f0e5d8",
    fontSize: 15,
    lineHeight: 26,
    fontWeight: "400",
  },
  saveButton: {
    backgroundColor: "#7c3aed",
    borderRadius: 26,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#5b21b6",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  detailActionRow: {
    marginTop: 16,
    alignItems: "center",
  },
  deleteButton: {
    backgroundColor: "#2f2a44",
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "#463c7f",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: "#d3c6a7",
    fontWeight: "700",
    fontSize: 14,
  },
  nav: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    height: 84,
    backgroundColor: "rgba(25, 19, 46, 0.98)",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.22)",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.30,
    shadowRadius: 24,
    elevation: 18,
    paddingHorizontal: 10,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    minWidth: 60,
  },
  navDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "transparent",
  },
  navDotActive: {
    backgroundColor: "#F59E0B",
  },
  navText: {
    color: "#9a93a8",
    fontSize: 13,
    fontWeight: "800",
  },
  navTextActive: {
    color: "#fff4d7",
  },
  navItemActive: {
    backgroundColor: "rgba(124, 58, 237, 0.2)",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "rgba(18, 16, 38, 0.98)",
    borderRadius: 24,
    padding: 24,
    width: "88%",
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.24)",
  },
  modalTitle: {
    color: "#fff4d6",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },
  modalSubtitle: {
    color: "#a7a1bd",
    fontSize: 14,
    marginBottom: 20,
  },
  formSection: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: "#C7C7D1",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  conditionPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  conditionButton: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.20)",
    backgroundColor: "rgba(124, 58, 237, 0.08)",
    alignItems: "center",
  },
  conditionButtonActive: {
    backgroundColor: "rgba(124, 58, 237, 0.40)",
    borderColor: "rgba(124, 58, 237, 0.60)",
  },
  conditionButtonText: {
    color: "#a7a1bd",
    fontSize: 12,
    fontWeight: "600",
  },
  conditionButtonTextActive: {
    color: "#fff4d6",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonPrimary: {
    backgroundColor: "rgba(124, 58, 237, 0.80)",
  },
  modalButtonSecondary: {
    backgroundColor: "rgba(124, 58, 237, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.30)",
  },
  modalButtonTextPrimary: {
    color: "#fff4d6",
    fontSize: 14,
    fontWeight: "800",
  },
  modalButtonTextSecondary: {
    color: "#a7a1bd",
    fontSize: 14,
    fontWeight: "800",
  },
  successMessageContainer: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "rgba(124, 58, 237, 0.95)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  successMessageText: {
    color: "#fff4d6",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  cloudLoadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  cloudLoadingText: {
    color: "#C4BEE0",
    fontSize: 16,
    fontWeight: "600",
  },
});
