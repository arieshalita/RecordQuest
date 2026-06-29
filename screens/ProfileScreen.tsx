import React from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { TopBar } from "../components/TopBar";
import { StatCard } from "../components/StatCard";
import { AnalyticsCard } from "../components/AnalyticsCard";
import { AnalyticsSectionHeader } from "../components/AnalyticsSectionHeader";
import { AchievementBadgeCard } from "../components/AchievementBadgeCard";
import type { RecordItem, AchievementCategory, CollectionAnalytics } from "../hooks/types";
import { calculateCollectionAnalytics } from "../utils/analytics";

type ProfileScreenProps = {
  records: RecordItem[];
  wishlist: RecordItem[];
  unlockedBadgeCount: number;
  achievementCategories: AchievementCategory[];
  activity: string[];
  storeCheckIns: Record<string, number>;
  onBack: () => void;
};

function CollectionAnalyticsDashboard({ analytics }: { analytics: CollectionAnalytics }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Collection Analytics</Text>

      <AnalyticsSectionHeader title="Collection Overview" icon="💿" />
      <View style={styles.analyticsGrid}>
        <AnalyticsCard value={analytics.totalArtists} label="Artists" icon="🎤" />
        <AnalyticsCard value={analytics.totalGenres} label="Genres" icon="🎵" />
        <AnalyticsCard value={analytics.averageYear || "—"} label="Avg Year" icon="📅" />
        <AnalyticsCard
          value={analytics.oldestAlbum?.year || "—"}
          label="Oldest"
          icon="🏛️"
        />
      </View>

      <AnalyticsSectionHeader title="Habits & Metadata" icon="📝" />
      <View style={styles.analyticsGrid}>
        <AnalyticsCard
          value={analytics.mostCollectedArtist?.artist || "—"}
          label={`Top Artist (${analytics.mostCollectedArtist?.count || 0})`}
          icon="⭐"
        />
        <AnalyticsCard
          value={analytics.favoriteGenre?.genre || "—"}
          label={`Favorite (${analytics.favoriteGenre?.count || 0})`}
          icon="🎶"
        />
        <AnalyticsCard value={analytics.albumsWithStory} label="With Stories" icon="📖" />
        <AnalyticsCard value={analytics.albumsWithStore} label="With Stores" icon="🏪" />
      </View>

      <AnalyticsSectionHeader title="Store Explorer" icon="🗺️" />
      <View style={styles.analyticsGrid}>
        <AnalyticsCard value={analytics.storesVisited} label="Stores Visited" icon="📍" />
        <AnalyticsCard value={analytics.totalCheckIns} label="Total Check-ins" icon="✓" />
        <AnalyticsCard
          value={analytics.favoriteStore?.name || "—"}
          label={`Favorite (${analytics.favoriteStore?.count || 0})`}
          icon="💫"
        />
        <AnalyticsCard value={analytics.averageRating} label="Avg Rating" icon="⭐" />
      </View>

      <AnalyticsSectionHeader title="Wishlist Progress" icon="✨" />
      <View style={styles.analyticsGrid}>
        <AnalyticsCard value={analytics.wishlistCount} label="Wishlist Items" icon="💜" />
        <AnalyticsCard
          value={`${analytics.wishlistCompletionPercent}%`}
          label="Completion"
          icon="🎯"
        />
      </View>
    </View>
  );
}

export function ProfileScreen({
  records,
  wishlist,
  unlockedBadgeCount,
  achievementCategories,
  activity,
  storeCheckIns,
  onBack,
}: ProfileScreenProps) {
  const analytics = calculateCollectionAnalytics(records, wishlist, storeCheckIns, activity);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <TopBar title="Profile" back={onBack} />

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

      <CollectionAnalyticsDashboard analytics={analytics} />

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
      {activity.length === 0 ? (
        <View style={styles.emptyFeatureCard}>
          <Text style={styles.emptyFeatureTitle}>No activity yet</Text>
          <Text style={styles.emptyFeatureText}>Start building your collection</Text>
        </View>
      ) : (
        activity.slice(0, 6).map((item, index) => (
          <View key={index} style={styles.activityCard}>
            <Text style={styles.activityText}>• {item}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 26,
    paddingBottom: 130,
  },
  profileCard: {
    backgroundColor: "#1A1830",
    borderWidth: 1,
    borderColor: "#3E3B5C",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#7C3AED",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFF4D6",
    fontSize: 24,
    fontWeight: "700",
  },
  profileName: {
    color: "#FFF4D6",
    fontSize: 16,
    fontWeight: "700",
  },
  profileSub: {
    color: "#D6C2A1",
    fontSize: 13,
    marginTop: 2,
  },
  profileBio: {
    color: "#A7A1BD",
    fontSize: 12,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 26,
  },
  sectionTitle: {
    color: "#FFF4D6",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 12,
  },
  analyticsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  achievementCategory: {
    marginBottom: 20,
  },
  achievementCategoryTitle: {
    color: "#D4AF37",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
  },
  achievementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  emptyFeatureCard: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#3E3B5C",
    borderRadius: 12,
    padding: 26,
    alignItems: "center",
    marginTop: 20,
  },
  emptyFeatureTitle: {
    color: "#FFF4D6",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyFeatureText: {
    color: "#A7A1BD",
    fontSize: 13,
    marginTop: 8,
  },
  activityCard: {
    backgroundColor: "#1A1830",
    borderWidth: 1,
    borderColor: "#3E3B5C",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  activityText: {
    color: "#A7A1BD",
    fontSize: 13,
  },
});
