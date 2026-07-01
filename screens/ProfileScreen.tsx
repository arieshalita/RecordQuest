import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View, StyleSheet, Pressable } from "react-native";
import { TopBar } from "../components/TopBar";
import { StatCard } from "../components/StatCard";
import { AnalyticsCard } from "../components/AnalyticsCard";
import { AnalyticsSectionHeader } from "../components/AnalyticsSectionHeader";
import { AchievementBadgeCard } from "../components/AchievementBadgeCard";
import { useAuth } from "../providers/AuthProvider";
import type { RecordItem, AchievementCategory, CollectionAnalytics } from "../hooks/types";
import { calculateCollectionAnalytics } from "../utils/analytics";
import {
  followUser,
  getFollowerCount,
  getFollowingCount,
  isFollowing,
  unfollowUser,
} from "../hooks/user-follows";

type ProfileScreenProps = {
  records: RecordItem[];
  wishlist: RecordItem[];
  unlockedBadgeCount: number;
  achievementCategories: AchievementCategory[];
  activity: string[];
  storeCheckIns: Record<string, number>;
  onBack: () => void;
  profileUserId?: string;
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
  profileUserId,
}: ProfileScreenProps) {
  const { signOut, user } = useAuth();
  const currentUserId = user?.id ?? null;
  const targetUserId = profileUserId ?? currentUserId;
  const isOwnProfile = useMemo(
    () => !targetUserId || targetUserId === currentUserId,
    [currentUserId, targetUserId]
  );

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followingState, setFollowingState] = useState(false);
  const [isFollowActionLoading, setIsFollowActionLoading] = useState(false);
  const [isFollowMetaLoading, setIsFollowMetaLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  const analytics = calculateCollectionAnalytics(records, wishlist, storeCheckIns, activity);

  const refreshFollowMeta = useCallback(async () => {
    if (!targetUserId) {
      setFollowerCount(0);
      setFollowingCount(0);
      setFollowingState(false);
      setIsFollowMetaLoading(false);
      return;
    }

    setIsFollowMetaLoading(true);
    setFollowError(null);

    try {
      const [followers, following, amFollowing] = await Promise.all([
        getFollowerCount(targetUserId),
        getFollowingCount(targetUserId),
        isOwnProfile ? Promise.resolve(false) : isFollowing(targetUserId),
      ]);

      setFollowerCount(followers);
      setFollowingCount(following);
      setFollowingState(amFollowing);
    } catch {
      setFollowError("Could not load follow details.");
    } finally {
      setIsFollowMetaLoading(false);
    }
  }, [isOwnProfile, targetUserId]);

  useEffect(() => {
    void refreshFollowMeta();
  }, [refreshFollowMeta]);

  async function onToggleFollow() {
    if (!targetUserId || isOwnProfile || isFollowActionLoading) {
      return;
    }

    setIsFollowActionLoading(true);
    setFollowError(null);

    try {
      const result = followingState
        ? await unfollowUser(targetUserId)
        : await followUser(targetUserId);

      if (!result.success) {
        setFollowError(result.error ?? "Could not update follow status.");
        return;
      }

      setFollowingState((current) => !current);
      setFollowerCount((current) => (followingState ? Math.max(0, current - 1) : current + 1));
      await refreshFollowMeta();
    } catch {
      setFollowError("Could not update follow status.");
    } finally {
      setIsFollowActionLoading(false);
    }
  }

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
          <View style={styles.followMetaRow}>
            <Text style={styles.followMetaText}>
              {isFollowMetaLoading ? "Followers ..." : `Followers ${followerCount}`}
            </Text>
            <Text style={styles.followMetaText}>
              {isFollowMetaLoading ? "Following ..." : `Following ${followingCount}`}
            </Text>
          </View>

          {!isOwnProfile && (
            <Pressable
              style={[styles.followButton, followingState ? styles.followingButton : styles.followCtaButton]}
              onPress={() => {
                void onToggleFollow();
              }}
              disabled={isFollowActionLoading}
            >
              <Text style={[styles.followButtonText, followingState ? styles.followingButtonText : styles.followCtaButtonText]}>
                {isFollowActionLoading ? "Updating..." : followingState ? "Following" : "Follow"}
              </Text>
            </Pressable>
          )}

          {followError ? <Text style={styles.followErrorText}>{followError}</Text> : null}
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

      <View style={styles.signOutSection}>
        <Pressable
          style={styles.signOutButton}
          onPress={() => {
            void signOut();
          }}
          hitSlop={8}
        >
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 26,
    paddingBottom: 220,
  },
  profileCard: {
    backgroundColor: "#1A1830",
    borderWidth: 1,
    borderColor: "#3E3B5C",
    borderRadius: 14,
    padding: 18,
    flexDirection: "row",
    gap: 14,
    marginBottom: 28,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#7C3AED",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  avatarText: {
    color: "#FFF4D6",
    fontSize: 28,
    fontWeight: "700",
  },
  profileName: {
    color: "#FFF4D6",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  profileSub: {
    color: "#D6C2A1",
    fontSize: 13,
    marginTop: 3,
    fontWeight: "500",
  },
  profileBio: {
    color: "#A7A1BD",
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  followMetaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  followMetaText: {
    color: "#C4BEE0",
    fontSize: 12,
    fontWeight: "600",
  },
  followButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  followCtaButton: {
    backgroundColor: "#7C3AED",
    borderColor: "#6D28D9",
  },
  followingButton: {
    backgroundColor: "rgba(62, 59, 92, 0.55)",
    borderColor: "#3E3B5C",
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  followCtaButtonText: {
    color: "#FFF4D6",
  },
  followingButtonText: {
    color: "#C4BEE0",
  },
  followErrorText: {
    color: "#FCA5A5",
    fontSize: 12,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 32,
  },
  sectionTitle: {
    color: "#FFF4D6",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 20,
    marginTop: 24,
    letterSpacing: 0.3,
  },
  analyticsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  achievementCategory: {
    marginBottom: 52,
  },
  achievementCategoryTitle: {
    color: "#D4AF37",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 16,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    lineHeight: 14,
    width: "100%",
  },
  achievementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "flex-start",
  },
  emptyFeatureCard: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#3E3B5C",
    borderRadius: 12,
    padding: 26,
    alignItems: "center",
    marginTop: 24,
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
    marginBottom: 10,
    marginTop: 0,
  },
  activityText: {
    color: "#A7A1BD",
    fontSize: 13,
  },
  signOutSection: {
    marginTop: 36,
    marginBottom: 36,
    alignItems: "center",
  },
  signOutButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(167, 161, 189, 0.22)",
    backgroundColor: "rgba(26, 24, 48, 0.7)",
  },
  signOutButtonText: {
    color: "#C4BEE0",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
