import React from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { AlbumArt } from "../components/AlbumArt";
import { TopBar } from "../components/TopBar";
import type { RecordItem, AlbumSearchResult } from "../hooks/types";

type WishlistScreenProps = {
  records: RecordItem[];
  album: string;
  artist: string;
  searchResults: AlbumSearchResult[];
  selectedMetadata: AlbumSearchResult | null;
  isSearching: boolean;
  searchMessage: string;
  onAlbumChange: (value: string) => void;
  onArtistChange: (value: string) => void;
  onSearch: () => void;
  onSelectResult: (result: AlbumSearchResult) => void;
  onAdd: () => void;
  onFound: (record: RecordItem) => void;
  onRemove: (record: RecordItem) => void;
  onViewRecord: (record: RecordItem) => void;
  back: () => void;
};

export function WishlistScreen({
  records,
  album,
  artist,
  searchResults,
  selectedMetadata,
  isSearching,
  searchMessage,
  onAlbumChange,
  onArtistChange,
  onSearch,
  onSelectResult,
  onAdd,
  onFound,
  onRemove,
  onViewRecord,
  back,
}: WishlistScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <TopBar title="Wishlist" back={back} />
      <Text style={styles.screenSubtitle}>Records you want to find.</Text>

      <View style={styles.addPanel}>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.albumInput]}
            placeholder="Album"
            placeholderTextColor="#8B8B96"
            value={album}
            onChangeText={onAlbumChange}
          />
          <Pressable style={styles.searchButton} onPress={onSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Artist"
          placeholderTextColor="#8B8B96"
          value={artist}
          onChangeText={onArtistChange}
        />
        {isSearching && (
          <View style={styles.searchStatusRow}>
            <ActivityIndicator color="#A78BFA" />
            <Text style={styles.searchStatusText}>Searching MusicBrainz…</Text>
          </View>
        )}
        {searchMessage ? <Text style={styles.searchMessage}>{searchMessage}</Text> : null}
        {selectedMetadata ? (
          <View style={styles.selectedCard}>
            <Text style={styles.selectedLabel}>Selected match</Text>
            <Text style={styles.selectedTitle}>{selectedMetadata.album}</Text>
            <Text style={styles.selectedArtist}>{selectedMetadata.artist}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.genrePill}>{selectedMetadata.genre}</Text>
              <Text style={styles.yearText}>{selectedMetadata.year}</Text>
            </View>
          </View>
        ) : null}
        {searchResults.length > 0 ? (
          <View style={styles.resultsList}>
            {searchResults.map((result: AlbumSearchResult) => (
              <Pressable
                key={result.id}
                style={styles.resultCard}
                onPress={() => onSelectResult(result)}
              >
                <AlbumArt uri={result.cover} style={styles.resultCover} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle}>{result.album}</Text>
                  <Text style={styles.resultArtist}>{result.artist}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.genrePill}>{result.genre}</Text>
                    <Text style={styles.yearText}>{result.year}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Pressable style={styles.addButton} onPress={onAdd}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      {records.length === 0 ? (
        <View style={styles.emptyFeatureCard}>
          <Text style={styles.emptyFeatureTitle}>Nothing here yet</Text>
          <Text style={styles.emptyFeatureText}>Add your first wishlist item above.</Text>
        </View>
      ) : (
        records.map((record: RecordItem) => (
          <View key={record.id} style={styles.recordCard}>
            <Pressable style={{ flex: 1 }} onPress={() => onViewRecord?.(record)}>
              <View style={styles.cardInfo}>
                <AlbumArt uri={record.cover} style={styles.cover} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.albumTitle}>{record.album}</Text>
                  <Text style={styles.artistName}>{record.artist}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.genrePill}>{record.genre}</Text>
                    <Text style={styles.yearText}>{record.year}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
            <View style={styles.cardActions}>
              <Pressable style={styles.foundButton} onPress={() => onFound(record)}>
                <Text style={styles.foundText}>Found</Text>
              </Pressable>
              <Pressable style={styles.removeButton} onPress={() => onRemove(record)}>
                <Text style={styles.removeText}>Remove</Text>
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
  addPanel: {
    marginBottom: 26,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#1A1830",
    borderWidth: 1,
    borderColor: "#3E3B5C",
    borderRadius: 8,
    padding: 12,
    color: "#FFF4D6",
    fontSize: 14,
    marginBottom: 12,
  },
  albumInput: {
    flex: 1,
  },
  searchButton: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
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
  searchMessage: {
    color: "#D4AF37",
    fontSize: 13,
    marginBottom: 12,
  },
  selectedCard: {
    backgroundColor: "#1A1830",
    borderWidth: 1,
    borderColor: "#7C3AED",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  selectedLabel: {
    color: "#A7A1BD",
    fontSize: 12,
    marginBottom: 4,
  },
  selectedTitle: {
    color: "#FFF4D6",
    fontSize: 15,
    fontWeight: "600",
  },
  selectedArtist: {
    color: "#A7A1BD",
    fontSize: 13,
    marginTop: 4,
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
  resultsList: {
    marginBottom: 12,
  },
  resultCard: {
    flexDirection: "row",
    backgroundColor: "#1A1830",
    borderWidth: 1,
    borderColor: "#3E3B5C",
    borderRadius: 8,
    padding: 8,
    gap: 8,
    marginBottom: 8,
  },
  resultCover: {
    width: 50,
    height: 50,
    borderRadius: 6,
  },
  resultTitle: {
    color: "#FFF4D6",
    fontSize: 13,
    fontWeight: "600",
  },
  resultArtist: {
    color: "#A7A1BD",
    fontSize: 12,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: "#7C3AED",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: {
    color: "#FFF4D6",
    fontSize: 16,
    fontWeight: "700",
  },
  recordCard: {
    flexDirection: "row",
    backgroundColor: "#1A1830",
    borderWidth: 1,
    borderColor: "#3E3B5C",
    borderRadius: 8,
    padding: 12,
    gap: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  cardInfo: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    flex: 1,
  },
  cover: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  albumTitle: {
    color: "#FFF4D6",
    fontSize: 14,
    fontWeight: "600",
  },
  artistName: {
    color: "#A7A1BD",
    fontSize: 12,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  foundButton: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  foundText: {
    color: "#FFF4D6",
    fontSize: 12,
    fontWeight: "600",
  },
  removeButton: {
    backgroundColor: "#3E3B5C",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
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
