import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBar } from "../components/TopBar";
import { RecordQuestTheme } from "../constants/theme";
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

type ListSort = "recent" | "artist" | "title" | "year-newest" | "year-oldest";
type SearchFormatFilter = "all" | "album" | "ep" | "single";
type SearchResultSort = "relevance" | "year-newest" | "year-oldest";

const DEFAULT_COVER = "https://upload.wikimedia.org/wikipedia/commons/3/3c/No-album-art.png";

function parseYear(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  const year = Number.parseInt(trimmed, 10);
  return Number.isFinite(year) ? year : null;
}

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
  const insets = useSafeAreaInsets();
  const [libraryQuery, setLibraryQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeRowMenuId, setActiveRowMenuId] = useState<number | null>(null);
  const [listSort, setListSort] = useState<ListSort>("recent");
  const [genreFilter, setGenreFilter] = useState("All");
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [searchFormatFilter, setSearchFormatFilter] = useState<SearchFormatFilter>("all");
  const [searchResultSort, setSearchResultSort] = useState<SearchResultSort>("relevance");

  const accentColor = isWishlist ? "#EC4899" : RecordQuestTheme.colors.accent;
  const accentBorderColor = isWishlist ? "rgba(236, 72, 153, 0.40)" : RecordQuestTheme.colors.borderStrong;

  const suggestionsAnimation = useRef(new Animated.Value(0)).current;
  const filterSheetAnimation = useRef(new Animated.Value(0)).current;
  const addSheetAnimation = useRef(new Animated.Value(0)).current;

  const genreOptions = useMemo(() => {
    const values = new Set<string>();
    for (const item of records) {
      const genre = item.genre?.trim();
      if (genre) values.add(genre);
    }

    return ["All", ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [records]);

  const displayedRecords = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    const minYear = parseYear(yearMin);
    const maxYear = parseYear(yearMax);

    let next = records.filter((record) => {
      const matchesQuery =
        query.length === 0 ||
        record.album.toLowerCase().includes(query) ||
        record.artist.toLowerCase().includes(query);

      const matchesGenre = genreFilter === "All" || record.genre === genreFilter;

      const recordYear = parseYear(record.year);
      const matchesMinYear = minYear === null || (recordYear !== null && recordYear >= minYear);
      const matchesMaxYear = maxYear === null || (recordYear !== null && recordYear <= maxYear);

      return matchesQuery && matchesGenre && matchesMinYear && matchesMaxYear;
    });

    next = [...next].sort((a, b) => {
      if (listSort === "recent") {
        const aDate = Date.parse(a.added_at ?? "");
        const bDate = Date.parse(b.added_at ?? "");
        const aKey = Number.isNaN(aDate) ? Number(a.id) : aDate;
        const bKey = Number.isNaN(bDate) ? Number(b.id) : bDate;
        return bKey - aKey;
      }

      if (listSort === "artist") {
        return a.artist.localeCompare(b.artist);
      }

      if (listSort === "title") {
        return a.album.localeCompare(b.album);
      }

      const aYear = parseYear(a.year) ?? 0;
      const bYear = parseYear(b.year) ?? 0;

      if (listSort === "year-newest") {
        return bYear - aYear;
      }

      return aYear - bYear;
    });

    return next;
  }, [records, libraryQuery, genreFilter, yearMin, yearMax, listSort]);

  const displayedSuggestions = useMemo(() => {
    const base = selectedMetadata ? [] : [...searchResults];

    let next = base;
    if (searchFormatFilter !== "all") {
      next = next.filter((result) => {
        const format = (result.format ?? "").toLowerCase();
        return format === searchFormatFilter;
      });
    }

    if (searchResultSort === "year-newest") {
      next = [...next].sort((a, b) => (parseYear(b.year) ?? 0) - (parseYear(a.year) ?? 0));
    }

    if (searchResultSort === "year-oldest") {
      next = [...next].sort((a, b) => (parseYear(a.year) ?? 0) - (parseYear(b.year) ?? 0));
    }

    return next.slice(0, 8);
  }, [searchResults, selectedMetadata, searchFormatFilter, searchResultSort]);

  useEffect(() => {
    Animated.timing(suggestionsAnimation, {
      toValue: displayedSuggestions.length > 0 ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [displayedSuggestions.length, suggestionsAnimation]);

  useEffect(() => {
    Animated.timing(filterSheetAnimation, {
      toValue: isFilterOpen ? 1 : 0,
      duration: 210,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isFilterOpen, filterSheetAnimation]);

  useEffect(() => {
    Animated.timing(addSheetAnimation, {
      toValue: isAddOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isAddOpen, addSheetAnimation]);

  const suggestionsOpacity = suggestionsAnimation;
  const suggestionsTranslate = suggestionsAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  const sheetTranslateY = filterSheetAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [220, 0],
  });

  const addSheetTranslateY = addSheetAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [260, 0],
  });

  const listSortLabel =
    listSort === "recent"
      ? "Recently Added"
      : listSort === "artist"
        ? "Artist A-Z"
        : listSort === "title"
          ? "Title A-Z"
          : listSort === "year-newest"
            ? "Year Newest"
            : "Year Oldest";

  const localListPlaceholder = isWishlist ? "Search wishlist" : "Search your collection";
  const listBottomPadding = 220 + Math.max(insets.bottom, 10);
  const floatingButtonBottom = 78 + Math.max(insets.bottom, 10);
  const showOptionalAddFields = !!selectedMetadata;
  const shouldShowSearchControls = album.trim().length > 0 || isSearching || displayedSuggestions.length > 0;

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingBottom: listBottomPadding }]}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setActiveRowMenuId(null)}
      >
        <TopBar title={title} back={back} />
        <Text style={styles.screenSubtitle}>{subtitle}</Text>

        <TextInput
          style={styles.collectionSearchInput}
          placeholder={localListPlaceholder}
          placeholderTextColor={RecordQuestTheme.colors.textMuted}
          value={libraryQuery}
          onChangeText={setLibraryQuery}
        />

        <View style={styles.collectionMetaRow}>
          <Text style={styles.collectionCountText}>
            {displayedRecords.length} {isWishlist ? "Items" : "Records"}
          </Text>
          <View style={styles.collectionMetaActions}>
            <Text style={styles.currentSortText}>{listSortLabel}</Text>
            <Pressable
              style={({ pressed }) => [styles.filterButton, pressed ? styles.cardPressed : null]}
              onPress={() => setIsFilterOpen(true)}
            >
              <Text style={styles.filterButtonText}>Filters</Text>
            </Pressable>
          </View>
        </View>

        {displayedRecords.length === 0 ? (
          <View style={styles.emptyFeatureCard}>
            <Text style={styles.emptyFeatureTitle}>No records match current filters</Text>
            <Text style={styles.emptyFeatureText}>Adjust search or filters to see more albums.</Text>
          </View>
        ) : (
          displayedRecords.map((record: RecordItem) => (
            <View key={record.id} style={styles.recordCard}>
              <Pressable
                style={({ pressed }) => [styles.recordCardPressable, pressed ? styles.cardPressed : null]}
                onPress={() => {
                  setActiveRowMenuId(null);
                  onViewRecord?.(record);
                }}
              >
                <View style={styles.cardInfo}>
                  <Image source={{ uri: record.cover || DEFAULT_COVER }} style={styles.cover} />
                  <View style={styles.recordTextWrap}>
                    <Text style={styles.albumTitle} numberOfLines={1}>
                      {record.album}
                    </Text>
                    <Text style={styles.artistName} numberOfLines={1}>
                      {record.artist}
                    </Text>
                    <View style={styles.metaRow}>
                      {record.year && record.year !== "Unknown" ? (
                        <Text style={styles.yearText}>{record.year}</Text>
                      ) : null}
                      {record.genre ? <Text style={styles.genrePill}>{record.genre}</Text> : null}
                    </View>
                    {!isWishlist && record.purchasedAt ? (
                      <Text style={styles.purchaseText} numberOfLines={1}>
                        Purchased at {record.purchasedAt}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.rowActionWrap}>
                    {isWishlist && onFound ? (
                      <Pressable
                        style={({ pressed }) => [
                          styles.foundButton,
                          styles.foundButtonWishlist,
                          pressed ? styles.cardPressed : null,
                        ]}
                        onPress={() => {
                          setActiveRowMenuId(null);
                          onFound(record);
                        }}
                      >
                        <Text style={styles.foundText}>Found</Text>
                      </Pressable>
                    ) : null}

                    <Pressable
                      style={({ pressed }) => [styles.overflowButton, pressed ? styles.cardPressed : null]}
                      onPress={() => setActiveRowMenuId((current) => (current === record.id ? null : record.id))}
                    >
                      <Text style={styles.overflowText}>•••</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>

              {activeRowMenuId === record.id ? (
                <View style={styles.rowMenuCard}>
                  <Pressable
                    style={({ pressed }) => [styles.rowMenuAction, pressed ? styles.cardPressed : null]}
                    onPress={() => {
                      setActiveRowMenuId(null);
                      onViewRecord?.(record);
                    }}
                  >
                    <Text style={styles.rowMenuActionText}>View Details</Text>
                  </Pressable>

                  {onRemove ? (
                    <Pressable
                      style={({ pressed }) => [styles.rowMenuAction, pressed ? styles.cardPressed : null]}
                      onPress={() => {
                        setActiveRowMenuId(null);
                        onRemove(record);
                      }}
                    >
                      <Text style={[styles.rowMenuActionText, styles.rowMenuDangerText]}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <Pressable
        style={({ pressed }) => [
          styles.fabButton,
          { backgroundColor: accentColor, bottom: floatingButtonBottom },
          pressed ? styles.cardPressed : null,
        ]}
        onPress={() => setIsAddOpen(true)}
      >
        <Text style={styles.fabButtonText}>{isWishlist ? "Add to Wishlist" : "Add Record"}</Text>
      </Pressable>

      <Modal transparent visible={isFilterOpen} animationType="fade" onRequestClose={() => setIsFilterOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={styles.backdropTapTarget} onPress={() => setIsFilterOpen(false)} />
          <Animated.View style={[styles.sheetCard, { transform: [{ translateY: sheetTranslateY }] }]}> 
              <Text style={styles.sheetTitle}>Filters</Text>
              <Text style={styles.sheetSubtitle}>Sort and narrow your {isWishlist ? "wishlist" : "collection"}.</Text>

              <Text style={styles.sheetSectionLabel}>Sort</Text>
              <View style={styles.optionWrapRow}>
                {[
                  { value: "recent", label: "Recently Added" },
                  { value: "artist", label: "Artist A-Z" },
                  { value: "title", label: "Title A-Z" },
                  { value: "year-newest", label: "Year Newest" },
                  { value: "year-oldest", label: "Year Oldest" },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.optionChip,
                      listSort === option.value ? styles.optionChipActive : null,
                    ]}
                    onPress={() => setListSort(option.value as ListSort)}
                  >
                    <Text style={[styles.optionChipText, listSort === option.value ? styles.optionChipTextActive : null]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.sheetSectionLabel}>Genre</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionHorizontalRow}>
                {genreOptions.map((genre) => (
                  <Pressable
                    key={genre}
                    style={[styles.optionChip, genreFilter === genre ? styles.optionChipActive : null]}
                    onPress={() => setGenreFilter(genre)}
                  >
                    <Text style={[styles.optionChipText, genreFilter === genre ? styles.optionChipTextActive : null]}>
                      {genre}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.sheetSectionLabel}>Year Range</Text>
              <View style={styles.yearRow}>
                <TextInput
                  style={styles.yearInput}
                  placeholder="From"
                  placeholderTextColor={RecordQuestTheme.colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={yearMin}
                  onChangeText={setYearMin}
                />
                <TextInput
                  style={styles.yearInput}
                  placeholder="To"
                  placeholderTextColor={RecordQuestTheme.colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={yearMax}
                  onChangeText={setYearMax}
                />
              </View>

              <View style={styles.sheetActionsRow}>
                <Pressable
                  style={styles.sheetSecondaryButton}
                  onPress={() => {
                    setListSort("recent");
                    setGenreFilter("All");
                    setYearMin("");
                    setYearMax("");
                  }}
                >
                  <Text style={styles.sheetSecondaryButtonText}>Reset</Text>
                </Pressable>
                <Pressable style={styles.sheetPrimaryButton} onPress={() => setIsFilterOpen(false)}>
                  <Text style={styles.sheetPrimaryButtonText}>Done</Text>
                </Pressable>
              </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal transparent visible={isAddOpen} animationType="fade" onRequestClose={() => setIsAddOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={styles.backdropTapTarget} onPress={() => setIsAddOpen(false)} />
          <Animated.View style={[styles.addSheetCard, { transform: [{ translateY: addSheetTranslateY }] }]}> 
              <View style={styles.addSheetHeaderRow}>
                <View>
                  <Text style={styles.sheetTitle}>{isWishlist ? "Add Wishlist Item" : "Add Record"}</Text>
                  <Text style={styles.sheetSubtitle}>Search MusicBrainz and confirm album details.</Text>
                </View>
                <Pressable style={styles.sheetClosePill} onPress={() => setIsAddOpen(false)}>
                  <Text style={styles.sheetClosePillText}>Cancel</Text>
                </Pressable>
              </View>

              <View style={styles.searchRow}>
                <TextInput
                  style={[styles.input, styles.albumInput]}
                  placeholder="Search albums or artists"
                  placeholderTextColor={RecordQuestTheme.colors.textMuted}
                  value={album}
                  onChangeText={onAlbumChange}
                  returnKeyType="search"
                  onSubmitEditing={onSearch}
                />
                <Pressable
                  style={[styles.searchButton, { backgroundColor: accentColor, borderColor: accentBorderColor }]}
                  onPress={onSearch}
                >
                  <Text style={styles.searchButtonText}>Search</Text>
                </Pressable>
              </View>

              {shouldShowSearchControls ? (
                <>
                  <Text style={styles.sheetSectionLabel}>Search Filters</Text>
                  <View style={styles.optionWrapRow}>
                    {[
                      { value: "all", label: "All" },
                      { value: "album", label: "Album" },
                      { value: "ep", label: "EP" },
                      { value: "single", label: "Single" },
                    ].map((option) => (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.optionChip,
                          searchFormatFilter === option.value ? styles.optionChipActive : null,
                        ]}
                        onPress={() => setSearchFormatFilter(option.value as SearchFormatFilter)}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            searchFormatFilter === option.value ? styles.optionChipTextActive : null,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.optionWrapRow}>
                    {[
                      { value: "relevance", label: "Relevance" },
                      { value: "year-newest", label: "Year Newest" },
                      { value: "year-oldest", label: "Year Oldest" },
                    ].map((option) => (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.optionChip,
                          searchResultSort === option.value ? styles.optionChipActive : null,
                        ]}
                        onPress={() => setSearchResultSort(option.value as SearchResultSort)}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            searchResultSort === option.value ? styles.optionChipTextActive : null,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              {album.trim().length === 0 ? (
                <View style={styles.searchEmptyState}>
                  <Text style={styles.searchEmptyTitle}>Start your search</Text>
                  <Text style={styles.searchEmptyText}>Enter album title or artist to fetch real MusicBrainz results.</Text>
                </View>
              ) : null}

              {isSearching ? (
                <View style={styles.searchStatusRow}>
                  <ActivityIndicator color={RecordQuestTheme.colors.accent} size="small" />
                  <Text style={styles.searchStatusText}>Searching...</Text>
                </View>
              ) : null}

              {!isSearching && searchMessage ? <Text style={styles.panelHintText}>{searchMessage}</Text> : null}

              {displayedSuggestions.length > 0 ? (
                <Animated.View
                  style={[
                    styles.dropdownCard,
                    {
                      opacity: suggestionsOpacity,
                      transform: [{ translateY: suggestionsTranslate }],
                    },
                  ]}
                >
                  {displayedSuggestions.map((result: AlbumSearchResult) => (
                    <Pressable
                      key={result.id}
                      style={({ pressed }) => [styles.resultCard, pressed ? styles.cardPressed : null]}
                      onPress={() => onSelectResult(result)}
                    >
                      <Image source={{ uri: result.cover || DEFAULT_COVER }} style={styles.resultCover} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultTitle} numberOfLines={1}>
                          {result.album}
                        </Text>
                        <Text style={styles.resultArtist} numberOfLines={1}>
                          {result.artist}
                        </Text>
                        <View style={styles.metaRow}>
                          {result.year && result.year !== "Unknown" ? <Text style={styles.yearText}>{result.year}</Text> : null}
                          {result.format ? <Text style={styles.searchFormatPill}>{result.format}</Text> : null}
                          {result.genre ? <Text style={styles.genrePill}>{result.genre}</Text> : null}
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </Animated.View>
              ) : null}

              {selectedMetadata ? (
                <View style={[styles.selectedCard, { borderColor: accentBorderColor }]}> 
                  <View style={styles.selectedContentRow}>
                    <Image
                      source={{
                        uri: selectedMetadata.cover || DEFAULT_COVER,
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
                        {selectedMetadata.format ? <Text style={styles.searchFormatPill}>{selectedMetadata.format}</Text> : null}
                        {selectedMetadata.genre ? <Text style={styles.genrePill}>{selectedMetadata.genre}</Text> : null}
                      </View>
                      <Text style={styles.selectedHelperText}>Selected release will be added to your library.</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {showOptionalAddFields ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Artist (optional)"
                    placeholderTextColor={RecordQuestTheme.colors.textMuted}
                    value={artist}
                    onChangeText={onArtistChange}
                  />

                  {!isWishlist ? (
                    <TextInput
                      style={styles.input}
                      placeholder="Purchased at (optional)"
                      placeholderTextColor={RecordQuestTheme.colors.textMuted}
                      value={purchasedAt}
                      onChangeText={setPurchasedAt}
                    />
                  ) : null}
                </>
              ) : null}

              {addFormMessage ? <Text style={styles.addFormMessage}>{addFormMessage}</Text> : null}

              <Pressable
                style={[styles.addButton, { backgroundColor: accentColor, borderColor: accentBorderColor }]}
                onPress={onAdd}
              >
                <Text style={styles.addButtonText}>{isWishlist ? "Add to Wishlist" : "Add to Collection"}</Text>
              </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: RecordQuestTheme.colors.bg,
  },
  page: {
    paddingHorizontal: RecordQuestTheme.spacing.pageHorizontal,
    paddingTop: RecordQuestTheme.spacing.pageVertical,
    paddingBottom: 150,
    backgroundColor: RecordQuestTheme.colors.bg,
  },
  screenSubtitle: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 20,
  },
  collectionSearchInput: {
    backgroundColor: RecordQuestTheme.colors.bgElevated,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    borderRadius: RecordQuestTheme.radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 14,
    marginBottom: 10,
  },
  collectionMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  collectionCountText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  collectionMetaActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currentSortText: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  filterButton: {
    backgroundColor: RecordQuestTheme.colors.bgElevated,
    borderColor: RecordQuestTheme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterButtonText: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  fabButton: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 84,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  fabButtonText: {
    color: "#F8F2FF",
    fontSize: 15,
    fontWeight: "800",
  },
  recordCard: {
    backgroundColor: RecordQuestTheme.colors.bgCard,
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.10)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  recordCardPressable: {
    borderRadius: 12,
  },
  cardPressed: {
    opacity: 0.86,
  },
  cardInfo: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    flex: 1,
  },
  cover: {
    width: 78,
    height: 78,
    borderRadius: 12,
    backgroundColor: "#26283A",
    flexShrink: 0,
  },
  recordTextWrap: {
    flex: 1,
    minHeight: 78,
    justifyContent: "center",
  },
  albumTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  artistName: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  purchaseText: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 7,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  genrePill: {
    color: "#D7C8FB",
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "rgba(139, 92, 246, 0.16)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: "hidden",
  },
  searchFormatPill: {
    color: "#F2D48A",
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "rgba(245, 158, 11, 0.16)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: "hidden",
  },
  yearText: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  rowActionWrap: {
    alignItems: "flex-end",
    gap: 8,
    justifyContent: "space-between",
    minHeight: 78,
  },
  overflowButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  overflowText: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "700",
  },
  foundButton: {
    backgroundColor: "rgba(236, 72, 153, 0.14)",
    borderColor: "rgba(236, 72, 153, 0.42)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  foundButtonWishlist: {
    backgroundColor: "rgba(236, 72, 153, 0.14)",
    borderColor: "rgba(236, 72, 153, 0.42)",
  },
  foundText: {
    color: "#FCE7F3",
    fontSize: 11,
    fontWeight: "700",
  },
  rowMenuCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.12)",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(7, 8, 12, 0.96)",
  },
  rowMenuAction: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(248, 238, 220, 0.08)",
  },
  rowMenuActionText: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  rowMenuDangerText: {
    color: "#FCA5A5",
  },
  emptyFeatureCard: {
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    borderRadius: 16,
    padding: 22,
    alignItems: "center",
    marginTop: 10,
    backgroundColor: RecordQuestTheme.colors.bgCard,
  },
  emptyFeatureTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  emptyFeatureText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: 6,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.56)",
    justifyContent: "flex-end",
  },
  backdropTapTarget: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetCard: {
    backgroundColor: "#0F1118",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    padding: 18,
    paddingBottom: 28,
  },
  addSheetCard: {
    backgroundColor: "#0F1118",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    padding: 18,
    paddingBottom: 28,
    maxHeight: "84%",
  },
  sheetTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  sheetSubtitle: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  sheetSectionLabel: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 8,
  },
  optionWrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionHorizontalRow: {
    gap: 8,
    paddingBottom: 4,
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.12)",
    backgroundColor: RecordQuestTheme.colors.bgElevated,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  optionChipActive: {
    borderColor: RecordQuestTheme.colors.borderStrong,
    backgroundColor: "rgba(139, 92, 246, 0.18)",
  },
  optionChipText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  optionChipTextActive: {
    color: RecordQuestTheme.colors.textPrimary,
  },
  yearRow: {
    flexDirection: "row",
    gap: 10,
  },
  yearInput: {
    flex: 1,
    backgroundColor: RecordQuestTheme.colors.bgElevated,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    borderRadius: 12,
    color: RecordQuestTheme.colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  sheetActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  sheetPrimaryButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: RecordQuestTheme.colors.accent,
  },
  sheetPrimaryButtonText: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  sheetSecondaryButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    backgroundColor: RecordQuestTheme.colors.bgElevated,
  },
  sheetSecondaryButtonText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  addSheetHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  sheetClosePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    backgroundColor: RecordQuestTheme.colors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sheetClosePillText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    marginTop: 2,
  },
  input: {
    backgroundColor: RecordQuestTheme.colors.bgElevated,
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    borderRadius: 12,
    padding: 12,
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 13,
    marginBottom: 10,
  },
  albumInput: {
    flex: 1,
  },
  searchButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
  },
  searchButtonText: {
    color: RecordQuestTheme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 13,
  },
  searchEmptyState: {
    borderWidth: 1,
    borderColor: RecordQuestTheme.colors.border,
    borderRadius: 12,
    backgroundColor: RecordQuestTheme.colors.bgCard,
    padding: 12,
    marginTop: 6,
  },
  searchEmptyTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  searchEmptyText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  searchStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 8,
  },
  searchStatusText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 12,
  },
  panelHintText: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  dropdownCard: {
    marginTop: 8,
    marginBottom: 8,
  },
  resultCard: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 17, 24, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.10)",
    borderRadius: 12,
    padding: 11,
    gap: 10,
    marginBottom: 10,
  },
  resultCover: {
    width: 66,
    height: 66,
    borderRadius: 10,
    backgroundColor: "#26283A",
  },
  resultTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  resultArtist: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  selectedCard: {
    backgroundColor: RecordQuestTheme.colors.bgCard,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    marginTop: 4,
  },
  selectedContentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectedCover: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: "#26283A",
  },
  selectedTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  selectedArtist: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  selectedHelperText: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 6,
  },
  addFormMessage: {
    color: "#FFD9E8",
    fontSize: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(236, 72, 153, 0.36)",
    backgroundColor: "rgba(236, 72, 153, 0.16)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addButton: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    marginTop: 4,
  },
  addButtonText: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
});
