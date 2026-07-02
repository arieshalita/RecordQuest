import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
  ActivityIndicator,
  Image,
} from "react-native";
import { TopBar } from "../components/TopBar";
import type { DiscoverUser } from "../hooks/discover-users";

type DiscoverUsersScreenProps = {
  users: DiscoverUser[];
  searchText: string;
  onSearchTextChange: (value: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onOpenUser: (user: DiscoverUser) => void;
  onBack: () => void;
};

export function DiscoverUsersScreen({
  users,
  searchText,
  onSearchTextChange,
  isLoading,
  errorMessage,
  onRetry,
  onOpenUser,
  onBack,
}: DiscoverUsersScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <TopBar title="Find Friends" back={onBack} />
      <Text style={styles.subtitle}>Discover RecordQuest users and visit their public profile.</Text>

      <TextInput
        style={styles.searchInput}
        value={searchText}
        onChangeText={onSearchTextChange}
        placeholder="Search by name or username"
        placeholderTextColor="#8F8AA6"
      />

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#A78BFA" />
          <Text style={styles.loadingText}>Loading users...</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.messageCard}>
          <Text style={styles.messageTitle}>Could not load users</Text>
          <Text style={styles.messageText}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !errorMessage && users.length === 0 ? (
        <View style={styles.messageCard}>
          <Text style={styles.messageTitle}>No collectors found yet.</Text>
          <Text style={styles.messageText}>Invite friends or try a different name or username.</Text>
        </View>
      ) : null}

      {!isLoading && !errorMessage
        ? users.map((user) => (
            <Pressable key={user.userId} style={styles.userCard} onPress={() => onOpenUser(user)}>
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{user.displayName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.displayName}</Text>
                <Text style={styles.userHandle}>{user.username ? `@${user.username}` : "@recordquest"}</Text>
              </View>
              <View style={styles.viewPill}>
                <Text style={styles.viewText}>View</Text>
              </View>
            </Pressable>
          ))
        : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 22,
    paddingBottom: 160,
    backgroundColor: "#050509",
  },
  subtitle: {
    color: "#CFC7E6",
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  searchInput: {
    backgroundColor: "rgba(20, 18, 38, 0.94)",
    color: "#f3e7ce",
    borderRadius: 16,
    padding: 15,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.30)",
    fontWeight: "500",
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
    padding: 22,
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "rgba(20, 18, 38, 0.84)",
  },
  messageTitle: {
    color: "#FFF4D6",
    fontSize: 15,
    fontWeight: "700",
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
  viewPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.45)",
    backgroundColor: "rgba(212, 175, 55, 0.16)",
  },
  viewText: {
    color: "#F2D188",
    fontSize: 12,
    fontWeight: "700",
  },
});
