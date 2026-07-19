import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View, StyleSheet, Pressable, TextInput, Modal } from "react-native";
import { AlbumArt } from "../components/AlbumArt";
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
import {
  getProfileIdentity,
  sanitizeUsername,
  saveOwnProfileIdentity,
} from "../hooks/profile-identity";
import {
  loadPublicCollectionCount,
  loadPublicCollectionPreview,
  type PublicRecordPreview,
} from "../hooks/public-collection-preview";

type ProfileScreenProps = {
  records: RecordItem[];
  wishlist: RecordItem[];
  unlockedBadgeCount: number;
  achievementCategories: AchievementCategory[];
  activity: string[];
  storeCheckIns: Record<string, number>;
  onBack: () => void;
  profileUserId?: string;
  profileDisplayName?: string;
  onOpenDiscoverUsers?: () => void;
  onOpenSocialConnections?: (mode: "followers" | "following", userId: string, displayName: string) => void;
  onOpenProfileRecords?: (userId: string, displayName: string) => void;
};

type FeatureTile = {
  key: "store-explorer" | "achievements" | "collector-journal";
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  nextStep: string;
  categoryTitle?: string;
  accentColor: string;
};

const FEATURE_TILES: FeatureTile[] = [
  {
    key: "store-explorer",
    icon: "🗺️",
    title: "Store Explorer",
    subtitle: "Check-ins and crate-digging milestones",
    description: "Track your record store visits and unlock exploration badges as you check in more often.",
    nextStep: "Visit a record store and check in to begin unlocking this track.",
    categoryTitle: "Store Explorer",
    accentColor: "#14B8A6",
  },
  {
    key: "achievements",
    icon: "🏆",
    title: "Achievements",
    subtitle: "Your total badge progress",
    description: "This track summarizes your overall RecordQuest badge completion across all categories.",
    nextStep: "Add records, grow your wishlist, and log activity to unlock more badges.",
    accentColor: "#A78BFA",
  },
  {
    key: "collector-journal",
    icon: "📖",
    title: "Collector Journal",
    subtitle: "Stories, notes, ratings, and memory logs",
    description: "Capture details about your records to unlock journal-focused achievements.",
    nextStep: "Add notes, ratings, and purchase details on your records to progress this track.",
    categoryTitle: "Collector Journal",
    accentColor: "#F59E0B",
  },
];

