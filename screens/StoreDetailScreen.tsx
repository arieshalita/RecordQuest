import React from "react";
import { ScrollView, Text, View, Pressable, StyleSheet } from "react-native";
import { TopBar } from "../components/TopBar";
import type { StoreItem } from "../hooks/types";

type StoreDetailScreenProps = {
  detailStore: StoreItem;
  storeCheckIns: Record<string, number>;
  openDirections: (address: string) => void;
  checkIn: (store: StoreItem) => void;
  onBack: () => void;
};

export function StoreDetailScreen({
  detailStore,
  storeCheckIns,
  openDirections,
  checkIn,
  onBack,
}: StoreDetailScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <TopBar title="Store Details" back={onBack} />
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
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 26,
    paddingBottom: 130,
  },
  storeDetailCard: {
    backgroundColor: "#1A1830",
    borderWidth: 1,
    borderColor: "#3E3B5C",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  storeDetailName: {
    color: "#FFF4D6",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  storeMetaRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  storeMetaText: {
    color: "#A7A1BD",
    fontSize: 12,
  },
  storeAddress: {
    color: "#A7A1BD",
    fontSize: 13,
    marginBottom: 8,
  },
  storeDescription: {
    color: "#D6C2A1",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  storeButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  storeButton: {
    flex: 1,
    backgroundColor: "#3E3B5C",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  storeButtonText: {
    color: "#A7A1BD",
    fontSize: 14,
    fontWeight: "600",
  },
  checkInButton: {
    backgroundColor: "#7C3AED",
  },
  checkInButtonText: {
    color: "#FFF4D6",
  },
});
