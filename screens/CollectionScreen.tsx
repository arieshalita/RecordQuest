import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  FlatList,
  Text,
  View,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlbumArt } from "../components/AlbumArt";
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
  onClearSelectedMetadata: () => void;
  onAdd: () => Promise<boolean>;
  back: () => void;
  onFound?: (record: RecordItem) => void;
  onRemove?: (record: RecordItem) => void;
  onViewRecord: (record: RecordItem) => void;
  isWishlist?: boolean;
  recordArtworkSource?: "supabase" | "search-result" | "release-lookup" | "release-group-lookup" | "unknown";
};

type ListSort = "recent" | "artist" | "title" | "year-newest" | "year-oldest";
type SearchFormatFilter = "all" | "album" | "ep" | "single";
type SearchResultSort = "relevance" | "year-newest" | "year-oldest";

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
  onClearSelectedMetadata,
  onAdd,
  back,
  onFound,
  onRemove,
  onViewRecord,
  isWishlist = false,
  recordArtworkSource = "unknown",
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
  const addSearchInputRef = useRef<TextInput | null>(null);
  const [isSavingAdd, setIsSavingAdd] = useState(false);

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
  const hasSearchQuery = album.trim().length > 0;
  const showNoResultsState = hasSearchQuery && !isSearching && displayedSuggestions.length === 0 && !!searchMessage && !selectedMetadata;

  function closeAddSheet() {
    if (isSavingAdd) {
      return;
    }

    setIsAddOpen(false);
  }

  function handleSelectResult(result: AlbumSearchResult) {
    Keyboard.dismiss();
    onSelectResult(result);
  }

  function handleChangeSelection() {
    onClearSelectedMetadata();
    setTimeout(() => {
      addSearchInputRef.current?.focus();
    }, 50);
  }

  async function handleAdd() {
    if (isSavingAdd) {
      return;
    }

    setIsSavingAdd(true);

    try {
      const didAdd = await onAdd();
      if (didAdd) {
        Keyboard.dismiss();
        setIsAddOpen(false);
      }
    } finally {
      setIsSavingAdd(false);
    }
  }

  const searchResultsSection = selectedMetadata ? null : (
    <View style={styles.addSearchResultsSection}>
      {album.trim().length === 0 ? (
        <View style={styles.searchPlaceholderState}>
          <Text style={styles.searchPlaceholderTitle}>Start with a search</Text>
          <Text style={styles.searchPlaceholderText}>Search for an album title or artist to pull in release details and artwork.</Text>
        </View>
      ) : null}

      {isSearching ? (
        <View style={styles.searchLoadingCard}>
          <ActivityIndicator color={RecordQuestTheme.colors.accent} size="small" />
          <Text style={styles.searchLoadingText}>Searching albums…</Text>
        </View>
      ) : null}

      {displayedSuggestions.length > 0 ? (
        <Animated.View
          style={[
            styles.resultsListWrap,
            {
              opacity: suggestionsOpacity,
              transform: [{ translateY: suggestionsTranslate }],
            },
          ]}
        >
          <FlatList
            data={displayedSuggestions}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.resultsListContent}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.resultCard, pressed ? styles.cardPressed : null]}
                onPress={() => handleSelectResult(item)}
              >
                <AlbumArt
                  uri={item.cover}
                  style={styles.resultCover}
                  debugScreen={isWishlist ? "wishlist" : "owner-collection"}
                  debugRecordId={item.id}
                  debugAlbum={item.album}
                  debugArtist={item.artist}
                  debugUriSource="search-result"
                />
                <View style={styles.resultBody}>
                  <Text style={styles.resultTitle} numberOfLines={2}>
                    {item.album}
                  </Text>
                  <Text style={styles.resultArtist} numberOfLines={1}>
                    {item.artist}
                  </Text>
                  <View style={styles.metaRow}>
                    {item.year && item.year !== "Unknown" ? <Text style={styles.yearText}>{item.year}</Text> : null}
                    {item.format ? <Text style={styles.searchFormatPill}>{item.format}</Text> : null}
                    {item.genre ? <Text style={styles.genrePill}>{item.genre}</Text> : null}
                  </View>
                </View>
              </Pressable>
            )}
          />
        </Animated.View>
      ) : null}

      {showNoResultsState ? (
        <View style={styles.searchEmptyStateCard}>
          <Text style={styles.searchEmptyTitle}>No results found</Text>
          <Text style={styles.searchEmptyText}>Try an artist name, album title, or a different spelling.</Text>
        </View>
      ) : null}

      {!isSearching && !showNoResultsState && searchMessage ? <Text style={styles.panelHintText}>{searchMessage}</Text> : null}
    </View>
  );

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
                  <AlbumArt
                    uri={record.cover}
                    style={styles.cover}
                    debugScreen={isWishlist ? "wishlist" : "owner-collection"}
                    debugRecordId={record.id}
                    debugAlbum={record.album}
                    debugArtist={record.artist}
                    debugUriSource={recordArtworkSource}
                  />
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

      <Modal transparent visible={isAddOpen} animationType="fade" onRequestClose={closeAddSheet}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={styles.backdropTapTarget} onPress={closeAddSheet} />
          <KeyboardAvoidingView
            style={styles.addSheetKeyboardWrap}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Math.max(insets.bottom, 8)}
          >
            <Animated.View
              style={[
                styles.addSheetCard,
                {
                  transform: [{ translateY: addSheetTranslateY }],
                  paddingBottom: 18 + Math.max(insets.bottom, 8),
                },
              ]}
            >
              <View style={styles.addSheetHeaderRow}>
                <View style={styles.addSheetHeaderTextWrap}>
                  <Text style={styles.sheetTitle}>{isWishlist ? "Add Wishlist Item" : "Add Record"}</Text>
                  <Text style={styles.sheetSubtitle}>Search for an album or artist to get started.</Text>
                </View>
                <Pressable style={styles.sheetClosePill} onPress={closeAddSheet}>
                  <Text style={styles.sheetClosePillText}>Close</Text>
                </Pressable>
              </View>

              <View style={styles.addSearchCard}>
                <View style={styles.searchInputRow}>
                  <Text style={styles.searchLeadIcon}>⌕</Text>
                  <TextInput
                    ref={addSearchInputRef}
                    style={styles.addSearchInput}
                    placeholder="Search albums or artists"
                    placeholderTextColor={RecordQuestTheme.colors.textMuted}
                    value={album}
                    onChangeText={onAlbumChange}
                    returnKeyType="search"
                    onSubmitEditing={onSearch}
                  />
                  {hasSearchQuery ? (
                    <Pressable
                      style={styles.searchClearButton}
                      onPress={() => {
                        onAlbumChange("");
                        onClearSelectedMetadata();
                      }}
                    >
                      <Text style={styles.searchClearButtonText}>Clear</Text>
                    </Pressable>
                  ) : null}
                </View>

                {shouldShowSearchControls && !selectedMetadata ? (
                  <View style={styles.searchControlsWrap}>
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
                  </View>
                ) : null}
              </View>

              {searchResultsSection}

              {selectedMetadata ? (
                <>
                  <ScrollView
                    style={styles.selectedDetailsScroll}
                    contentContainerStyle={styles.selectedDetailsContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={[styles.selectedCard, { borderColor: accentBorderColor }]}> 
                      <View style={styles.selectedCardHeader}>
                        <Text style={styles.selectedCardEyebrow}>Selected album</Text>
                        <Pressable style={styles.changeSelectionButton} onPress={handleChangeSelection}>
                          <Text style={styles.changeSelectionButtonText}>Change</Text>
                        </Pressable>
                      </View>
                      <View style={styles.selectedContentRow}>
                        <AlbumArt
                          uri={selectedMetadata.cover}
                          style={styles.selectedCover}
                          debugScreen={isWishlist ? "wishlist" : "owner-collection"}
                          debugRecordId={selectedMetadata.id}
                          debugAlbum={selectedMetadata.album}
                          debugArtist={selectedMetadata.artist}
                          debugUriSource="search-result"
                        />
                        <View style={styles.selectedInfoWrap}>
                          <Text style={styles.selectedTitle}>{selectedMetadata.album}</Text>
                          <Text style={styles.selectedArtist}>{selectedMetadata.artist}</Text>
                          <View style={styles.metaRow}>
                            {selectedMetadata.year && selectedMetadata.year !== "Unknown" ? (
                              <Text style={styles.yearText}>{selectedMetadata.year}</Text>
                            ) : null}
                            {selectedMetadata.format ? <Text style={styles.searchFormatPill}>{selectedMetadata.format}</Text> : null}
                            {selectedMetadata.genre ? <Text style={styles.genrePill}>{selectedMetadata.genre}</Text> : null}
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={styles.optionalSectionCard}>
                      <Text style={styles.optionalSectionTitle}>Optional details</Text>
                      <Text style={styles.optionalSectionSubtitle}>Add your own notes before saving this record.</Text>

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
                    </View>

                    {addFormMessage ? <Text style={styles.addFormMessage}>{addFormMessage}</Text> : null}
                  </ScrollView>

                  <View style={styles.addActionFooter}>
                    <Pressable
                      style={[
                        styles.addButton,
                        { backgroundColor: accentColor, borderColor: accentBorderColor },
                        isSavingAdd ? styles.addButtonDisabled : null,
                      ]}
                      onPress={handleAdd}
                      disabled={isSavingAdd}
                    >
                      {isSavingAdd ? (
                        <View style={styles.addButtonLoadingRow}>
                          <ActivityIndicator size="small" color={RecordQuestTheme.colors.textPrimary} />
                          <Text style={styles.addButtonText}>{isWishlist ? "Saving to Wishlist…" : "Adding to Collection…"}</Text>
                        </View>
                      ) : (
                        <Text style={styles.addButtonText}>{isWishlist ? "Add to Wishlist" : "Add to Collection"}</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              ) : null}
            </Animated.View>
          </KeyboardAvoidingView>
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
    fontSize: 14,
    marginBottom: 14,
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
    borderRadius: 18,
    padding: 24,
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
    maxHeight: "88%",
    minHeight: "58%",
  },
  addSheetKeyboardWrap: {
    flex: 1,
    justifyContent: "flex-end",
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
    marginBottom: 14,
  },
  addSheetHeaderTextWrap: {
    flex: 1,
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
  addSearchCard: {
    backgroundColor: RecordQuestTheme.colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.08)",
    padding: 12,
    marginBottom: 12,
  },
  searchInputRow: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: RecordQuestTheme.colors.bgElevated,
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.10)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  searchLeadIcon: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 17,
    fontWeight: "700",
  },
  addSearchInput: {
    flex: 1,
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 16,
    paddingVertical: 14,
  },
  searchClearButton: {
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchClearButtonText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  searchControlsWrap: {
    gap: 8,
    marginTop: 10,
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
  addSearchResultsSection: {
    flex: 1,
    minHeight: 180,
  },
  searchPlaceholderState: {
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.08)",
    borderRadius: 16,
    backgroundColor: RecordQuestTheme.colors.bgCard,
    padding: 16,
  },
  searchPlaceholderTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  searchPlaceholderText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  searchLoadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: RecordQuestTheme.colors.bgCard,
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.08)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchLoadingText: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  resultsListWrap: {
    flex: 1,
    minHeight: 160,
  },
  resultsListContent: {
    paddingTop: 4,
    paddingBottom: 8,
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
  searchEmptyStateCard: {
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.08)",
    borderRadius: 16,
    backgroundColor: RecordQuestTheme.colors.bgCard,
    padding: 16,
    marginTop: 8,
  },
  resultCard: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 17, 24, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.10)",
    borderRadius: 16,
    padding: 12,
    gap: 10,
    marginBottom: 10,
  },
  resultCover: {
    width: 78,
    height: 78,
    borderRadius: 12,
    backgroundColor: "#26283A",
  },
  resultBody: {
    flex: 1,
    justifyContent: "center",
  },
  resultTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
  },
  resultArtist: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  selectedDetailsScroll: {
    flex: 1,
    minHeight: 0,
  },
  selectedDetailsContent: {
    paddingBottom: 12,
  },
  selectedCard: {
    backgroundColor: RecordQuestTheme.colors.bgCard,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    marginTop: 4,
  },
  selectedCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  selectedCardEyebrow: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  changeSelectionButton: {
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  changeSelectionButtonText: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  selectedContentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  selectedCover: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: "#26283A",
  },
  selectedInfoWrap: {
    flex: 1,
  },
  selectedTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22,
  },
  selectedArtist: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  selectedHelperText: {
    color: RecordQuestTheme.colors.textMuted,
    fontSize: 11,
    marginTop: 6,
  },
  optionalSectionCard: {
    backgroundColor: RecordQuestTheme.colors.bgCard,
    borderWidth: 1,
    borderColor: "rgba(248, 238, 220, 0.08)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  optionalSectionTitle: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  optionalSectionSubtitle: {
    color: RecordQuestTheme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 12,
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
  addActionFooter: {
    marginTop: 10,
  },
  addButton: {
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    marginTop: 4,
    minHeight: 54,
    justifyContent: "center",
  },
  addButtonDisabled: {
    opacity: 0.72,
  },
  addButtonLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addButtonText: {
    color: RecordQuestTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
});