function CollectionAnalyticsDashboard({ analytics }: { analytics: CollectionAnalytics }) {
  function formatCurrency(value: number): string {
    return `$${value.toFixed(2)}`;
  }

  function renderRankedList(title: string, rows: Array<{ label: string; count: number }>) {
    return (
      <View style={styles.analyticsListCard}>
        <Text style={styles.analyticsListTitle}>{title}</Text>
        {rows.length === 0 ? (
          <Text style={styles.analyticsListEmptyText}>Not enough data yet</Text>
        ) : (
          rows.map((row, index) => (
            <View key={`${title}-${row.label}`} style={styles.analyticsListRow}>
              <Text style={styles.analyticsListLabel}>{`${index + 1}. ${row.label}`}</Text>
              <Text style={styles.analyticsListValue}>{row.count}</Text>
            </View>
          ))
        )}
      </View>
    );
  }

  function renderDistributionCard(
    title: string,
    rows: Array<{ label: string; count: number; percent: number }>,
    unitLabel: string
  ) {
    return (
      <View style={styles.analyticsListCard}>
        <Text style={styles.analyticsListTitle}>{title}</Text>
        {rows.length === 0 ? (
          <Text style={styles.analyticsListEmptyText}>Not enough data yet</Text>
        ) : (
          rows.map((row) => (
            <View key={`${title}-${row.label}`} style={styles.distributionRowWrap}>
              <View style={styles.distributionHeaderRow}>
                <Text style={styles.distributionLabel}>{row.label}</Text>
                <Text style={styles.distributionValue}>{`${row.count} ${unitLabel} · ${row.percent}%`}</Text>
              </View>
              <View style={styles.distributionTrack}>
                <View style={[styles.distributionFill, { width: `${Math.max(6, row.percent)}%` }]} />
              </View>
            </View>
          ))
        )}
      </View>
    );
  }

  const overviewCards = [
    { value: analytics.totalRecords, label: "Total records", icon: "📚" },
    { value: analytics.totalArtists, label: "Unique artists", icon: "🎤" },
    { value: analytics.totalGenres, label: "Unique genres", icon: "🎵" },
    { value: analytics.collectorProfileLabel, label: "Collector profile", icon: "🧭" },
    { value: analytics.ratedRecordsCount > 0 ? analytics.averageRating : "-", label: `Average rating (${analytics.ratedRecordsCount} rated)`, icon: "⭐" },
    { value: analytics.recordsAddedThisYear, label: "Added this year", icon: "📅" },
    { value: analytics.recordsAddedThisMonth, label: "Added this month", icon: "🗓️" },
    { value: analytics.favoriteDecade?.decade ?? "-", label: analytics.favoriteDecade ? `Most collected decade (${analytics.favoriteDecade.count})` : "Most collected decade", icon: "📼" },
  ];

  const spendingCards = [
    { value: analytics.totalSpent > 0 ? formatCurrency(analytics.totalSpent) : "-", label: "Total spent", icon: "💸" },
    { value: analytics.averagePurchasePrice > 0 ? formatCurrency(analytics.averagePurchasePrice) : "-", label: "Average purchase price", icon: "🧾" },
    { value: analytics.medianPurchasePrice > 0 ? formatCurrency(analytics.medianPurchasePrice) : "-", label: "Median purchase price", icon: "📐" },
    {
      value: analytics.highestPricedRecord ? formatCurrency(analytics.highestPricedRecord.price) : "-",
      label: analytics.highestPricedRecord ? `Highest price · ${analytics.highestPricedRecord.album}` : "Highest price",
      icon: "💎",
    },
  ];

  const activityCards = [
    {
      value: analytics.mostRecentAddition?.album ?? "-",
      label: analytics.mostRecentAddition?.artist ? `Latest addition · ${analytics.mostRecentAddition.artist}` : "Latest addition",
      icon: "🆕",
    },
    {
      value: analytics.mostActiveCollectingMonth?.label ?? "-",
      label: analytics.mostActiveCollectingMonth ? `Most active month (${analytics.mostActiveCollectingMonth.count})` : "Most active month",
      icon: "🔥",
    },
    {
      value:
        analytics.averageRecordsAddedPerMonth !== null
          ? analytics.averageRecordsAddedPerMonth
          : "-",
      label:
        analytics.averageRecordsAddedPerMonth !== null
          ? "Average added per month"
          : "Average added per month",
      icon: "📈",
    },
    {
      value:
        analytics.longestMonthlyCollectingStreak !== null
          ? `${analytics.longestMonthlyCollectingStreak} mo`
          : "-",
      label:
        analytics.longestMonthlyCollectingStreak !== null
          ? "Longest monthly streak"
          : "Longest monthly streak",
      icon: "⛳",
    },
  ];

  return (
    <View>
      <Text style={styles.sectionTitle}>Collection Overview</Text>

      <View style={styles.analyticsGrid}>
        {overviewCards.map((card) => (
          <AnalyticsCard key={card.label} value={card.value} label={card.label} icon={card.icon} />
        ))}
      </View>

      <AnalyticsSectionHeader title="Taste" icon="🎚️" />
      {renderRankedList("Top 3 artists", analytics.topArtists)}
      {renderDistributionCard("Decade distribution (Top 3)", analytics.decadeDistribution, "records")}

      <View style={styles.analyticsInlineCallout}>
        <Text style={styles.analyticsInlineTitle}>Average release year</Text>
        <Text style={styles.analyticsInlineValue}>
          {analytics.averageYear > 0 ? String(analytics.averageYear) : "Not enough data yet"}
        </Text>
        <Text style={styles.analyticsInlineSubtext}>
          {analytics.highestRatedArtist
            ? `Highest-rated artist: ${analytics.highestRatedArtist.artist} (${analytics.highestRatedArtist.averageRating}/5 across ${analytics.highestRatedArtist.count})`
            : "Highest-rated artist appears after at least 2 rated records for the same artist."}
        </Text>
      </View>

      <AnalyticsSectionHeader title="Spending" icon="💰" />
      <View style={styles.analyticsGrid}>
        {spendingCards.map((card) => (
          <AnalyticsCard key={card.label} value={card.value} label={card.label} icon={card.icon} />
        ))}
      </View>

      <View style={styles.analyticsInlineCallout}>
        <Text style={styles.analyticsInlineTitle}>Price extremes</Text>
        <Text style={styles.analyticsInlineSubtext}>
          {analytics.lowestPricedRecord
            ? `Lowest: ${analytics.lowestPricedRecord.album} (${formatCurrency(analytics.lowestPricedRecord.price)})`
            : "Lowest: Not enough data yet"}
        </Text>
        <Text style={styles.analyticsInlineSubtext}>
          {analytics.bestBargainRecord
            ? `Best bargain: ${analytics.bestBargainRecord.album} (${analytics.bestBargainRecord.rating}/5 at ${formatCurrency(analytics.bestBargainRecord.price)})`
            : "Best bargain needs both rating and price data."}
        </Text>
      </View>

      <AnalyticsSectionHeader title="Collecting Activity" icon="⚡" />
      <View style={styles.analyticsGrid}>
        {activityCards.map((card) => (
          <AnalyticsCard key={card.label} value={card.value} label={card.label} icon={card.icon} />
        ))}
      </View>

      {renderDistributionCard(
        "Collection growth (last 6 months)",
        analytics.collectionGrowthLastMonths.map((entry) => ({
          label: entry.label,
          count: entry.count,
          percent: analytics.totalRecords > 0 ? Math.round((entry.count / analytics.totalRecords) * 100) : 0,
        })),
        "adds"
      )}

      <AnalyticsSectionHeader title="Collection Details" icon="🧱" />
      {renderDistributionCard("Rating distribution (1-5)", analytics.ratingDistribution.map((entry) => ({
        label: `${entry.rating}★`,
        count: entry.count,
        percent: entry.percent,
      })), "records")}

      {analytics.averageRating <= 0 ? (
        <View style={styles.insightHintCard}>
          <Text style={styles.insightHintText}>Rate a few records to unlock rating insights.</Text>
        </View>
      ) : null}
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
  profileDisplayName,
  onOpenDiscoverUsers,
  onOpenSocialConnections,
  onOpenProfileRecords,
}: ProfileScreenProps) {
  const { signOut, user, isLoading: isAuthLoading } = useAuth();
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
  const [profileUsername, setProfileUsername] = useState("");
  const [profileDisplayNameState, setProfileDisplayNameState] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [isProfileIdentityLoading, setIsProfileIdentityLoading] = useState(false);
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [usernameDraft, setUsernameDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [identitySuccess, setIdentitySuccess] = useState<string | null>(null);
  const [publicCollectionRecords, setPublicCollectionRecords] = useState<PublicRecordPreview[]>([]);
  const [isPublicCollectionLoading, setIsPublicCollectionLoading] = useState(false);
  const [publicCollectionError, setPublicCollectionError] = useState<string | null>(null);
  const [publicCollectionCount, setPublicCollectionCount] = useState(0);
  const [selectedPublicRecord, setSelectedPublicRecord] = useState<PublicRecordPreview | null>(null);
  const [selectedFeatureTile, setSelectedFeatureTile] = useState<FeatureTile | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const [profileIdentityUserId, setProfileIdentityUserId] = useState<string | null>(null);
  const saveIdentityInFlightRef = useRef(false);

  const ownProfileFallbackName = useMemo(() => {
    const metadataDisplayName = typeof user?.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";

    if (metadataDisplayName) {
      return metadataDisplayName;
    }

    const metadataUsername = typeof user?.user_metadata?.username === "string"
      ? user.user_metadata.username.trim()
      : "";

    if (metadataUsername) {
      return metadataUsername;
    }

    if (user?.email) {
      const fallback = user.email.split("@")[0]?.trim();
      if (fallback) {
        return fallback;
      }
    }

    return "Collector";
  }, [user?.email, user?.user_metadata?.display_name, user?.user_metadata?.username]);

  const analytics = calculateCollectionAnalytics(records, wishlist, storeCheckIns, activity);
  const allBadges = useMemo(
    () => achievementCategories.flatMap((category) => category.badges),
    [achievementCategories]
  );
  const categoryProgressMap = useMemo(() => {
    const map = new Map<string, { unlocked: number; total: number }>();

    for (const category of achievementCategories) {
      const total = category.badges.length;
      const unlocked = category.badges.filter((badge) => badge.unlocked).length;
      map.set(category.title, { unlocked, total });
    }

    return map;
  }, [achievementCategories]);
  const resolvedProfileName = profileDisplayNameState || (isOwnProfile ? ownProfileFallbackName : profileDisplayName ?? "Collector");
  const isCurrentProfileIdentity = profileIdentityUserId === targetUserId;

  const profileInitial = useMemo(() => {
    const source = resolvedProfileName || profileUsername || "R";
    return source.trim().charAt(0).toUpperCase() || "R";
  }, [profileUsername, resolvedProfileName]);

  function formatAddedAtLabel(value?: string): string {
    if (!value) {
      return "Added date unavailable";
    }

    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
      return "Added date unavailable";
    }

    return `Added ${new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`;
  }

  function getFeatureStatus(tile: FeatureTile): {
    label: "Unlocked" | "In Progress" | "Locked";
    progressText: string;
  } {
    let unlocked = 0;
    let total = 0;

    if (tile.key === "achievements") {
      unlocked = unlockedBadgeCount;
      total = allBadges.length;
    } else if (tile.categoryTitle) {
      const categoryProgress = categoryProgressMap.get(tile.categoryTitle);
      unlocked = categoryProgress?.unlocked ?? 0;
      total = categoryProgress?.total ?? 0;
    }

    if (total === 0) {
      return {
        label: "Locked",
        progressText: "No badges available yet",
      };
    }

    if (unlocked >= total) {
      return {
        label: "Unlocked",
        progressText: `${unlocked}/${total} complete`,
      };
    }

    if (unlocked > 0) {
      return {
        label: "In Progress",
        progressText: `${unlocked}/${total} complete`,
      };
    }

    return {
      label: "Locked",
      progressText: `${unlocked}/${total} complete`,
    };
  }

  const refreshFollowMeta = useCallback(async () => {
    if (!targetUserId) {
      setFollowerCount(0);
      setFollowingCount(0);
      setFollowingState(false);
      setIsFollowMetaLoading(false);
      return;
    }

    setIsFollowMetaLoading(true);
    setFollowerCount(0);
    setFollowingCount(0);
    setFollowingState(false);
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

  const refreshProfileIdentity = useCallback(async () => {
    if (!targetUserId) {
      setProfileUsername("");
      setProfileDisplayNameState("");
      setProfileBio("");
      setDisplayNameDraft("");
      setUsernameDraft("");
      setBioDraft("");
      setProfileIdentityUserId(null);
      setIsProfileIdentityLoading(false);
      return;
    }

    setIsProfileIdentityLoading(true);
    setProfileDisplayNameState("");
    setProfileUsername("");
    setProfileBio("");

    if (isOwnProfile) {
      setDisplayNameDraft("");
      setUsernameDraft("");
      setBioDraft("");
    }

    try {
      const profile = await getProfileIdentity(targetUserId);
      const fallbackName = isOwnProfile ? ownProfileFallbackName : profileDisplayName ?? "Collector";

      setProfileDisplayNameState(profile?.displayName ?? fallbackName);
      setProfileUsername(profile?.username ?? "");
      setProfileBio(profile?.bio ?? "");
      setProfileIdentityUserId(targetUserId);

      if (isOwnProfile) {
        setDisplayNameDraft(profile?.displayName ?? fallbackName);
        setUsernameDraft(profile?.username ?? "");
        setBioDraft(profile?.bio ?? "");
      }
    } finally {
      setIsProfileIdentityLoading(false);
    }
  }, [isOwnProfile, ownProfileFallbackName, profileDisplayName, targetUserId]);

  useEffect(() => {
    void refreshProfileIdentity();
  }, [refreshProfileIdentity]);

  useEffect(() => {
    if (isOwnProfile || !targetUserId) {
      setPublicCollectionRecords([]);
      setPublicCollectionCount(0);
      setIsPublicCollectionLoading(false);
      setPublicCollectionError(null);
      return;
    }

    const viewedUserId = targetUserId;

    let isMounted = true;

    async function loadPreview() {
      setIsPublicCollectionLoading(true);
      setPublicCollectionError(null);

      const result = await loadPublicCollectionPreview(viewedUserId, 8);
      const countResult = await loadPublicCollectionCount(viewedUserId);

      if (!isMounted) return;

      setPublicCollectionRecords(result.records);
      setPublicCollectionCount(countResult.count);
      setPublicCollectionError(result.error ?? countResult.error ?? null);
      setIsPublicCollectionLoading(false);
    }

    void loadPreview();

    return () => {
      isMounted = false;
    };
  }, [isOwnProfile, targetUserId]);

  useEffect(() => {
    if (isOwnProfile) {
      setSelectedPublicRecord(null);
    }
  }, [isOwnProfile]);

  useEffect(() => {
    setSelectedPublicRecord(null);
    setIdentityError(null);
    setIdentitySuccess(null);
  }, [targetUserId]);

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

  async function onSaveIdentity() {
    if (!currentUserId || !isOwnProfile || isSavingIdentity || saveIdentityInFlightRef.current) {
      return;
    }

    if (isAuthLoading) {
      setIdentityError("Please wait for authentication to finish loading.");
      return;
    }

    saveIdentityInFlightRef.current = true;
    setIsSavingIdentity(true);
    setIdentityError(null);
    setIdentitySuccess(null);

    try {
      const result = await saveOwnProfileIdentity(
        currentUserId,
        displayNameDraft,
        usernameDraft,
        bioDraft
      );

      if (!result.success) {
        setIdentityError(result.error ?? "Could not update your profile.");
        return;
      }

      const resolvedDisplayName = result.profile?.displayName ?? displayNameDraft.trim();
      const resolvedUsername = result.profile?.username ?? sanitizeUsername(usernameDraft);
      const resolvedBio = result.profile?.bio ?? bioDraft.trim();

      setProfileDisplayNameState(resolvedDisplayName);
      setProfileUsername(resolvedUsername);
      setProfileBio(resolvedBio);
      setDisplayNameDraft(resolvedDisplayName);
      setUsernameDraft(resolvedUsername);
      setBioDraft(resolvedBio);
      setIdentitySuccess("Profile updated.");
      setIsEditingIdentity(false);
    } finally {
      saveIdentityInFlightRef.current = false;
      setIsSavingIdentity(false);
    }
  }

  return (
    <>
    <ScrollView contentContainerStyle={styles.page}>
      <TopBar title="Profile" back={onBack} />

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profileInitial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{isCurrentProfileIdentity ? resolvedProfileName : (isOwnProfile ? ownProfileFallbackName : (profileDisplayName ?? "Collector"))}</Text>
          <Text style={styles.profileSub}>
            {!isCurrentProfileIdentity || isProfileIdentityLoading
              ? "Loading profile..."
              : profileUsername
                ? `@${profileUsername}`
                : "Vinyl collector"}
          </Text>
          <Text style={styles.profileBio}>
            {!isCurrentProfileIdentity || isProfileIdentityLoading
              ? "Loading profile..."
              : profileBio || "Building the ultimate crate-digging log."}
          </Text>
          <View style={styles.followMetaRow}>
            <Pressable
              style={styles.followMetaButton}
              onPress={() => {
                if (!onOpenSocialConnections || !targetUserId) {
                  return;
                }

                onOpenSocialConnections("followers", targetUserId, resolvedProfileName);
              }}
              disabled={!onOpenSocialConnections || !targetUserId || isFollowMetaLoading}
            >
              <Text style={styles.followMetaText}>
                {isFollowMetaLoading ? "... Followers" : `${followerCount} Followers`}
              </Text>
            </Pressable>
            <Pressable
              style={styles.followMetaButton}
              onPress={() => {
                if (!onOpenSocialConnections || !targetUserId) {
                  return;
                }

                onOpenSocialConnections("following", targetUserId, resolvedProfileName);
              }}
              disabled={!onOpenSocialConnections || !targetUserId || isFollowMetaLoading}
            >
              <Text style={styles.followMetaText}>
                {isFollowMetaLoading ? "... Following" : `${followingCount} Following`}
              </Text>
            </Pressable>
          </View>

          {isOwnProfile && onOpenDiscoverUsers ? (
            <Pressable
              style={styles.discoverUsersButton}
              onPress={onOpenDiscoverUsers}
            >
              <Text style={styles.discoverUsersButtonText}>Find Friends</Text>
            </Pressable>
          ) : null}

          {isOwnProfile && !isEditingIdentity ? (
            <Pressable
              style={styles.editProfileButton}
              onPress={() => {
                setIdentityError(null);
                setIdentitySuccess(null);
                setIsEditingIdentity(true);
              }}
            >
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </Pressable>
          ) : null}

          {isOwnProfile && isEditingIdentity ? (
            <View style={styles.editProfilePanel}>
              <TextInput
                value={displayNameDraft}
                onChangeText={setDisplayNameDraft}
                placeholder="Display name"
                placeholderTextColor="#8F8AA6"
                style={styles.profileInput}
                editable={!isSavingIdentity}
              />
              <TextInput
                value={usernameDraft}
                onChangeText={(value) => {
                  setUsernameDraft(sanitizeUsername(value));
                }}
                placeholder="username"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#8F8AA6"
                style={styles.profileInput}
                editable={!isSavingIdentity}
              />
              <TextInput
                value={bioDraft}
                onChangeText={setBioDraft}
                placeholder="Bio"
                placeholderTextColor="#8F8AA6"
                style={[styles.profileInput, styles.profileBioInput]}
                editable={!isSavingIdentity}
                multiline
                textAlignVertical="top"
                maxLength={240}
              />
              <View style={styles.editActionsRow}>
                <Pressable
                  style={[styles.editActionButton, styles.editSaveButton]}
                  onPress={() => {
                    void onSaveIdentity();
                  }}
                  disabled={isSavingIdentity || isAuthLoading || !currentUserId}
                >
                  <Text style={styles.editSaveButtonText}>{isSavingIdentity ? "Saving..." : "Save"}</Text>
                </Pressable>
                <Pressable
                  style={[styles.editActionButton, styles.editCancelButton]}
                  onPress={() => {
                    setDisplayNameDraft(profileDisplayNameState || ownProfileFallbackName);
                    setUsernameDraft(profileUsername);
                    setBioDraft(profileBio);
                    setIdentityError(null);
                    setIdentitySuccess(null);
                    setIsEditingIdentity(false);
                  }}
                  disabled={isSavingIdentity}
                >
                  <Text style={styles.editCancelButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {identityError ? <Text style={styles.identityErrorText}>{identityError}</Text> : null}
          {identitySuccess ? <Text style={styles.identitySuccessText}>{identitySuccess}</Text> : null}

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

      {isOwnProfile ? (
        <>
          <View style={styles.statsRow}>
            <StatCard
              value={records.length}
              label="Records"
              onPress={() => {
                if (!targetUserId || !onOpenProfileRecords) {
                  return;
                }

                onOpenProfileRecords(targetUserId, resolvedProfileName);
              }}
            />
            <StatCard
              value={followingCount}
              label="Following"
              onPress={() => {
                if (!targetUserId || !onOpenSocialConnections) {
                  return;
                }

                onOpenSocialConnections("following", targetUserId, resolvedProfileName);
              }}
            />
            <StatCard
              value={followerCount}
              label="Followers"
              onPress={() => {
                if (!targetUserId || !onOpenSocialConnections) {
                  return;
                }

                onOpenSocialConnections("followers", targetUserId, resolvedProfileName);
              }}
            />
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <Text style={styles.sectionLinkText}>{allBadges.length} total</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.achievementGrid}
          >
            {allBadges.map((badge) => (
              <AchievementBadgeCard key={badge.id} badge={badge} />
            ))}
          </ScrollView>

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

          <View style={styles.insightsEntryCard}>
            <Text style={styles.insightsEntryTitle}>Insights</Text>
            <Text style={styles.insightsEntryText}>
              Explore patterns, milestones, and trends across your collection.
            </Text>
            <Pressable
              style={styles.insightsToggleButton}
              onPress={() => setShowInsights((current) => !current)}
            >
              <Text style={styles.insightsToggleButtonText}>
                {showInsights ? "Hide Insights" : "View Insights"}
              </Text>
            </Pressable>
          </View>

          {showInsights ? (
            <>
              <Text style={styles.sectionTitle}>Insights</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featureTileRow}
              >
                {FEATURE_TILES.map((tile) => {
                  const status = getFeatureStatus(tile);

                  return (
                    <Pressable
                      key={tile.key}
                      style={[
                        styles.featureTile,
                        {
                          borderColor: `${tile.accentColor}66`,
                        },
                      ]}
                      onPress={() => setSelectedFeatureTile(tile)}
                    >
                      <View style={styles.featureTileTopRow}>
                        <Text style={styles.featureTileIcon}>{tile.icon}</Text>
                        <View style={[styles.featureTileStatusPill, { borderColor: `${tile.accentColor}80`, backgroundColor: `${tile.accentColor}26` }] }>
                          <Text style={styles.featureTileStatusText}>{status.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.featureTileTitle} numberOfLines={1}>{tile.title}</Text>
                      <Text style={styles.featureTileSubtitle} numberOfLines={2}>{tile.subtitle}</Text>
                      <Text style={styles.featureTileProgress} numberOfLines={1}>{status.progressText}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <CollectionAnalyticsDashboard analytics={analytics} />
            </>
          ) : null}

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
        </>
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard
              value={publicCollectionCount}
              label="Records"
              onPress={() => {
                if (!targetUserId || !onOpenProfileRecords) {
                  return;
                }

                onOpenProfileRecords(targetUserId, resolvedProfileName);
              }}
            />
            <StatCard
              value={followingCount}
              label="Following"
              onPress={() => {
                if (!targetUserId || !onOpenSocialConnections) {
                  return;
                }

                onOpenSocialConnections("following", targetUserId, resolvedProfileName);
              }}
            />
            <StatCard
              value={followerCount}
              label="Followers"
              onPress={() => {
                if (!targetUserId || !onOpenSocialConnections) {
                  return;
                }

                onOpenSocialConnections("followers", targetUserId, resolvedProfileName);
              }}
            />
          </View>

          <Text style={styles.sectionTitle}>Public Collection Preview</Text>
          <Text style={styles.publicCollectionHint}>
            Browsing {resolvedProfileName}&apos;s collection
          </Text>

          {isPublicCollectionLoading ? (
            <View style={styles.emptyFeatureCard}>
              <Text style={styles.emptyFeatureText}>Loading records...</Text>
            </View>
          ) : null}

          {!isPublicCollectionLoading && publicCollectionError ? (
            <View style={styles.emptyFeatureCard}>
              <Text style={styles.emptyFeatureTitle}>Preview unavailable</Text>
              <Text style={styles.emptyFeatureText}>{publicCollectionError}</Text>
            </View>
          ) : null}

          {!isPublicCollectionLoading && !publicCollectionError && publicCollectionRecords.length === 0 ? (
            <View style={styles.emptyFeatureCard}>
              <Text style={styles.emptyFeatureTitle}>No public records yet.</Text>
            </View>
          ) : null}

          {!isPublicCollectionLoading && !publicCollectionError
            ? publicCollectionRecords.map((record) => (
                <Pressable
                  key={record.id}
                  style={styles.publicRecordCard}
                  onPress={() => setSelectedPublicRecord(record)}
                >
                  <View style={styles.publicRecordInfo}>
                    <AlbumArt
                      uri={record.cover}
                      style={styles.publicRecordCover}
                      debugScreen="public-collection"
                      debugRecordId={record.id}
                      debugAlbum={record.album}
                      debugArtist={record.artist}
                      debugUriSource="supabase"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.publicRecordAlbum}>{record.album}</Text>
                      <Text style={styles.publicRecordArtist}>{record.artist}</Text>
                      {record.year ? <Text style={styles.publicRecordMeta}>{record.year}</Text> : null}
                      <Text style={styles.publicRecordMeta}>{formatAddedAtLabel(record.addedAt)}</Text>
                    </View>
                  </View>
                </Pressable>
              ))
            : null}
        </>
      )}
    </ScrollView>
    <Modal
      transparent
      visible={!!selectedFeatureTile}
      animationType="fade"
      onRequestClose={() => setSelectedFeatureTile(null)}
    >
      <Pressable style={styles.featureModalOverlay} onPress={() => setSelectedFeatureTile(null)}>
        <Pressable style={styles.featureModalCard} onPress={() => {}}>
          {selectedFeatureTile ? (
            <>
              <Text style={styles.featureModalIcon}>{selectedFeatureTile.icon}</Text>
              <Text style={styles.featureModalTitle}>{selectedFeatureTile.title}</Text>
              <Text style={styles.featureModalDescription}>{selectedFeatureTile.description}</Text>
              <View style={styles.featureModalMetaCard}>
                <Text style={styles.featureModalMetaLabel}>Status</Text>
                <Text style={styles.featureModalMetaValue}>{getFeatureStatus(selectedFeatureTile).label}</Text>
                <Text style={styles.featureModalMetaSub}>{getFeatureStatus(selectedFeatureTile).progressText}</Text>
              </View>
              <Text style={styles.featureModalNextStepLabel}>Next step</Text>
              <Text style={styles.featureModalNextStepText}>{selectedFeatureTile.nextStep}</Text>
              <Pressable style={styles.featureModalCloseButton} onPress={() => setSelectedFeatureTile(null)}>
                <Text style={styles.featureModalCloseButtonText}>Close</Text>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
    <Modal
      transparent
      visible={!!selectedPublicRecord}
      animationType="fade"
      onRequestClose={() => setSelectedPublicRecord(null)}
    >
      <Pressable style={styles.featureModalOverlay} onPress={() => setSelectedPublicRecord(null)}>
        <Pressable style={styles.publicDetailModalCard} onPress={() => {}}>
          {selectedPublicRecord ? (
            <>
              <Text style={styles.publicDetailKicker}>From {resolvedProfileName}&apos;s Collection</Text>
              <AlbumArt
                uri={selectedPublicRecord.cover}
                hint="detail"
                style={styles.publicDetailCover}
                debugScreen="public-collection"
                debugRecordId={selectedPublicRecord.id}
                debugAlbum={selectedPublicRecord.album}
                debugArtist={selectedPublicRecord.artist}
                debugUriSource="supabase"
              />
              <Text style={styles.publicDetailAlbum}>{selectedPublicRecord.album}</Text>
              <Text style={styles.publicDetailArtist}>{selectedPublicRecord.artist}</Text>
              {selectedPublicRecord.year ? (
                <Text style={styles.publicDetailMeta}>Release year {selectedPublicRecord.year}</Text>
              ) : null}
              <Text style={styles.publicDetailMeta}>{formatAddedAtLabel(selectedPublicRecord.addedAt)}</Text>
              <Text style={styles.publicDetailReadOnly}>Read-only public record</Text>
              <Pressable style={styles.featureModalCloseButton} onPress={() => setSelectedPublicRecord(null)}>
                <Text style={styles.featureModalCloseButtonText}>Back to Profile</Text>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 22,
    paddingBottom: 220,
    backgroundColor: "#050509",
  },
  profileCard: {
    backgroundColor: "rgba(15, 17, 24, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.12)",
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    gap: 14,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
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
    color: "#F8EED4",
    fontSize: 24,
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
  publicCollectionHint: {
    color: "#A7A1BD",
    fontSize: 12,
    marginTop: -4,
    marginBottom: 10,
  },
  followMetaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  followMetaButton: {
    borderRadius: 999,
  },
  followMetaText: {
    color: "#C5BDD7",
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.14)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  followButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  discoverUsersButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.44)",
    backgroundColor: "rgba(124, 58, 237, 0.22)",
  },
  discoverUsersButtonText: {
    color: "#C4BEE0",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  editProfileButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.44)",
    backgroundColor: "rgba(212, 175, 55, 0.18)",
  },
  editProfileButtonText: {
    color: "#F0DEB8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  editProfilePanel: {
    marginTop: 12,
    gap: 8,
  },
  profileInput: {
    backgroundColor: "rgba(20, 18, 38, 0.94)",
    color: "#f3e7ce",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.30)",
    fontWeight: "500",
  },
  profileBioInput: {
    minHeight: 72,
  },
  editActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  editActionButton: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  editSaveButton: {
    backgroundColor: "#8B5CF6",
    borderColor: "rgba(124, 58, 237, 0.70)",
  },
  editSaveButtonText: {
    color: "#FFF4D6",
    fontSize: 12,
    fontWeight: "700",
  },
  editCancelButton: {
    backgroundColor: "rgba(62, 59, 92, 0.38)",
    borderColor: "rgba(124, 58, 237, 0.24)",
  },
  editCancelButtonText: {
    color: "#C4BEE0",
    fontSize: 12,
    fontWeight: "700",
  },
  identityErrorText: {
    color: "#FCA5A5",
    fontSize: 12,
    marginTop: 8,
  },
  identitySuccessText: {
    color: "#86EFAC",
    fontSize: 12,
    marginTop: 8,
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
    gap: 10,
    marginBottom: 22,
  },
  featureTileRow: {
    gap: 10,
    paddingBottom: 6,
    paddingRight: 8,
    marginBottom: 8,
  },
  featureTile: {
    width: 210,
    minHeight: 132,
    backgroundColor: "rgba(18, 16, 34, 0.90)",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  featureTileTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  featureTileIcon: {
    fontSize: 18,
  },
  featureTileStatusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  featureTileStatusText: {
    color: "#F8EED4",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  featureTileTitle: {
    color: "#F8EED4",
    fontSize: 14,
    fontWeight: "800",
  },
  featureTileSubtitle: {
    color: "#CFC7E6",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  featureTileProgress: {
    color: "#E9D8B4",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
  },
  sectionTitle: {
    color: "#F8EED4",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14,
    marginTop: 20,
    letterSpacing: 0.3,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
  },
  sectionLinkText: {
    color: "#BEB5D3",
    fontSize: 12,
    fontWeight: "700",
  },
  analyticsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  analyticsListCard: {
    marginTop: -4,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.22)",
    backgroundColor: "rgba(18, 16, 34, 0.90)",
    padding: 12,
  },
  analyticsListTitle: {
    color: "#F8EED4",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  analyticsListEmptyText: {
    color: "#A7A1BD",
    fontSize: 12,
  },
  analyticsListRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(248, 238, 220, 0.08)",
  },
  analyticsListLabel: {
    color: "#E6D8B8",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    paddingRight: 8,
  },
  analyticsListValue: {
    color: "#C4BEE0",
    fontSize: 12,
    fontWeight: "700",
  },
  distributionRowWrap: {
    marginBottom: 8,
  },
  distributionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  distributionLabel: {
    color: "#E6D8B8",
    fontSize: 12,
    fontWeight: "600",
  },
  distributionValue: {
    color: "#A7A1BD",
    fontSize: 11,
    fontWeight: "600",
  },
  distributionTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(124, 58, 237, 0.16)",
  },
  distributionFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(167, 139, 250, 0.9)",
  },
  analyticsInlineCallout: {
    marginTop: -8,
    marginBottom: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.10)",
    backgroundColor: "rgba(15, 17, 24, 0.92)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  analyticsInlineTitle: {
    color: "#F8EED4",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 5,
  },
  analyticsInlineValue: {
    color: "#E9D8B4",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  analyticsInlineSubtext: {
    color: "#BFB8D2",
    fontSize: 12,
    lineHeight: 18,
  },
  insightHintCard: {
    marginTop: -8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.10)",
    backgroundColor: "rgba(15, 17, 24, 0.92)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  insightHintText: {
    color: "#BFB8D2",
    fontSize: 12,
    lineHeight: 18,
  },
  achievementCategory: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.10)",
    backgroundColor: "rgba(15, 17, 24, 0.96)",
    borderRadius: 16,
    padding: 14,
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
    gap: 12,
    paddingRight: 12,
    paddingBottom: 6,
  },
  emptyFeatureCard: {
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.22)",
    borderRadius: 16,
    padding: 26,
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "rgba(18, 16, 34, 0.86)",
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
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(248, 238, 220, 0.10)",
    borderRadius: 0,
    paddingHorizontal: 2,
    paddingVertical: 12,
    marginBottom: 8,
    marginTop: 0,
  },
  activityText: {
    color: "#D0C9DF",
    fontSize: 14,
    lineHeight: 20,
  },
  insightsEntryCard: {
    marginTop: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.28)",
    backgroundColor: "rgba(18, 16, 34, 0.92)",
    borderRadius: 18,
    padding: 16,
  },
  insightsEntryTitle: {
    color: "#F8EED4",
    fontSize: 18,
    fontWeight: "800",
  },
  insightsEntryText: {
    color: "#CFC7E6",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 14,
  },
  insightsToggleButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.52)",
    backgroundColor: "rgba(124, 58, 237, 0.24)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  insightsToggleButtonText: {
    color: "#F8EED4",
    fontSize: 13,
    fontWeight: "700",
  },
  publicRecordCard: {
    backgroundColor: "rgba(18, 16, 34, 0.90)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.22)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  publicRecordInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  publicRecordCover: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "rgba(124, 58, 237, 0.20)",
    flexShrink: 0,
  },
  publicRecordMeta: {
    color: "#A7A1BD",
    fontSize: 11,
    marginTop: 2,
  },
  publicRecordAlbum: {
    color: "#FFF4D6",
    fontSize: 14,
    fontWeight: "700",
  },
  publicRecordArtist: {
    color: "#A7A1BD",
    fontSize: 12,
    marginTop: 2,
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
    borderColor: "rgba(124, 58, 237, 0.26)",
    backgroundColor: "rgba(20, 18, 38, 0.86)",
  },
  signOutButtonText: {
    color: "#C4BEE0",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  featureModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(3, 2, 8, 0.72)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  featureModalCard: {
    backgroundColor: "rgba(16, 14, 28, 0.98)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.34)",
    padding: 18,
  },
  publicDetailModalCard: {
    width: "88%",
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.16)",
    backgroundColor: "rgba(11, 11, 17, 0.98)",
    padding: 18,
    alignItems: "center",
  },
  publicDetailKicker: {
    color: "#A7A1BD",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 10,
  },
  publicDetailCover: {
    width: 132,
    height: 132,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: "#272738",
  },
  publicDetailAlbum: {
    color: "#FFF4D6",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  publicDetailArtist: {
    color: "#C7C7D1",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 8,
    textAlign: "center",
  },
  publicDetailMeta: {
    color: "#A7A1BD",
    fontSize: 12,
    marginTop: 2,
  },
  publicDetailReadOnly: {
    color: "#C4BEE0",
    fontSize: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  featureModalIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  featureModalTitle: {
    color: "#F8EED4",
    fontSize: 20,
    fontWeight: "800",
  },
  featureModalDescription: {
    marginTop: 8,
    color: "#CFC7E6",
    fontSize: 13,
    lineHeight: 20,
  },
  featureModalMetaCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.30)",
    backgroundColor: "rgba(124, 58, 237, 0.12)",
    padding: 12,
  },
  featureModalMetaLabel: {
    color: "#BDB4D7",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  featureModalMetaValue: {
    color: "#F8EED4",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 5,
  },
  featureModalMetaSub: {
    color: "#D8CCEB",
    fontSize: 12,
    marginTop: 2,
  },
  featureModalNextStepLabel: {
    marginTop: 12,
    color: "#E9D8B4",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  featureModalNextStepText: {
    marginTop: 4,
    color: "#D8CCEB",
    fontSize: 13,
    lineHeight: 19,
  },
  featureModalCloseButton: {
    marginTop: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.48)",
    backgroundColor: "rgba(124, 58, 237, 0.25)",
    paddingVertical: 10,
    alignItems: "center",
  },
  featureModalCloseButtonText: {
    color: "#F8EED4",
    fontSize: 13,
    fontWeight: "700",
  },
});
