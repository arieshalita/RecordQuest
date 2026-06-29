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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type RecordItem = {
  id: number;
  album: string;
  artist: string;
  cover: string;
};

export default function HomeScreen() {
  const [screen, setScreen] = useState("Home");
  const [album, setAlbum] = useState("");
  const [artist, setArtist] = useState("");
  const [wishAlbum, setWishAlbum] = useState("");
  const [wishArtist, setWishArtist] = useState("");
  const [recentActivity, setRecentActivity] = useState<string[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [wishlist, setWishlist] = useState<RecordItem[]>([]);

  const placeholderCover =
    "https://upload.wikimedia.org/wikipedia/commons/3/3c/No-album-art.png";

  useEffect(() => {
    async function loadSavedData() {
      try {
        const [savedRecords, savedWishlist, savedActivity] = await Promise.all([
          AsyncStorage.getItem("recordquest.records"),
          AsyncStorage.getItem("recordquest.wishlist"),
          AsyncStorage.getItem("recordquest.recentActivity"),
        ]);

        if (savedRecords) {
          setRecords(JSON.parse(savedRecords));
        }

        if (savedWishlist) {
          setWishlist(JSON.parse(savedWishlist));
        }

        if (savedActivity) {
          setRecentActivity(JSON.parse(savedActivity));
        }
      } catch (error) {
        console.warn("Failed to load saved data", error);
      }
    }

    loadSavedData();
  }, []);

  useEffect(() => {
    async function saveData() {
      try {
        await Promise.all([
          AsyncStorage.setItem("recordquest.records", JSON.stringify(records)),
          AsyncStorage.setItem("recordquest.wishlist", JSON.stringify(wishlist)),
          AsyncStorage.setItem("recordquest.recentActivity", JSON.stringify(recentActivity)),
        ]);
      } catch (error) {
        console.warn("Failed to save data", error);
      }
    }

    saveData();
  }, [records, wishlist, recentActivity]);

  function addRecord() {
    if (!album.trim() || !artist.trim()) return;

    const newRecord = {
      id: Date.now(),
      album: album.trim(),
      artist: artist.trim(),
      cover: placeholderCover,
    };

    setRecords((current) => [newRecord, ...current]);
    setRecentActivity((current) => [`Added ${newRecord.album} by ${newRecord.artist} to collection`, ...current]);
    setAlbum("");
    setArtist("");
  }

  function addWishlistItem() {
    if (!wishAlbum.trim() || !wishArtist.trim()) return;

    const newItem = {
      id: Date.now(),
      album: wishAlbum.trim(),
      artist: wishArtist.trim(),
      cover: placeholderCover,
    };

    setWishlist((current) => [newItem, ...current]);
    setRecentActivity((current) => [`Added ${newItem.album} by ${newItem.artist} to wishlist`, ...current]);
    setWishAlbum("");
    setWishArtist("");
  }

  function markFound(item: RecordItem) {
    setRecords((current) => [item, ...current]);
    setWishlist((current) => current.filter((w) => w.id !== item.id));
    setRecentActivity((current) => [`Found ${item.album} by ${item.artist}`, ...current]);
  }

  function deleteRecord(id: number) {
    setRecords((current) => current.filter((record) => record.id !== id));
    setRecentActivity((current) => [`Removed a record from collection`, ...current]);
  }

  function deleteWishlistItem(id: number) {
    setWishlist((current) => current.filter((item) => item.id !== id));
    setRecentActivity((current) => [`Removed an item from wishlist`, ...current]);
  }

  if (screen === "My Collection") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.pageHeader}>
            <Text style={styles.eyebrow}>Collection</Text>
            <Text style={styles.title}>My Collection</Text>
            <Text style={styles.subtitle}>Keep track of every record you’ve added.</Text>
          </View>

          <View style={styles.panel}>
            <TextInput style={styles.input} placeholder="Album name" placeholderTextColor="#8c7a63" value={album} onChangeText={setAlbum} />
            <TextInput style={styles.input} placeholder="Artist" placeholderTextColor="#8c7a63" value={artist} onChangeText={setArtist} />

            <Pressable style={styles.button} onPress={addRecord}>
              <Text style={styles.buttonText}>Add Record</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Your crate</Text>
          {records.map((record) => (
            <View key={record.id} style={styles.recordCard}>
              <Image source={{ uri: record.cover }} style={styles.cover} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recordAlbum}>{record.album}</Text>
                <Text style={styles.recordArtist}>{record.artist}</Text>
              </View>
              <Pressable style={styles.deleteButton} onPress={() => deleteRecord(record.id)}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </View>
          ))}

          <BackButton setScreen={setScreen} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === "Wishlist") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.pageHeader}>
            <Text style={styles.eyebrow}>Wishlist</Text>
            <Text style={styles.title}>Wishlist</Text>
            <Text style={styles.subtitle}>Curate the records you’re still hunting.</Text>
          </View>

          <View style={styles.panel}>
            <TextInput style={styles.input} placeholder="Album name" placeholderTextColor="#8c7a63" value={wishAlbum} onChangeText={setWishAlbum} />
            <TextInput style={styles.input} placeholder="Artist" placeholderTextColor="#8c7a63" value={wishArtist} onChangeText={setWishArtist} />

            <Pressable style={styles.button} onPress={addWishlistItem}>
              <Text style={styles.buttonText}>Add to Wishlist</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>On your radar</Text>
          {wishlist.map((item) => (
            <View key={item.id} style={styles.recordCard}>
              <Image source={{ uri: item.cover }} style={styles.cover} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recordAlbum}>{item.album}</Text>
                <Text style={styles.recordArtist}>{item.artist}</Text>
              </View>
              <View style={styles.cardActions}>
                <Pressable style={styles.smallButton} onPress={() => markFound(item)}>
                  <Text style={styles.smallButtonText}>Found</Text>
                </Pressable>
                <Pressable style={styles.deleteButton} onPress={() => deleteWishlistItem(item.id)}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <BackButton setScreen={setScreen} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === "Profile") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.pageHeader}>
            <Text style={styles.eyebrow}>Profile</Text>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Your crate-digging stats and milestones.</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{records.length}</Text>
              <Text style={styles.statLabel}>Records</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{wishlist.length}</Text>
              <Text style={styles.statLabel}>Wishlist</Text>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Badges</Text>
            <Text style={styles.badge}>🏆 First Record</Text>
            <Text style={styles.badge}>🎯 Wishlist Builder</Text>
            <Text style={styles.badge}>📍 Store Explorer - Coming Soon</Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {recentActivity.length === 0 ? (
              <Text style={styles.emptyText}>No activity yet.</Text>
            ) : (
              recentActivity.slice(0, 5).map((activity, index) => (
                <Text key={index} style={styles.activityItem}>• {activity}</Text>
              ))
            )}
          </View>

          <BackButton setScreen={setScreen} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen !== "Home") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>{screen}</Text>
          <Text style={styles.subtitle}>This screen is coming soon.</Text>
          <BackButton setScreen={setScreen} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>RecordQuest</Text>
          <Text style={styles.title}>Find your next favorite record.</Text>
          <Text style={styles.subtitle}>Collection: {records.length} | Wishlist: {wishlist.length}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Quick access</Text>

          <Pressable style={styles.dashboardButton} onPress={() => setScreen("Find Record Stores")}>
            <View>
              <Text style={styles.dashboardButtonTitle}>Find Record Stores</Text>
              <Text style={styles.dashboardButtonText}>Discover nearby spots and hidden gems.</Text>
            </View>
          </Pressable>

          <Pressable style={styles.dashboardButton} onPress={() => setScreen("My Collection")}>
            <View>
              <Text style={styles.dashboardButtonTitle}>My Collection</Text>
              <Text style={styles.dashboardButtonText}>Add and review the records you own.</Text>
            </View>
          </Pressable>

          <Pressable style={styles.dashboardButton} onPress={() => setScreen("Wishlist")}>
            <View>
              <Text style={styles.dashboardButtonTitle}>Wishlist</Text>
              <Text style={styles.dashboardButtonText}>Track the albums you still want to find.</Text>
            </View>
          </Pressable>

          <Pressable style={styles.dashboardButton} onPress={() => setScreen("Profile")}>
            <View>
              <Text style={styles.dashboardButtonTitle}>Profile</Text>
              <Text style={styles.dashboardButtonText}>See your stats and recent crate activity.</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BackButton({ setScreen }: { setScreen: (screen: string) => void }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={() => setScreen("Home")}>
      <Text style={styles.secondaryButtonText}>Back Home</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0f0b08" },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
    backgroundColor: "#0f0b08",
  },
  pageHeader: { marginBottom: 16 },
  heroCard: {
    backgroundColor: "#17110d",
    borderWidth: 1,
    borderColor: "#3f2a1c",
    borderRadius: 24,
    padding: 22,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  panel: {
    backgroundColor: "#17110d",
    borderWidth: 1,
    borderColor: "#3f2a1c",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  eyebrow: {
    color: "#d28b45",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  title: {
    color: "#f7efe7",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    color: "#b8a996",
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    backgroundColor: "#d28b45",
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginTop: 8,
    alignItems: "center",
  },
  buttonText: { color: "#1c120d", fontSize: 16, fontWeight: "800" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#d28b45",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginTop: 18,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#d28b45", fontSize: 15, fontWeight: "700" },
  input: {
    backgroundColor: "#231911",
    borderWidth: 1,
    borderColor: "#4a3428",
    color: "#f7efe7",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  sectionTitle: {
    color: "#f7efe7",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
    marginTop: 6,
  },
  recordCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#17110d",
    borderWidth: 1,
    borderColor: "#3f2a1c",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  cover: {
    width: 68,
    height: 68,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: "#3c2c21",
  },
  recordAlbum: { color: "#f7efe7", fontSize: 16, fontWeight: "800" },
  recordArtist: { color: "#b8a996", fontSize: 14, marginTop: 4 },
  smallButton: {
    backgroundColor: "#d28b45",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  smallButtonText: { color: "#1c120d", fontWeight: "800" },
  cardActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  deleteButton: {
    backgroundColor: "#3b1f1f",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  deleteButtonText: { color: "#f7c8c8", fontWeight: "700", fontSize: 12 },
  statsRow: { flexDirection: "row", marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: "#231911",
    borderWidth: 1,
    borderColor: "#4a3428",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginRight: 10,
  },
  statNumber: { color: "#f7efe7", fontSize: 30, fontWeight: "900" },
  statLabel: { color: "#b8a996", fontSize: 13, marginTop: 4 },
  badge: {
    backgroundColor: "#231911",
    color: "#f7efe7",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#4a3428",
  },
  emptyText: { color: "#8c7a63", fontSize: 15 },
  activityItem: { color: "#f7efe7", fontSize: 15, marginBottom: 8, lineHeight: 20 },
  dashboardButton: {
    backgroundColor: "#231911",
    borderWidth: 1,
    borderColor: "#4a3428",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  dashboardButtonTitle: { color: "#f7efe7", fontSize: 16, fontWeight: "800", marginBottom: 3 },
  dashboardButtonText: { color: "#b8a996", fontSize: 13, lineHeight: 18 },
});
