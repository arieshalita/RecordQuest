import React from "react";
import { ScrollView, Text, View, Pressable, TextInput, StyleSheet } from "react-native";
import { AlbumArt } from "../components/AlbumArt";
import { TopBar } from "../components/TopBar";
import type { RecordItem } from "../hooks/types";

type AlbumDetailScreenProps = {
  selectedRecord: RecordItem;
  detailSource: "Collection" | "Wishlist" | null;
  isEditingRecord: boolean;
  recordDraft: Partial<RecordItem>;
  updateRecordDraft: (field: keyof RecordItem, value: string | number) => void;
  saveRecordDetail: () => void;
  deleteRecordDetail: () => void;
  setIsEditingRecord: (value: boolean) => void;
  closeRecordDetail: () => void;
};

export function AlbumDetailScreen({
  selectedRecord,
  detailSource,
  isEditingRecord,
  recordDraft,
  updateRecordDraft,
  saveRecordDetail,
  deleteRecordDetail,
  setIsEditingRecord,
  closeRecordDetail,
}: AlbumDetailScreenProps) {
  const selectedRating = (recordDraft.rating ?? selectedRecord.rating ?? 0) as number;

  function hasValidPurchaseDate(value?: string): boolean {
    if (!value) {
      return false;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }

    return !Number.isNaN(Date.parse(trimmed));
  }

  function formatAddedDate(value?: string): string {
    if (!value) {
      return "Added date unavailable";
    }

    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
      return "Added date unavailable";
    }

    return `Added ${new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  const addedDateLabel = formatAddedDate(selectedRecord.added_at);
  const showPurchaseDateField = isEditingRecord || hasValidPurchaseDate(selectedRecord.purchaseDate);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <TopBar title="Collector Journal" back={closeRecordDetail} />
      <View style={styles.detailCard}>
        <AlbumArt
          uri={selectedRecord.cover}
          hint="detail"
          style={styles.detailCover}
          debugScreen={detailSource === "Wishlist" ? "wishlist" : "owner-collection"}
          debugRecordId={selectedRecord.id}
          debugAlbum={selectedRecord.album}
          debugArtist={selectedRecord.artist}
          debugUriSource="supabase"
        />
        <Text style={styles.detailTitle}>{selectedRecord.album}</Text>
        <Text style={styles.detailArtist}>{selectedRecord.artist}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.genrePill}>{selectedRecord.genre}</Text>
          <Text style={styles.yearText}>{selectedRecord.year}</Text>
        </View>

        <View style={styles.journalCard}>
          <Text style={styles.journalHeader}>Collector Details</Text>
          <Text style={styles.addedDateText}>{addedDateLabel}</Text>

          <View style={styles.journalField}>
            <Text style={styles.journalLabel}>Purchased At</Text>
            {isEditingRecord ? (
              <TextInput
                style={styles.journalInput}
                value={recordDraft.purchasedAt ?? ""}
                onChangeText={(value) => updateRecordDraft("purchasedAt", value)}
                placeholder="Where did you buy it?"
                placeholderTextColor="#8b7fe0"
              />
            ) : (
              <Text style={styles.journalValue}>{selectedRecord.purchasedAt || "Not recorded"}</Text>
            )}
          </View>

          <View style={styles.columnRow}>
            {showPurchaseDateField ? (
              <View style={styles.journalHalfField}>
                <Text style={styles.journalLabel}>Purchase Date</Text>
                {isEditingRecord ? (
                  <TextInput
                    style={styles.journalInput}
                    value={recordDraft.purchaseDate ?? ""}
                    onChangeText={(value) => updateRecordDraft("purchaseDate", value)}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor="#8b7fe0"
                  />
                ) : (
                  <Text style={styles.journalValue}>{selectedRecord.purchaseDate}</Text>
                )}
              </View>
            ) : null}
            <View style={styles.journalHalfField}>
              <Text style={styles.journalLabel}>Price Paid</Text>
              {isEditingRecord ? (
                <TextInput
                  style={styles.journalInput}
                  value={recordDraft.price ?? ""}
                  onChangeText={(value) => updateRecordDraft("price", value)}
                  placeholder="$0.00"
                  placeholderTextColor="#8b7fe0"
                  keyboardType="numeric"
                />
              ) : (
                <Text style={styles.journalValue}>{selectedRecord.price ? `$${selectedRecord.price}` : "Not recorded"}</Text>
              )}
            </View>
          </View>

          <View style={styles.journalField}>
            <Text style={styles.journalLabel}>Condition</Text>
            {isEditingRecord ? (
              <TextInput
                style={styles.journalInput}
                value={recordDraft.condition ?? ""}
                onChangeText={(value) => updateRecordDraft("condition", value)}
                placeholder="Mint, Excellent, Good…"
                placeholderTextColor="#8b7fe0"
              />
            ) : (
              <Text style={styles.journalValue}>{selectedRecord.condition || "Good"}</Text>
            )}
          </View>

          <View style={styles.journalField}>
            <Text style={styles.journalLabel}>Favorite Track</Text>
            {isEditingRecord ? (
              <TextInput
                style={styles.journalInput}
                value={recordDraft.favoriteTrack ?? ""}
                onChangeText={(value) => updateRecordDraft("favoriteTrack", value)}
                placeholder="Track name..."
                placeholderTextColor="#8b7fe0"
              />
            ) : (
              <Text style={styles.journalValue}>{selectedRecord.favoriteTrack || "Not noted"}</Text>
            )}
          </View>

          <View style={styles.journalField}>
            <Text style={styles.journalLabel}>Your Story</Text>
            {isEditingRecord ? (
              <TextInput
                style={[styles.journalInput, styles.journalStoryInput]}
                multiline
                value={recordDraft.notes ?? ""}
                onChangeText={(value) => updateRecordDraft("notes", value)}
                placeholder="What makes this pressing special?"
                placeholderTextColor="#8b7fe0"
              />
            ) : (
              <Text style={styles.journalStoryText}>{selectedRecord.notes || "Share the story behind this record."}</Text>
            )}
          </View>

          <View style={styles.ratingRow}>
            <Text style={styles.journalLabel}>Personal Rating</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => isEditingRecord && updateRecordDraft("rating", star)}
                  style={styles.starButton}
                >
                  <Text style={[styles.starText, star <= selectedRating ? styles.starActive : styles.starInactive]}>
                    {star <= selectedRating ? "★" : "☆"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.detailFooterRow}>
          {isEditingRecord ? (
            <Pressable style={styles.saveButton} onPress={saveRecordDetail}>
              <Text style={styles.saveButtonText}>Save Story</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.editButton} onPress={() => setIsEditingRecord(true)}>
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          )}

          <Pressable style={styles.deleteButton} onPress={deleteRecordDetail}>
            <Text style={styles.deleteButtonText}>Delete</Text>
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
  detailCard: {
    backgroundColor: "#1A1830",
    borderWidth: 1,
    borderColor: "#3E3B5C",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  detailCover: {
    width: "100%",
    height: 260,
    borderRadius: 8,
    marginBottom: 12,
  },
  detailTitle: {
    color: "#FFF4D6",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  detailArtist: {
    color: "#A7A1BD",
    fontSize: 14,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  genrePill: {
    color: "#D4AF37",
    fontSize: 11,
    fontWeight: "500",
  },
  yearText: {
    color: "#A7A1BD",
    fontSize: 11,
  },
  journalCard: {
    backgroundColor: "#121022",
    borderWidth: 1,
    borderColor: "#3E3B5C",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  journalHeader: {
    color: "#D4AF37",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  addedDateText: {
    color: "#A7A1BD",
    fontSize: 12,
    marginBottom: 12,
  },
  journalField: {
    marginBottom: 12,
  },
  columnRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  journalHalfField: {
    flex: 1,
  },
  journalLabel: {
    color: "#A7A1BD",
    fontSize: 12,
    marginBottom: 4,
  },
  journalInput: {
    backgroundColor: "#1A1830",
    borderWidth: 1,
    borderColor: "#3E3B5C",
    borderRadius: 6,
    padding: 8,
    color: "#FFF4D6",
    fontSize: 13,
  },
  journalValue: {
    color: "#FFF4D6",
    fontSize: 13,
  },
  journalStoryInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  journalStoryText: {
    color: "#FFF4D6",
    fontSize: 13,
    lineHeight: 18,
  },
  ratingRow: {
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  starButton: {
    paddingHorizontal: 4,
  },
  starText: {
    fontSize: 20,
  },
  starActive: {
    color: "#D4AF37",
  },
  starInactive: {
    color: "#3E3B5C",
  },
  detailFooterRow: {
    flexDirection: "row",
    gap: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFF4D6",
    fontWeight: "700",
    fontSize: 14,
  },
  editButton: {
    flex: 1,
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  editButtonText: {
    color: "#FFF4D6",
    fontWeight: "700",
    fontSize: 14,
  },
  deleteButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3E3B5C",
  },
  deleteButtonText: {
    color: "#A7A1BD",
    fontWeight: "600",
    fontSize: 14,
  },
});
