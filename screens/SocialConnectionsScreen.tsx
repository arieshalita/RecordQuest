import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { TopBar } from "../components/TopBar";
import {
  loadSocialConnections,
  type SocialConnectionsMode,
  type SocialConnectionUser,
} from "../hooks/social-connections";
import { followUser, unfollowUser } from "../hooks/user-follows";

type SocialConnectionsScreenProps = {
  mode: SocialConnectionsMode;
  viewedUserId: string;
  viewedDisplayName: string;
  currentUserId: string | null;
  onBack: () => void;
  onOpenUser: (user: SocialConnectionUser) => void;
};

export function SocialConnectionsScreen({
  mode,
  viewedUserId,
  viewedDisplayName,
  currentUserId,
  onBack,
  onOpenUser,
}: SocialConnectionsScreenProps) {
  const [users, setUsers] = useState<SocialConnectionUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionLoadingByUserId, setActionLoadingByUserId] = useState<Record<string, boolean>>({});

  const title = mode === "followers" ? "Followers" : "Following";
  const emptyMessage = mode === "followers" ? "No followers yet" : "Not following anyone yet";
  const subtitle = `${viewedDisplayName} • ${title}`;

  const loadConnections = useCallback(
    async (refresh = false) => {
      if (!viewedUserId.trim()) {
        setUsers([]);
        setErrorMessage(mode === "followers" ? "Followers unavailable." : "Following unavailable.");
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      const result = await loadSocialConnections(viewedUserId, mode, currentUserId, 150);

      if (result.error) {
        setUsers([]);
        setErrorMessage(result.error);
      } else {
        setUsers(result.users);
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [currentUserId, mode, viewedUserId]
  );

  useEffect(() => {
    void loadConnections(false);
  }, [loadConnections]);

  const refreshDisabled = isLoading || isRefreshing;

  const sortedUsers = useMemo(() => users, [users]);

  async function onToggleFollow(user: SocialConnectionUser) {
    const targetUserId = user.userId.trim();

    if (!targetUserId || !currentUserId || targetUserId === currentUserId) {
      return;
    }

    if (actionLoadingByUserId[targetUserId]) {
      return;
    }

    setActionLoadingByUserId((current) => ({ ...current, [targetUserId]: true }));

    try {
      const result = user.isFollowingByCurrentUser
        ? await unfollowUser(targetUserId)
        : await followUser(targetUserId);

      if (!result.success) {
        setErrorMessage("Could not update follow status right now.");
        return;
      }

      setUsers((current) =>
        current.map((row) =>
          row.userId === targetUserId
            ? { ...row, isFollowingByCurrentUser: !row.isFollowingByCurrentUser }
            : row
        )
      );
    } catch {
      setErrorMessage("Could not update follow status right now.");
    } finally {
      setActionLoadingByUserId((current) => ({ ...current, [targetUserId]: false }));
    }
  }

  return (
    <View style={styles.page}>
      <TopBar
        title={title}
        back={onBack}
        rightIcon="↻"
        rightAction={() => {
          void loadConnections(true);
        }}
        rightActionLabel="Refresh social list"
        rightActionDisabled={refreshDisabled}
        rightActionLoading={isRefreshing}
      />

      <Text style={styles.subtitle}>{subtitle}</Text>

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#A78BFA" />
          <Text style={styles.loadingText}>Loading {title.toLowerCase()}...</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.messageCard}>
          <Text style={styles.messageTitle}>{title} unavailable</Text>
          <Text style={styles.messageText}>{errorMessage}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              void loadConnections(true);
            }}
            disabled={refreshDisabled}
          >
            <Text style={styles.retryButtonText}>{isRefreshing ? "Refreshing..." : "Retry"}</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !errorMessage ? (
        <FlatList
          data={sortedUsers}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.messageCard}>
              <Text style={styles.messageTitle}>{emptyMessage}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelf = currentUserId === item.userId;
            const isRowActionLoading = Boolean(actionLoadingByUserId[item.userId]);

            return (
              <Pressable style={styles.userCard} onPress={() => onOpenUser(item)}>
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.displayName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}

                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.displayName}</Text>
                  <Text style={styles.userHandle}>{item.username ? `@${item.username}` : "@recordquest"}</Text>
                </View>

                {!isSelf ? (
                  <Pressable
                    style={[
                      styles.followButton,
                      item.isFollowingByCurrentUser ? styles.followingButton : styles.followCtaButton,
                    ]}
                    onPress={() => {
                      void onToggleFollow(item);
                    }}
                    disabled={isRowActionLoading}
                  >
                    <Text
                      style={[
                        styles.followButtonText,
                        item.isFollowingByCurrentUser
                          ? styles.followingButtonText
                          : styles.followCtaButtonText,
                      ]}
                    >
                      {isRowActionLoading
                        ? "Updating..."
                        : item.isFollowingByCurrentUser
                          ? "Following"
                          : "Follow"}
                    </Text>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
    backgroundColor: "#050509",
  },
  subtitle: {
    color: "#CFC7E6",
    fontSize: 13,
    marginTop: -2,
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 150,
  },
  loadingRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 14,
  },
  loadingText: {
    color: "#C7C7D1",
    fontSize: 13,
    fontWeight: "500",
  },
  messageCard: {
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.24)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "rgba(20, 18, 38, 0.84)",
  },
  messageTitle: {
    color: "#FFF4D6",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  messageText: {
    color: "#A7A1BD",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: "rgba(124, 58, 237, 0.25)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.48)",
  },
  retryButtonText: {
    color: "#FFF4D6",
    fontSize: 12,
    fontWeight: "700",
  },
  userCard: {
    backgroundColor: "rgba(20, 18, 38, 0.90)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.28)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 6,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.38)",
    flexShrink: 0,
  },
  avatarText: {
    color: "#FFF4D6",
    fontSize: 18,
    fontWeight: "800",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: "#FFF4D6",
    fontSize: 15,
    fontWeight: "700",
  },
  userHandle: {
    color: "#A7A1BD",
    fontSize: 12,
    marginTop: 2,
  },
  followButton: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
});
