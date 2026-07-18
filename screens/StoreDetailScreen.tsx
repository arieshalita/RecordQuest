import React from "react";
import { ScrollView, Text, View, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { TopBar } from "../components/TopBar";
import type { StoreItem } from "../hooks/types";

type StoreDetailScreenProps = {
  detailStore: StoreItem;
  storeCheckIns: Record<string, number>;
  openDirections: (store: StoreItem) => void;
  checkIn: (store: StoreItem) => Promise<void>;
  undoCheckIn: (store: StoreItem) => Promise<void>;
  isMutatingCheckIn: boolean;
  errorMessage?: string | null;
  onBack: () => void;
};

export function StoreDetailScreen({
  detailStore,
  storeCheckIns,
  openDirections,
  checkIn,
  undoCheckIn,
  isMutatingCheckIn,
  errorMessage,
  onBack,
}: StoreDetailScreenProps) {
  const visitCount = storeCheckIns[detailStore.id] ?? 0;

  function confirmUndoCheckIn() {
    Alert.alert(
      "Undo check-in?",
      "This will remove your most recent check-in for this store.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Undo Check-In",
          style: "default",
          onPress: () => {
            void undoCheckIn(detailStore);
          },
        },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <TopBar title="Store Details" back={onBack} />
      <View style={styles.storeDetailCard}>
        <Text style={styles.storeDetailName}>{detailStore.name}</Text>
        <View style={styles.storeMetaRow}>
          <Text style={styles.storeMetaText}>{detailStore.rating}</Text>
          <Text style={styles.storeMetaText}>{detailStore.distance}</Text>
          <Text style={styles.storeMetaText}>{`Visits ${visitCount}`}</Text>
        </View>
        <Text style={styles.storeAddress}>{detailStore.address}</Text>
        <Text style={styles.storeMetaText}>{detailStore.hours}</Text>
        <Text style={styles.storeDescription}>{detailStore.description}</Text>
        <View style={styles.storeButtonsRow}>
          <Pressable style={styles.storeButton} onPress={() => openDirections(detailStore)}>
            <Text style={styles.storeButtonText}>Directions</Text>
          </Pressable>
          <Pressable
            style={[styles.storeButton, styles.checkInButton, isMutatingCheckIn ? styles.disabledButton : null]}
            onPress={() => {
              void checkIn(detailStore);
            }}
            disabled={isMutatingCheckIn}
          >
            {isMutatingCheckIn ? (
              <ActivityIndicator size="small" color="#FFF4D6" />
            ) : (
              <Text style={[styles.storeButtonText, styles.checkInButtonText]}>Check In</Text>
            )}
          </Pressable>
        </View>
        {visitCount > 0 ? (
          <Pressable
            style={[styles.undoButton, isMutatingCheckIn ? styles.disabledButton : null]}
            onPress={confirmUndoCheckIn}
            disabled={isMutatingCheckIn}
          >
            {isMutatingCheckIn ? (
              <ActivityIndicator size="small" color="#C4BEE0" />
            ) : (
              <Text style={styles.undoButtonText}>Undo Check-In</Text>
            )}
          </Pressable>
        ) : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
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
  undoButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.40)",
    backgroundColor: "rgba(62, 59, 92, 0.40)",
  },
  undoButtonText: {
    color: "#C4BEE0",
    fontSize: 12,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.72,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 12,
    marginTop: 10,
  },
});
