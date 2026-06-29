import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { StatCard } from "../components/StatCard";
import { HomeCard } from "../components/HomeCard";
import { RecordItem } from "../hooks/types";

interface HomeScreenProps {
  records: RecordItem[];
  wishlistCount: number;
  unlockedBadgeCount: number;
  onNavigate: (screen: string) => void;
}

export function HomeScreen({
  records,
  wishlistCount,
  unlockedBadgeCount,
  onNavigate,
}: HomeScreenProps) {
  return (
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
        <StatCard value={wishlistCount} label="Wishlist" />
        <StatCard value={unlockedBadgeCount} label="Badges" />
      </View>

      <Text style={styles.sectionTitle}>Explore</Text>

      <HomeCard
        title="Find Stores"
        subtitle="Record shops and crate spots"
        onPress={() => onNavigate("Stores")}
      />
      <HomeCard
        title="My Collection"
        subtitle="Albums you own"
        onPress={() => onNavigate("Collection")}
      />
      <HomeCard
        title="Wishlist"
        subtitle="Albums to hunt down"
        onPress={() => onNavigate("Wishlist")}
      />
      <HomeCard
        title="Profile"
        subtitle="Stats and achievements"
        onPress={() => onNavigate("Profile")}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: "#050509",
  },
  logo: {
    color: "#fff4d6",
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: 2,
  },
  tagline: {
    color: "#a7a1bd",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 32,
    fontWeight: "600",
  },
  hero: {
    backgroundColor: "rgba(124, 58, 237, 0.08)",
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 24,
    marginBottom: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.15)",
  },
  heroGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(124, 58, 237, 0.20)",
    top: -100,
    left: -60,
  },
  heroKicker: {
    color: "#d4af37",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  heroTitle: {
    color: "#fff4d6",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 12,
  },
  heroText: {
    color: "#a7a1bd",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  sectionTitle: {
    color: "#d6c2a1",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 16,
  },
});
