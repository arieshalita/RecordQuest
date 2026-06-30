import React from "react";
import { ScrollView, Text, View, Pressable, StyleSheet } from "react-native";
import { TopBar } from "../components/TopBar";
import type { StoreItem } from "../hooks/types";

type StoreFinderScreenProps = {
  stores: StoreItem[];
  storeCheckIns: Record<string, number>;
  onViewStore: (store: StoreItem) => void;
  openDirections: (address: string) => void;
  checkIn: (store: StoreItem) => void;
  back: () => void;
};

export function StoreFinderScreen({
  stores,
  storeCheckIns,
  onViewStore,
  openDirections,
  checkIn,
  back,
}: StoreFinderScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <TopBar title="Find Stores" back={back} />
      <Text style={styles.screenSubtitle}>Local record stores around Needham</Text>
      {stores.length === 0 ? (
        <View style={styles.emptyFeatureCard}>
          <Text style={styles.emptyFeatureTitle}>No stores found</Text>
          <Text style={styles.emptyFeatureText}>Try adjusting your location</Text>
        </View>
      ) : (
        stores.map((store) => (
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
              <Pressable style={[styles.storeButton, styles.viewStoreButton]} onPress={() => onViewStore(store)}>
                <Text style={styles.storeButtonText}>View Store</Text>
              </Pressable>
              <Pressable style={[styles.storeButton, styles.checkInButton]} onPress={() => checkIn(store)}>
                <Text style={[styles.storeButtonText, styles.checkInButtonText]}>Check In</Text>
              </Pressable>
            </View>
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
  screenSubtitle: {
    color: "#D6C2A1",
    fontSize: 15,
    marginBottom: 20,
  },
  storeCard: {
    backgroundColor: "#1A1830",
    borderWidth: 1,
    borderColor: "#3E3B5C",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  storeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  storeName: {
    color: "#FFF4D6",
    fontSize: 15,
    fontWeight: "700",
  },
  storeNeighborhood: {
    color: "#D6C2A1",
    fontSize: 12,
    marginTop: 2,
  },
  storeDistance: {
    color: "#A7A1BD",
    fontSize: 12,
  },
  storeAddress: {
    color: "#A7A1BD",
    fontSize: 13,
    marginBottom: 8,
  },
  storeMetaRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  storeMetaText: {
    color: "#A7A1BD",
    fontSize: 12,
  },
  storeButtonsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  storeButton: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "#3E3B5C",
    paddingVertical: 11,
    borderRadius: 6,
    alignItems: "center",
  },
  storeButtonText: {
    color: "#A7A1BD",
    fontSize: 11,
    fontWeight: "600",
  },
  viewStoreButton: {
    backgroundColor: "#3E3B5C",
  },
  checkInButton: {
    backgroundColor: "#7C3AED",
  },
  checkInButtonText: {
    color: "#FFF4D6",
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
});
