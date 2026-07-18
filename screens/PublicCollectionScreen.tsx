import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { TopBar } from "../components/TopBar";
import {
  loadPublicCollectionPreview,
  type PublicRecordPreview,
} from "../hooks/public-collection-preview";
import { getFallbackAlbumArtUrl, resolveAlbumArtUrl } from "../utils/album-art";

type PublicCollectionScreenProps = {
  viewedUserId: string;
  viewedDisplayName: string;
  onBack: () => void;
};

export function PublicCollectionScreen({ viewedUserId, viewedDisplayName, onBack }: PublicCollectionScreenProps) {
  const [records, setRecords] = useState<PublicRecordPreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [brokenCoverIds, setBrokenCoverIds] = useState<Set<number>>(new Set());

  const loadCollection = useCallback(
    async (refresh = false) => {
      if (!viewedUserId.trim()) {
        setRecords([]);
        setErrorMessage("Collection unavailable.");
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      const result = await loadPublicCollectionPreview(viewedUserId, 150);

      if (result.error) {
        setRecords([]);
        setErrorMessage(result.error);
      } else {
        setRecords(result.records);
        setBrokenCoverIds(new Set());
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [viewedUserId]
  );

  useEffect(() => {
    void loadCollection(false);
  }, [loadCollection]);

  function formatAddedAt(value?: string): string {
    if (!value) {
      return "Added date unavailable";
    }

    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
      return "Added date unavailable";
    }

    return `Added ${new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`;
  }

  return (
    <View style={styles.page}>
      <TopBar
        title="Collection"
        back={onBack}
        rightIcon="↻"
        rightAction={() => {
          void loadCollection(true);
        }}
        rightActionLabel="Refresh public collection"
        rightActionDisabled={isLoading || isRefreshing}
        rightActionLoading={isRefreshing}
      />

      <Text style={styles.subtitle}>{viewedDisplayName}&apos;s public records</Text>

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#A78BFA" />
          <Text style={styles.loadingText}>Loading records...</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Collection unavailable</Text>
          <Text style={styles.stateText}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadCollection(true)}>
            <Text style={styles.retryButtonText}>{isRefreshing ? "Refreshing..." : "Retry"}</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !errorMessage ? (
        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>No public records yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.recordCard}>
              <Image
                source={{
                  uri: brokenCoverIds.has(item.id)
                    ? getFallbackAlbumArtUrl()
                    : resolveAlbumArtUrl(item.cover, "thumb"),
                }}
                style={styles.recordCover}
                onError={() => {
                  setBrokenCoverIds((current) => {
                    if (current.has(item.id)) {
                      return current;
                    }

                    const next = new Set(current);
                    next.add(item.id);
                    return next;
                  });
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.recordAlbum}>{item.album}</Text>
                <Text style={styles.recordArtist}>{item.artist}</Text>
                {item.year ? <Text style={styles.recordMeta}>{item.year}</Text> : null}
                <Text style={styles.recordMeta}>{formatAddedAt(item.addedAt)}</Text>
              </View>
            </View>
          )}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
    backgroundColor: "#050509",
  },
  subtitle: {
    color: "#CFC7E6",
    fontSize: 13,
    marginTop: -2,
    marginBottom: 12,
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
  listContent: {
    paddingBottom: 150,
  },
  stateCard: {
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.24)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "rgba(20, 18, 38, 0.84)",
  },
  stateTitle: {
    color: "#FFF4D6",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  stateText: {
    color: "#A7A1BD",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: "rgba(124, 58, 237, 0.25)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.48)",
  },
  retryButtonText: {
    color: "#FFF4D6",
    fontSize: 12,
    fontWeight: "700",
  },
  recordCard: {
    backgroundColor: "rgba(20, 18, 38, 0.90)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.28)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  recordCover: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: "#272738",
  },
  recordAlbum: {
    color: "#FFF4D6",
    fontSize: 14,
    fontWeight: "700",
  },
  recordArtist: {
    color: "#C7C7D1",
    fontSize: 12,
    marginTop: 2,
  },
  recordMeta: {
    color: "#A7A1BD",
    fontSize: 11,
    marginTop: 2,
  },
});
