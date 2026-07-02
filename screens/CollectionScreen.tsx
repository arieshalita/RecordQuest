import React from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { TopBar } from "../components/TopBar";
import type { RecordItem, AlbumSearchResult } from "../hooks/types";

type RecordListScreenProps = {
  title: string;
  subtitle: string;
  records: RecordItem[];
  album: string;
  artist: string;
  purchasedAt: string;
  setPurchasedAt: (value: string) => void;
  searchResults: AlbumSearchResult[];
  selectedMetadata: AlbumSearchResult | null;
  isSearching: boolean;
  searchMessage: string;
  addFormMessage: string;
  onAlbumChange: (value: string) => void;
  onArtistChange: (value: string) => void;
  onSearch: () => void;
  onSelectResult: (result: AlbumSearchResult) => void;
  onAdd: () => void;
  back: () => void;
  onFound?: (record: RecordItem) => void;
  onRemove?: (record: RecordItem) => void;
  onViewRecord: (record: RecordItem) => void;
  isWishlist?: boolean;
};

export function RecordListScreen({
  title,
  subtitle,
  records,
  album,
  artist,
  purchasedAt,
  setPurchasedAt,
  searchResults,
  selectedMetadata,
  isSearching,
  searchMessage,
  addFormMessage,
  onAlbumChange,
  onArtistChange,
  onSearch,
  onSelectResult,
  onAdd,
  back,
  onFound,
  onRemove,
  onViewRecord,
  isWishlist = false,
}: RecordListScreenProps) {
  const albumQueryLength = album.trim().length;
  const accentColor = isWishlist ? "#EC4899" : "#7C3AED";
  const accentBorderColor = isWishlist ? "rgba(236, 72, 153, 0.40)" : "rgba(124, 58, 237, 0.38)";
  const displayedSuggestions = selectedMetadata ? [] : searchResults.slice(0, 5);
  const shouldShowSuggestions = albumQueryLength >= 2 && displayedSuggestions.length > 0;
  const shouldShowLoading = albumQueryLength >= 2 && !selectedMetadata && isSearching;
  const shouldShowNoResults =
    albumQueryLength >= 2 &&
    !selectedMetadata &&
    !isSearching &&
    displayedSuggestions.length === 0 &&
    searchMessage === "No results found.";
  const shouldShowSearchError =
    albumQueryLength >= 2 &&
    !selectedMetadata &&
    !isSearching &&
    displayedSuggestions.length === 0 &&
    searchMessage !== "" &&
    searchMessage !== "No results found.";

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <TopBar title={title} back={back} />
      <Text style={styles.screenSubtitle}>{subtitle}</Text>

      <View
        style={[
          styles.addPanel,
          {
            borderColor: accentBorderColor,
          },
        ]}
      >
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.albumInput]}
            placeholder="Album"
            placeholderTextColor="#8B8B96"
            value={album}
            onChangeText={onAlbumChange}
          />
          <Pressable
            style={[styles.searchButton, { backgroundColor: accentColor, borderColor: accentBorderColor }]}
            onPress={onSearch}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>

        {shouldShowLoading ? (
          <View style={styles.searchStatusRow}>
            <ActivityIndicator color="#A78BFA" size="small" />
            <Text style={styles.searchStatusText}>Searching...</Text>
          </View>
        ) : null}

        {shouldShowSuggestions ? (
          <View style={styles.dropdownCard}>
            <Text style={styles.dropdownHelperText}>Tap an album to autofill details</Text>
            {displayedSuggestions.map((result: AlbumSearchResult, index) => (
              <Pressable
                key={result.id}
                style={[styles.resultCard, index === 0 ? styles.topResultCard : null]}
                onPress={() => onSelectResult(result)}
              >
                <Image
                  source={{
                    uri: result.cover || "https://upload.wikimedia.org/wikipedia/commons/3/3c/No-album-art.png",
                  }}
                  style={styles.resultCover}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {result.album}
                  </Text>
                  <Text style={styles.resultArtist} numberOfLines={1}>
                    {result.artist}
                  </Text>
                  {result.year && result.year !== "Unknown" ? (
                    <Text style={styles.resultYear}>{result.year}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {shouldShowNoResults ? <Text style={styles.panelHintText}>No results found.</Text> : null}

        {shouldShowSearchError ? <Text style={styles.searchErrorText}>Search unavailable.</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Artist"
          placeholderTextColor="#8B8B96"
          value={artist}
          onChangeText={onArtistChange}
        />
        {!isWishlist && (
          <TextInput
            style={styles.input}
            placeholder="Purchased at (optional)"
            placeholderTextColor="#8B8B96"
            value={purchasedAt}
            onChangeText={setPurchasedAt}
          />
        )}

        {selectedMetadata ? (
          <View style={[styles.selectedCard, { borderColor: accentBorderColor }] }>
            <View style={styles.selectedContentRow}>
              <Image
                source={{
                  uri:
                    selectedMetadata.cover ||
                    "https://upload.wikimedia.org/wikipedia/commons/3/3c/No-album-art.png",
                }}
                style={styles.selectedCover}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedTitle}>{selectedMetadata.album}</Text>
                <Text style={styles.selectedArtist}>{selectedMetadata.artist}</Text>
                <View style={styles.metaRow}>
                  {selectedMetadata.year && selectedMetadata.year !== "Unknown" ? (
                    <Text style={styles.yearText}>{selectedMetadata.year}</Text>
                  ) : null}
                  {selectedMetadata.genre ? (
                    <Text style={styles.genrePill}>{selectedMetadata.genre}</Text>
                  ) : null}
                </View>
                <Text style={styles.selectedHelperText}>Details will be saved with this record.</Text>
              </View>
            </View>
          </View>
        ) : null}

        {addFormMessage ? <Text style={styles.addFormMessage}>{addFormMessage}</Text> : null}

        <Pressable
          style={[styles.addButton, { backgroundColor: accentColor, borderColor: accentBorderColor }]}
          onPress={onAdd}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      {records.length === 0 ? (
        <View style={styles.emptyFeatureCard}>
          <Text style={styles.emptyFeatureTitle}>Nothing here yet</Text>
          <Text style={styles.emptyFeatureText}>Add your first record above.</Text>
        </View>
      ) : (
        records.map((record: RecordItem) => (
          <View key={record.id} style={styles.recordCard}>
            <Pressable style={{ flex: 1 }} onPress={() => onViewRecord?.(record)}>
              <View style={styles.cardInfo}>
                <Image source={{ uri: record.cover }} style={styles.cover} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.albumTitle}>{record.album}</Text>
                  <Text style={styles.artistName}>{record.artist}</Text>
                  {!isWishlist && record.purchasedAt && (
                    <Text style={styles.purchaseText}>Purchased at {record.purchasedAt}</Text>
                  )}
                  <View style={styles.metaRow}>
                    <Text style={styles.genrePill}>{record.genre}</Text>
                    <Text style={styles.yearText}>{record.year}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
            <View style={styles.cardActions}>
              {onFound && (
                <Pressable
                  style={[
                    styles.foundButton,
                    isWishlist ? styles.foundButtonWishlist : null,
                  ]}
                  onPress={() => onFound(record)}
                >
                  <Text style={styles.foundText}>Found</Text>
                </Pressable>
              )}
              {onRemove ? (
                <Pressable style={styles.removeButton} onPress={() => onRemove(record)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 22,
    paddingBottom: 130,
    backgroundColor: "#050509",
  },
  screenSubtitle: {
    color: "#D6C2A1",
    fontSize: 15,
    marginBottom: 24,
  },
  addPanel: {
    backgroundColor: "rgba(17, 16, 30, 0.86)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.22)",
    marginBottom: 32,
  },
  searchRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  input: {
    backgroundColor: "rgba(20, 18, 38, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.28)",
    borderRadius: 12,
    padding: 13,
    color: "#FFF4D6",
    fontSize: 14,
    marginBottom: 14,
  },
  albumInput: {
    flex: 1,
  },
  searchButton: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
  },
  searchButtonText: {
    color: "#FFF4D6",
    fontWeight: "600",
    fontSize: 14,
  },
  searchStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  searchStatusText: {
    color: "#A7A1BD",
    fontSize: 13,
  },
  dropdownCard: {
    backgroundColor: "rgba(20, 18, 38, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.26)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  dropdownHelperText: {
    color: "#B6AFD8",
    fontSize: 12,
    marginBottom: 8,
  },
  searchErrorText: {
    color: "#D4AF37",
    fontSize: 12,
    marginBottom: 12,
  },
  panelHintText: {
    color: "#A7A1BD",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  selectedCard: {
    backgroundColor: "rgba(20, 18, 38, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.40)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  selectedContentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectedCover: {
    width: 58,
    height: 58,
    borderRadius: 6,
    backgroundColor: "#2A2844",
    flexShrink: 0,
  },
  selectedTitle: {
    color: "#FFF4D6",
    fontSize: 14,
    fontWeight: "600",
  },
  selectedArtist: {
    color: "#A7A1BD",
    fontSize: 12,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
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
  resultCard: {
    flexDirection: "row",
    backgroundColor: "rgba(20, 18, 38, 0.90)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.24)",
    borderRadius: 12,
    padding: 8,
    gap: 10,
    marginBottom: 8,
  },
  topResultCard: {
    borderColor: "rgba(124, 58, 237, 0.62)",
    backgroundColor: "rgba(42, 34, 72, 0.95)",
  },
  selectedHelperText: {
    color: "#C3BADF",
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
  },
  resultCover: {
    width: 42,
    height: 42,
    borderRadius: 6,
  },
  resultTitle: {
    color: "#FFF4D6",
    fontSize: 12,
    fontWeight: "600",
  },
  resultArtist: {
    color: "#A7A1BD",
    fontSize: 11,
    marginTop: 1,
  },
  resultYear: {
    color: "#8F8AA6",
    fontSize: 11,
    marginTop: 3,
  },
  addButton: {
    backgroundColor: "#7C3AED",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  addButtonText: {
    color: "#FFF4D6",
    fontSize: 16,
    fontWeight: "700",
  },
  addFormMessage: {
    color: "#FFD9D9",
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 18,
    borderWidth: 1,
    borderColor: "rgba(236, 72, 153, 0.34)",
    backgroundColor: "rgba(236, 72, 153, 0.16)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  recordCard: {
    flexDirection: "row",
    backgroundColor: "rgba(20, 18, 38, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.24)",
    borderRadius: 14,
    padding: 12,
    gap: 14,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  cardInfo: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    flex: 1,
  },
  cover: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  albumTitle: {
    color: "#FFF4D6",
    fontSize: 15,
    fontWeight: "600",
  },
  artistName: {
    color: "#A7A1BD",
    fontSize: 12,
    marginTop: 2,
  },
  purchaseText: {
    color: "#D6C2A1",
    fontSize: 11,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "center",
  },
  foundButton: {
    backgroundColor: "rgba(124, 58, 237, 0.24)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.52)",
  },
  foundButtonWishlist: {
    backgroundColor: "rgba(236, 72, 153, 0.18)",
    borderColor: "rgba(236, 72, 153, 0.48)",
  },
  foundText: {
    color: "#FFD9EE",
    fontSize: 12,
    fontWeight: "600",
  },
  removeButton: {
    backgroundColor: "rgba(62, 59, 92, 0.38)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(62, 59, 92, 0.6)",
  },
  removeText: {
    color: "#A7A1BD",
    fontSize: 12,
    fontWeight: "600",
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
