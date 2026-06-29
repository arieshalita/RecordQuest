import React, { useEffect, useState } from "react";
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

type StoreItem = {
  id: string;
  name: string;
  neighborhood: string;
  address: string;
  hours: string;
  rating: string;
  distance: string;
  description: string;
};

type AchievementBadge = {
  id: string;
  emoji: string;
  label: string;
  requirement: string;
  current: number;
  target: number;
  unlocked: boolean;
};

type AchievementCategory = {
  title: string;
  badges: AchievementBadge[];
};

function calculateAchievementCategories(
  records: RecordItem[],
  wishlist: RecordItem[],
  storeCheckIns: Record<string, number>,
  activity: string[]
): AchievementCategory[] {
  const totalRecords = records.length;
  const totalWishlist = wishlist.length;
  const totalCheckIns = Object.values(storeCheckIns).reduce((sum, count) => sum + count, 0);
  const wishlistFoundCount = activity.filter((entry) => entry.startsWith("Found ")).length;
  const storyCount = records.filter((record) => !!record.notes?.trim()).length;
  const ratingCount = records.filter((record) => typeof record.rating === "number" && record.rating > 0).length;
  const priceCount = records.filter((record) => !!record.price?.trim()).length;
  const purchasedAtCount = records.filter((record) => !!record.purchasedAt?.trim()).length;

  const buildBadge = (
    id: string,
    emoji: string,
    label: string,
    requirement: string,
    current: number,
    target: number
  ): AchievementBadge => ({
    id,
    emoji,
    label,
    requirement,
    current,
    target,
    unlocked: current >= target,
  });

  return [
    {
      title: "Collection",
      badges: [
        buildBadge("first-record", "💿", "First Record", "Own at least 1 record", totalRecords, 1),
        buildBadge("collector", "🎯", "Collector", "Own at least 10 records", totalRecords, 10),
        buildBadge("archivist", "🗄️", "Archivist", "Own at least 50 records", totalRecords, 50),
        buildBadge("vinyl-vault", "🕳️", "Vinyl Vault", "Own at least 100 records", totalRecords, 100),
      ],
    },
    {
      title: "Wishlist",
      badges: [
        buildBadge("wishful-thinking", "✨", "Wishful Thinking", "Have at least 1 wishlist item", totalWishlist, 1),
        buildBadge("dream-found", "🏆", "Dream Found", "Move at least 1 wishlist item into your collection", wishlistFoundCount, 1),
      ],
    },
    {
      title: "Store Explorer",
      badges: [
        buildBadge("first-check-in", "📍", "First Check In", "Check in at least once", totalCheckIns, 1),
        buildBadge("crate-digger", "🧺", "Crate Digger", "Complete at least 5 store check-ins", totalCheckIns, 5),
        buildBadge("road-trip", "🛣️", "Road Trip", "Complete at least 10 store check-ins", totalCheckIns, 10),
        buildBadge("local-legend", "🌟", "Local Legend", "Complete at least 25 store check-ins", totalCheckIns, 25),
      ],
    },
    {
      title: "Collector Journal",
      badges: [
        buildBadge("storyteller", "📖", "Storyteller", "Add notes to at least 5 records", storyCount, 5),
        buildBadge("critic", "📝", "Critic", "Rate at least 5 records", ratingCount, 5),
        buildBadge("receipt-keeper", "💳", "Receipt Keeper", "Add price info to at least 5 records", priceCount, 5),
        buildBadge("memory-lane", "🗺️", "Memory Lane", "Add purchased-at info to at least 5 records", purchasedAtCount, 5),
      ],
    },
  ];
}

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

