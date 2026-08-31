import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AlbumArt } from "../AlbumArt";
import { RecordQuestTheme } from "../../constants/theme";
import type { RecordItem } from "../../hooks/types";

type ShowdownRecordPickerModalProps = {
  visible: boolean;
  records: RecordItem[];
  isSubmitting: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (record: RecordItem) => void;
};

export function ShowdownRecordPickerModal({
  visible,
  records,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}: ShowdownRecordPickerModalProps) {
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) {
      setSelectedRecordId(null);
    }
  }, [visible]);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)),
    [records]
  );

  const selectedRecord =
    selectedRecordId === null
      ? null
      : sortedRecords.find((record) => record.id === selectedRecordId) ?? null;

  const hasRecords = sortedRecords.length > 0;
  const canSubmit = Boolean(selectedRecord) && !isSubmitting;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalSheet} testID="showdown-record-picker">
          <View style={styles.handle} />
          <Text style={styles.title}>Choose a Record</Text>
          <Text style={styles.subtitle}>Pick one from your collection for this Showdown.</Text>

          {!hasRecords ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No records in your collection yet.</Text>
              <Text style={styles.emptyText}>Add a record to your collection, then come back to enter.</Text>
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed ? styles.secondaryPressed : null]}
                onPress={onClose}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <FlatList
                data={sortedRecords}
                keyExtractor={(item) => String(item.id)}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected = item.id === selectedRecordId;

                  return (
                    <View testID="showdown-record-option">
                      <Pressable
                        testID={`showdown-record-option-${item.id}`}
                        style={({ pressed }) => [
                          styles.recordRow,
                          isSelected ? styles.recordRowSelected : null,
                          pressed ? styles.recordRowPressed : null,
                        ]}
                        onPress={() => {
                          setSelectedRecordId(item.id);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <AlbumArt
                          uri={item.cover}
                          style={styles.cover}
                          debugScreen="owner-collection"
                          debugRecordId={item.id}
                          debugAlbum={item.album}
                          debugArtist={item.artist}
                          debugUriSource="supabase"
                        />

                        <View style={styles.rowTextWrap}>
                          <Text style={styles.albumTitle} numberOfLines={1}>
                            {item.album}
                          </Text>
                          <Text style={styles.artistName} numberOfLines={1}>
                            {item.artist}
                          </Text>
                        </View>

                        <View style={[styles.radio, isSelected ? styles.radioSelected : null]}>
                          {isSelected ? <View style={styles.radioDot} /> : null}
                        </View>
                      </Pressable>
                    </View>
                  );
                }}
              />

              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

              <View style={styles.actionsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    isSubmitting ? styles.secondaryButtonDisabled : null,
                    pressed && !isSubmitting ? styles.secondaryPressed : null,
                  ]}
                  onPress={onClose}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  testID="showdown-submit-button"
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !canSubmit ? styles.primaryButtonDisabled : null,
                    pressed && canSubmit ? styles.primaryPressed : null,
                  ]}
                  onPress={() => {
                    if (selectedRecord) {
                      onSubmit(selectedRecord);
                    }
                  }}
                  disabled={!canSubmit}
                  accessibilityRole="button"
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={RecordQuestTheme.colors.textPrimary} size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Enter Record</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(4, 5, 9, 0.72)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: RecordQuestTheme.colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    borderBottomWidth: 0,
    minHeight: "70%",
    maxHeight: "92%",
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(246, 238, 220, 0.32)",
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 6,
  },
  subtitle: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 10,
  },
  recordRow: {
    minHeight: 84,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    backgroundColor: RecordQuestTheme.colors.bgCard,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  recordRowSelected: {
    borderColor: RecordQuestTheme.colors.borderStrong,
    backgroundColor: "rgba(139, 92, 246, 0.16)",
  },
  recordRowPressed: {
    opacity: 0.9,
  },
  cover: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 12,
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  albumTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
  },
  artistName: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 13,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(246, 238, 220, 0.28)",
    backgroundColor: "rgba(246, 238, 220, 0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  radioSelected: {
    borderColor: RecordQuestTheme.colors.accent,
    backgroundColor: "rgba(139, 92, 246, 0.24)",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: RecordQuestTheme.colors.textPrimary,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: "row",
    marginTop: 2,
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    backgroundColor: RecordQuestTheme.colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonDisabled: {
    opacity: 0.65,
  },
  secondaryPressed: {
    opacity: 0.9,
  },
  secondaryButtonText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButton: {
    flex: 1.25,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.borderStrong,
    backgroundColor: RecordQuestTheme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryPressed: {
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    color: "#FFF4D6",
    fontSize: 15,
    fontWeight: "800",
  },
  emptyCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    borderRadius: 18,
    backgroundColor: RecordQuestTheme.colors.bgCard,
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  emptyText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 14,
  },
});
