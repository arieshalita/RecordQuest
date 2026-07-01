import React from "react";
import { ScrollView, StyleSheet, Text, TextInput, Pressable, View, ActivityIndicator } from "react-native";
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
          <Text style={styles.messageTitle}>No users found</Text>
          <Text style={styles.messageText}>Try a different search.</Text>
        </View>
      ) : null}

      {!isLoading && !errorMessage
        ? users.map((user) => (
            <Pressable key={user.userId} style={styles.userCard} onPress={() => onOpenUser(user)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user.displayName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.displayName}</Text>
                <Text style={styles.userHandle}>{user.username ? `@${user.username}` : "@recordquest"}</Text>
              </View>
              <Text style={styles.viewText}>View</Text>
            </Pressable>
          ))
        : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 26,
    paddingBottom: 160,
  },
  subtitle: {
    color: "#C4BEE0",
    fontSize: 14,
    marginBottom: 14,
    lineHeight: 20,
  },
  searchInput: {
    backgroundColor: "rgba(30, 26, 50, 0.98)",
    color: "#f3e7ce",
    borderRadius: 26,
    padding: 15,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(104, 79, 191, 0.26)",
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
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#3E3B5C",
    borderRadius: 12,
    padding: 22,
    alignItems: "center",
    marginTop: 10,
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
    backgroundColor: "#3E3B5C",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: "#FFF4D6",
    fontSize: 12,
    fontWeight: "700",
  },
  userCard: {
    backgroundColor: "rgba(18, 16, 38, 0.96)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.20)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  viewText: {
    color: "#D6C2A1",
    fontSize: 12,
    fontWeight: "700",
  },
});