export default function HomeScreen() {
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

  const achievementCategories = calculateAchievementCategories(records, wishlist, storeCheckIns, activity);
  const unlockedBadgeCount = achievementCategories
    .flatMap((category) => category.badges)
    .filter((badge) => badge.unlocked).length;

  const placeholderCover =
    "https://upload.wikimedia.org/wikipedia/commons/3/3c/No-album-art.png";

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const initialState = {
        records: starterRecords,
        wishlist: [],
        activity: [
          "Added Random Access Memories",
          "Started your RecordQuest collection",
        ],
        storeCheckIns: {},
      };

      const savedState = await loadRecordQuestState(initialState);

      if (!isMounted) return;

      setRecords(savedState.records);
      setWishlist(savedState.wishlist);
      setActivity(savedState.activity);
      setStoreCheckIns(savedState.storeCheckIns);
      setLoaded(true);
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;

    saveRecordQuestState({ records, wishlist, activity, storeCheckIns });
  }, [records, wishlist, activity, storeCheckIns, loaded]);

  async function addRecord(toWishlist: boolean) {
    if (!album.trim() || !artist.trim()) return;

    const baseItem: RecordItem = {
      id: Date.now(),
      album: album.trim(),
      artist: artist.trim(),
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
    } else {
      setRecords([newItem, ...records]);
      setActivity([`Added ${newItem.album} to collection`, ...activity]);
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

  function handleAlbumChange(value: string) {
    setAlbum(value);
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
    setWishlist(wishlist.filter((w) => w.id !== item.id));
    setRecords([item, ...records]);
    setActivity([`Found ${item.album}`, ...activity]);
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
  }

  function removeRecord(item: RecordItem) {
    setRecords(records.filter((record) => record.id !== item.id));
    setActivity([`Removed ${item.album} from collection`, ...activity]);
  }

  function removeWishlist(item: RecordItem) {
    setWishlist(wishlist.filter((wish) => wish.id !== item.id));
    setActivity([`Removed ${item.album} from wishlist`, ...activity]);
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
  }

  function deleteRecordDetail() {
    if (!selectedRecord || !detailSource) return;

    if (detailSource === "Collection") {
      setRecords((current) => current.filter((record) => record.id !== selectedRecord.id));
      setActivity((currentActivity) => [`Deleted ${selectedRecord.album} from collection`, ...currentActivity]);
    } else {
      setWishlist((current) => current.filter((record) => record.id !== selectedRecord.id));
      setActivity((currentActivity) => [`Deleted ${selectedRecord.album} from wishlist`, ...currentActivity]);
    }

    setSelectedRecord(null);
    setDetailSource(null);
    setIsEditingRecord(false);
    setRecordDraft({});
    setScreen(detailSource === "Collection" ? "Collection" : "Wishlist");
  }

  function closeRecordDetail() {
    setSelectedRecord(null);
    setDetailSource(null);
    setIsEditingRecord(false);
    setRecordDraft({});
    setScreen(detailSource || "Home");
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
          onAlbumChange={handleAlbumChange}
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
          onAlbumChange={handleAlbumChange}
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
          onRemove={removeWishlist}
          onViewRecord={(record: RecordItem) => openRecordDetail(record, "Wishlist")}
          back={() => setScreen("Home")}
          onFound={markFound}
        />
      )}

      {screen === "StoreDetail" && detailStore && (
        <ScrollView contentContainerStyle={styles.page}>
          <TopBar title="Store Details" back={() => {
            setDetailStore(null);
            setScreen("Stores");
          }} />
          <View style={styles.storeDetailCard}>
            <Text style={styles.storeDetailName}>{detailStore.name}</Text>
            <View style={styles.storeMetaRow}>
              <Text style={styles.storeMetaText}>{detailStore.rating}</Text>
              <Text style={styles.storeMetaText}>{detailStore.distance}</Text>
              <Text style={styles.storeMetaText}>{`Visits ${storeCheckIns[detailStore.id] ?? 0}`}</Text>
            </View>
            <Text style={styles.storeAddress}>{detailStore.address}</Text>
            <Text style={styles.storeMetaText}>{detailStore.hours}</Text>
            <Text style={styles.storeDescription}>{detailStore.description}</Text>
            <View style={styles.storeButtonsRow}>
              <Pressable style={styles.storeButton} onPress={() => openDirections(detailStore.address)}>
                <Text style={styles.storeButtonText}>Directions</Text>
              </Pressable>
              <Pressable style={[styles.storeButton, styles.checkInButton]} onPress={() => checkIn(detailStore)}>
                <Text style={[styles.storeButtonText, styles.checkInButtonText]}>Check In</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}

      {screen === "AlbumDetail" && selectedRecord && (
        <ScrollView contentContainerStyle={styles.page}>
          <TopBar title="Collector Journal" back={closeRecordDetail} />
          <View style={styles.detailCard}>
            <Image source={{ uri: selectedRecord.cover }} style={styles.detailCover} />
            <Text style={styles.detailTitle}>{selectedRecord.album}</Text>
            <Text style={styles.detailArtist}>{selectedRecord.artist}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.genrePill}>{selectedRecord.genre}</Text>
              <Text style={styles.yearText}>{selectedRecord.year}</Text>
            </View>
            <View style={styles.journalCard}>
              <Text style={styles.journalHeader}>Collector Details</Text>
              <View style={styles.journalField}>
                <Text style={styles.journalLabel}>Purchased At</Text>
                {isEditingRecord ? (
                  <TextInput
                    style={styles.journalInput}
                    value={recordDraft.purchasedAt ?? ""}
                    onChangeText={(value) => updateRecordDraft("purchasedAt", value)}
                    placeholder="Where did you buy it?"
                    placeholderTextColor="#8b7fe0"
                  />
                ) : (
                  <Text style={styles.journalValue}>{selectedRecord.purchasedAt || "Not recorded"}</Text>
                )}
              </View>
              <View style={styles.columnRow}>
                <View style={styles.journalHalfField}>
                  <Text style={styles.journalLabel}>Purchase Date</Text>
                  {isEditingRecord ? (
                    <TextInput
                      style={styles.journalInput}
                      value={recordDraft.purchaseDate ?? ""}
                      onChangeText={(value) => updateRecordDraft("purchaseDate", value)}
                      placeholder="MM/DD/YYYY"
                      placeholderTextColor="#8b7fe0"
                    />
                  ) : (
                    <Text style={styles.journalValue}>{selectedRecord.purchaseDate || "Unknown"}</Text>
                  )}
                </View>
                <View style={styles.journalHalfField}>
                  <Text style={styles.journalLabel}>Price Paid</Text>
                  {isEditingRecord ? (
                    <TextInput
                      style={styles.journalInput}
                      value={recordDraft.price ?? ""}
                      onChangeText={(value) => updateRecordDraft("price", value)}
                      placeholder="$0.00"
                      placeholderTextColor="#8b7fe0"
                      keyboardType="numeric"
                    />
                  ) : (
                    <Text style={styles.journalValue}>{selectedRecord.price ? `$${selectedRecord.price}` : "Not recorded"}</Text>
                  )}
                </View>
              </View>
              <View style={styles.journalField}>
                <Text style={styles.journalLabel}>Condition</Text>
                {isEditingRecord ? (
                  <TextInput
                    style={styles.journalInput}
                    value={recordDraft.condition ?? ""}
                    onChangeText={(value) => updateRecordDraft("condition", value)}
                    placeholder="Mint, Excellent, Good…"
                    placeholderTextColor="#8b7fe0"
                  />
                ) : (
                  <Text style={styles.journalValue}>{selectedRecord.condition || "Good"}</Text>
                )}
              </View>
              <View style={styles.journalField}>
                <Text style={styles.journalLabel}>Favorite Track</Text>
                {isEditingRecord ? (
                  <TextInput
                    style={styles.journalInput}
                    value={recordDraft.favoriteTrack ?? ""}
                    onChangeText={(value) => updateRecordDraft("favoriteTrack", value)}
                    placeholder="Track name..."
                    placeholderTextColor="#8b7fe0"
                  />
                ) : (
                  <Text style={styles.journalValue}>{selectedRecord.favoriteTrack || "Not noted"}</Text>
                )}
              </View>
              <View style={styles.journalField}>
                <Text style={styles.journalLabel}>Your Story</Text>
                {isEditingRecord ? (
                  <TextInput
                    style={[styles.journalInput, styles.journalStoryInput]}
                    multiline
                    value={recordDraft.notes ?? ""}
                    onChangeText={(value) => updateRecordDraft("notes", value)}
                    placeholder="What makes this pressing special?"
                    placeholderTextColor="#8b7fe0"
                  />
                ) : (
                  <Text style={styles.journalStoryText}>{selectedRecord.notes || "Share the story behind this record."}</Text>
                )}
              </View>
              <View style={styles.ratingRow}>
                <Text style={styles.journalLabel}>Personal Rating</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const selectedRating = recordDraft.rating ?? selectedRecord.rating ?? 0;
                    return (
                      <Pressable
                        key={star}
                        onPress={() => isEditingRecord && updateRecordDraft("rating", star)}
                        style={styles.starButton}
                      >
                        <Text style={[styles.starText, star <= selectedRating ? styles.starActive : styles.starInactive]}>
                          {star <= selectedRating ? "★" : "☆"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
            <View style={styles.detailFooterRow}>
              {isEditingRecord ? (
                <Pressable style={styles.saveButton} onPress={saveRecordDetail}>
                  <Text style={styles.saveButtonText}>Save Story</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.editButton} onPress={() => setIsEditingRecord(true)}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              )}
              <Pressable style={styles.deleteButton} onPress={deleteRecordDetail}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}

      {screen === "Profile" && (
        <ScrollView contentContainerStyle={styles.page}>
          <TopBar title="Profile" back={() => setScreen("Home")} />

          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>A</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>Arie</Text>
              <Text style={styles.profileSub}>Vinyl collector</Text>
              <Text style={styles.profileBio}>Building the ultimate crate-digging log.</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatCard value={records.length} label="Records" />
            <StatCard value={wishlist.length} label="Wishlist" />
            <StatCard value={unlockedBadgeCount} label="Badges" />
          </View>

          <Text style={styles.sectionTitle}>Achievements</Text>
          {achievementCategories.map((category) => (
            <View key={category.title} style={styles.achievementCategory}>
              <Text style={styles.achievementCategoryTitle}>{category.title}</Text>
              <View style={styles.achievementGrid}>
                {category.badges.map((badge) => (
                  <AchievementBadgeCard key={badge.id} badge={badge} />
                ))}
              </View>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {activity.slice(0, 6).map((item, index) => (
            <View key={index} style={styles.activityCard}>
              <Text style={styles.activityText}>• {item}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {screen === "Stores" && !detailStore && (
        <ScrollView contentContainerStyle={styles.page}>
          <TopBar title="Find Stores" back={() => setScreen("Home")} />
          <Text style={styles.screenSubtitle}>Local record stores around Needham</Text>
          {recordStores.map((store) => (
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
          ))}
        </ScrollView>
      )}

      <View style={styles.nav}>
        <NavItem label="Home" active={screen === "Home"} onPress={() => setScreen("Home")} />
        <NavItem label="Collection" active={screen === "Collection"} onPress={() => setScreen("Collection")} />
        <NavItem label="Stores" active={screen === "Stores" || screen === "StoreDetail"} onPress={() => {
          setDetailStore(null);
          setScreen("Stores");
        }} />
        <NavItem label="Wishlist" active={screen === "Wishlist"} onPress={() => setScreen("Wishlist")} />
        <NavItem label="Profile" active={screen === "Profile"} onPress={() => setScreen("Profile")} />
      </View>
    </SafeAreaView>
  );
}

function RecordListScreen({
  title,
  subtitle,
  records,
  album,
  artist,
  purchasedAt,
  setPurchasedAt,
  searchResults,
  selectedMetadata,
  isSearching,
  searchMessage,
  onAlbumChange,
  onArtistChange,
  onSearch,
  onSelectResult,
  onAdd,
  back,
  onFound,
  onRemove,
  onViewRecord,
}: any) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <TopBar title={title} back={back} />
      <Text style={styles.screenSubtitle}>{subtitle}</Text>

      <View style={styles.addPanel}>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.albumInput]}
            placeholder="Album"
            placeholderTextColor="#8B8B96"
            value={album}
            onChangeText={onAlbumChange}
          />
          <Pressable style={styles.searchButton} onPress={onSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Artist"
          placeholderTextColor="#8B8B96"
          value={artist}
          onChangeText={onArtistChange}
        />
        <TextInput
          style={styles.input}
          placeholder="Purchased at (optional)"
          placeholderTextColor="#8B8B96"
          value={purchasedAt}
          onChangeText={setPurchasedAt}
        />
        {isSearching && (
          <View style={styles.searchStatusRow}>
            <ActivityIndicator color="#A78BFA" />
            <Text style={styles.searchStatusText}>Searching MusicBrainz…</Text>
          </View>
        )}
        {searchMessage ? <Text style={styles.searchMessage}>{searchMessage}</Text> : null}
        {selectedMetadata ? (
          <View style={styles.selectedCard}>
            <Text style={styles.selectedLabel}>Selected match</Text>
            <Text style={styles.selectedTitle}>{selectedMetadata.album}</Text>
            <Text style={styles.selectedArtist}>{selectedMetadata.artist}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.genrePill}>{selectedMetadata.genre}</Text>
              <Text style={styles.yearText}>{selectedMetadata.year}</Text>
            </View>
          </View>
        ) : null}
        {searchResults.length > 0 ? (
          <View style={styles.resultsList}>
            {searchResults.map((result: AlbumSearchResult) => (
              <Pressable
                key={result.id}
                style={styles.resultCard}
                onPress={() => onSelectResult(result)}
              >
                <Image source={{ uri: result.cover || "https://upload.wikimedia.org/wikipedia/commons/3/3c/No-album-art.png" }} style={styles.resultCover} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle}>{result.album}</Text>
                  <Text style={styles.resultArtist}>{result.artist}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.genrePill}>{result.genre}</Text>
                    <Text style={styles.yearText}>{result.year}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Pressable style={styles.addButton} onPress={onAdd}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      {records.length === 0 ? (
        <View style={styles.emptyFeatureCard}>
          <Text style={styles.emptyFeatureTitle}>Nothing here yet</Text>
          <Text style={styles.emptyFeatureText}>Add your first record above.</Text>
        </View>
      ) : (
        records.map((record: RecordItem) => (
          <View key={record.id} style={styles.recordCard}>
            <Pressable style={{ flex: 1 }} onPress={() => onViewRecord?.(record)}>
              <View style={styles.cardInfo}>
                <Image source={{ uri: record.cover }} style={styles.cover} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.albumTitle}>{record.album}</Text>
                  <Text style={styles.artistName}>{record.artist}</Text>
                  <Text style={styles.purchaseText}>{record.purchasedAt || "Purchased at unknown"}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.genrePill}>{record.genre}</Text>
                    <Text style={styles.yearText}>{record.year}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
            <View style={styles.cardActions}>
              {onFound && (
                <Pressable style={styles.foundButton} onPress={() => onFound(record)}>
                  <Text style={styles.foundText}>Found</Text>
                </Pressable>
              )}
              {onRemove ? (
                <Pressable style={styles.removeButton} onPress={() => onRemove(record)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function TopBar({ title, back }: { title: string; back: () => void }) {
  return (
    <View style={styles.topBar}>
      <Pressable style={styles.iconCircle} onPress={back}>
        <Text style={styles.iconText}>‹</Text>
      </Pressable>
      <Text style={styles.topTitle}>{title}</Text>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>♪</Text>
      </View>
    </View>
  );
}

function HomeCard({ title, subtitle, onPress }: any) {
  return (
    <Pressable style={styles.homeCard} onPress={onPress}>
      <View>
        <Text style={styles.homeCardTitle}>{title}</Text>
        <Text style={styles.homeCardSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.homeArrow}>›</Text>
    </Pressable>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Badge({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View style={styles.badgeCard}>
      <Text style={styles.badgeEmoji}>{emoji}</Text>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

function AchievementBadgeCard({ badge }: { badge: AchievementBadge }) {
  return (
    <View style={[styles.badgeCard, badge.unlocked ? styles.badgeCardUnlocked : styles.badgeCardLocked]}>
      <Text style={[styles.badgeEmoji, badge.unlocked ? styles.badgeEmojiUnlocked : styles.badgeEmojiLocked]}>{badge.emoji}</Text>
      <Text style={[styles.badgeLabel, badge.unlocked ? styles.badgeLabelUnlocked : styles.badgeLabelLocked]}>{badge.label}</Text>
      <Text style={[styles.badgeRequirement, badge.unlocked ? styles.badgeRequirementUnlocked : styles.badgeRequirementLocked]}>{badge.requirement}</Text>
      <Text style={[styles.badgeProgress, badge.unlocked ? styles.badgeProgressUnlocked : styles.badgeProgressLocked]}>
        {`${Math.min(badge.current, badge.target)} / ${badge.target}`}
      </Text>
      <Text style={[styles.badgeStatus, badge.unlocked ? styles.badgeStatusUnlocked : styles.badgeStatusLocked]}>
        {badge.unlocked ? "Unlocked" : "Locked"}
      </Text>
    </View>
  );
}

function NavItem({ label, active, onPress }: any) {
  return (
    <Pressable style={[styles.navItem, active && styles.navItemActive]} onPress={onPress}>
      <View style={[styles.navDot, active && styles.navDotActive]} />
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#050509",
  },
  page: {
    padding: 26,
    paddingBottom: 120,
  },
  logo: {
    color: "#FFF4D6",
    fontSize: 46,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 14,
    letterSpacing: -1.2,
  },
  tagline: {
    color: "#C4BEE0",
    fontSize: 17,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 28,
    lineHeight: 24,
  },
  hero: {
    backgroundColor: "#120f22",
    borderRadius: 28,
    padding: 32,
    marginBottom: 26,
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
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  heroTitle: {
    color: "#fff4d6",
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 42,
    marginBottom: 14,
  },
  heroText: {
    color: "#d6c2a1",
    fontSize: 17,
    lineHeight: 28,
    maxWidth: "94%",
  },
  statsRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(20, 18, 40, 0.98)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.22)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 10,
  },
  statValue: {
    color: "#F59E0B",
    fontSize: 32,
    fontWeight: "900",
  },
  statLabel: {
    color: "#C7C7D1",
    fontSize: 13,
    marginTop: 5,
  },
  sectionTitle: {
    color: "#FFF4D6",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
    marginTop: 10,
  },
  homeCard: {
    backgroundColor: "rgba(24, 23, 46, 0.96)",
    borderRadius: 24,
    padding: 24,
    marginBottom: 18,
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
    fontSize: 20,
    fontWeight: "900",
  },
  homeCardSubtitle: {
    color: "#c7b8ea",
    fontSize: 13,
    marginTop: 6,
    maxWidth: "78%",
  },
  homeArrow: {
    color: "#dfc0ff",
    fontSize: 38,
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
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 18,
  },
  addPanel: {
    backgroundColor: "rgba(20, 18, 38, 0.96)",
    borderRadius: 26,
    padding: 24,
    marginBottom: 24,
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
    borderRadius: 22,
    padding: 18,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(104, 79, 191, 0.26)",
  },
  searchRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  albumInput: {
    flex: 1,
  },
  searchButton: {
    backgroundColor: "#8f63ff",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    minWidth: 110,
    borderWidth: 1,
    borderColor: "#6d4ad8",
  },
  searchButtonText: {
    color: "#fff4d6",
    fontWeight: "800",
    fontSize: 15,
  },
  addButton: {
    backgroundColor: "#8f63ff",
    borderRadius: 26,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#6d4ad8",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  searchStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  searchStatusText: {
    color: "#C7C7D1",
    fontSize: 13,
  },
  searchMessage: {
    color: "#A7A7B3",
    fontSize: 13,
    marginBottom: 10,
  },
  selectedCard: {
    backgroundColor: "rgba(24, 22, 45, 0.96)",
    borderRadius: 24,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.24)",
  },
  selectedLabel: {
    color: "#C3B0FF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  selectedTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  selectedArtist: {
    color: "#C7C7D1",
    fontSize: 14,
    marginTop: 4,
  },
  resultsList: {
    gap: 10,
    marginBottom: 10,
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
  },
  resultArtist: {
    color: "#C7C7D1",
    fontSize: 13,
    marginTop: 3,
  },
  recordCard: {
    backgroundColor: "rgba(22, 22, 34, 0.98)",
    borderRadius: 24,
    padding: 20,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.20)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  cardInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  cover: {
    width: 150,
    height: 150,
    borderRadius: 24,
    marginRight: 18,
    backgroundColor: "#312f50",
  },
  albumTitle: {
    color: "#fff4d6",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 28,
  },
  artistName: {
    color: "#c5b094",
    fontSize: 14,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 12,
  },
  genrePill: {
    color: "#FFFFFF",
    backgroundColor: "#7C3AED",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "800",
  },
  yearText: {
    color: "#c8bda7",
    fontSize: 13,
  },
  cardActions: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    height: 100,
  },
  foundButton: {
    backgroundColor: "#f4b747",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  foundText: {
    color: "#050509",
    fontWeight: "900",
    fontSize: 12,
  },
  removeButton: {
    backgroundColor: "#2f2a44",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#463c7f",
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: {
    color: "#d3c6a7",
    fontWeight: "700",
    fontSize: 12,
  },
  profileCard: {
    backgroundColor: "#11111A",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "#272738",
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    marginBottom: 18,
  },
  storeCard: {
    backgroundColor: "rgba(18, 16, 38, 0.98)",
    borderRadius: 24,
    padding: 22,
    marginBottom: 18,
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
    marginBottom: 10,
  },
  storeName: {
    color: "#fff4d6",
    fontSize: 18,
    fontWeight: "900",
  },
  storeNeighborhood: {
    color: "#c8b294",
    fontSize: 13,
    marginTop: 2,
  },
  storeDistance: {
    color: "#c8b294",
    fontSize: 13,
    fontWeight: "700",
  },
  storeAddress: {
    color: "#d3c9b1",
    fontSize: 13,
    marginBottom: 10,
  },
  storeMetaRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
  },
  profileName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  profileSub: {
    color: "#C7C7D1",
    fontSize: 15,
    marginTop: 3,
  },
  profileBio: {
    color: "#A7A7B3",
    fontSize: 13,
    marginTop: 4,
  },
  badgeGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  achievementCategory: {
    marginBottom: 18,
  },
  achievementCategoryTitle: {
    color: "#d6c2a1",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
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
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  badgeRequirementUnlocked: {
    color: "#C7C7D1",
  },
  badgeRequirementLocked: {
    color: "#7A7587",
  },
  badgeProgress: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "900",
  },
  badgeProgressUnlocked: {
    color: "#F3E8FF",
  },
  badgeProgressLocked: {
    color: "#8F8A9D",
  },
  badgeStatus: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  badgeStatusUnlocked: {
    color: "#A78BFA",
  },
  badgeStatusLocked: {
    color: "#57516C",
  },
  activityCard: {
    backgroundColor: "#11111A",
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#272738",
  },
  activityText: {
    color: "#C7C7D1",
    fontSize: 15,
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
    padding: 22,
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
    borderRadius: 28,
    marginBottom: 18,
    backgroundColor: "#272738",
  },
  detailTitle: {
    color: "#fff4d6",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 8,
  },
  detailArtist: {
    color: "#c8b294",
    fontSize: 16,
    marginBottom: 16,
  },
  detailInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  detailInfoLabel: {
    color: "#a7a1bd",
    fontSize: 13,
    fontWeight: "700",
  },
  detailInfoValue: {
    color: "#f3e7ce",
    fontSize: 13,
    maxWidth: "55%",
    textAlign: "right",
  },
  notesSection: {
    marginTop: 18,
  },
  notesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  notesTitle: {
    color: "#fff4d6",
    fontSize: 15,
    fontWeight: "900",
  },
  editButton: {
    backgroundColor: "rgba(124, 58, 237, 0.16)",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#845ef7",
  },
  editButtonText: {
    color: "#d4c0ff",
    fontWeight: "700",
    fontSize: 12,
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
    color: "#c8b294",
    fontSize: 14,
    lineHeight: 22,
  },
  journalStoryText: {
    color: "#e7d7ff",
    fontSize: 15,
    lineHeight: 24,
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
  },
  deleteButtonText: {
    color: "#d3c6a7",
    fontWeight: "700",
  },
  nav: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    height: 84,
    backgroundColor: "rgba(25, 19, 46, 0.96)",
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
    paddingHorizontal: 12,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    minWidth: 56,
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
    fontSize: 12,
    fontWeight: "800",
  },
  navTextActive: {
    color: "#fff4d7",
  },
  navItemActive: {
    backgroundColor: "rgba(124, 58, 237, 0.2)",
  },
});
