import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { AlbumArt } from "../components/AlbumArt";
import { TopBar } from "../components/TopBar";
import {
  loadPublicCollectionPreview,
  type PublicRecordPreview,
} from "../hooks/public-collection-preview";
import { isValidAlbumArtUrl } from "../utils/album-art";

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
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const hasSuccessfulLoadRef = useRef(false);
  const lastViewedUserIdRef = useRef<string>("");

  const trimmedViewedUserId = viewedUserId.trim();
  const showUnavailableState = Boolean(errorMessage) && records.length === 0;

  const loadCollection = useCallback(
    async (options?: { refresh?: boolean; source?: string; allowAutoRetry?: boolean }) => {
      const refresh = options?.refresh ?? false;
      const source = options?.source ?? "automatic";
      const allowAutoRetry = options?.allowAutoRetry ?? true;

      if (!trimmedViewedUserId) {
        setRecords([]);
        setErrorMessage("Collection unavailable.");
        setIsLoading(false);
        setIsRefreshing(false);
        hasSuccessfulLoadRef.current = false;
        return;
      }

      if (inFlightRef.current) {
        pendingRefreshRef.current = pendingRefreshRef.current || refresh;

        if (__DEV__) {
          console.log("[RecordQuest][public-collection] overlapping request skipped", {
            viewedUserIdPresent: Boolean(trimmedViewedUserId),
            source,
            refresh,
          });
        }

        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      inFlightRef.current = true;
      const shouldUseRefreshingState = refresh || hasSuccessfulLoadRef.current;

      if (shouldUseRefreshingState) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      if (!hasSuccessfulLoadRef.current) {
        setErrorMessage(null);
      }

      let attempt = 1;
      const maxAttempts = allowAutoRetry ? 2 : 1;
      let finalErrorMessage: string | null = null;
      let success = false;

      try {
        while (attempt <= maxAttempts) {
          if (__DEV__) {
            console.log("[RecordQuest][public-collection] load attempt", {
              requestId,
              attempt,
              source,
              viewedUserIdPresent: Boolean(trimmedViewedUserId),
            });
          }

          const result = await loadPublicCollectionPreview(trimmedViewedUserId, 150);

          if (requestId !== requestIdRef.current) {
            if (__DEV__) {
              console.log("[RecordQuest][public-collection] stale response ignored", {
                requestId,
                latestRequestId: requestIdRef.current,
              });
            }
            return;
          }

          if (!result.error) {
            setRecords(result.records);
            setErrorMessage(null);
            hasSuccessfulLoadRef.current = true;
            success = true;

            if (__DEV__) {
              const firstRecord = result.records[0];
              console.log("[RecordQuest][public-collection] load success", {
                requestId,
                resultCount: result.records.length,
                sampleRecordId: firstRecord?.id ?? null,
                sampleCoverValid: firstRecord ? isValidAlbumArtUrl(firstRecord.cover) : false,
              });
            }

            break;
          }

          finalErrorMessage = result.error;

          if (__DEV__) {
            console.log("[RecordQuest][public-collection] load failure", {
              requestId,
              attempt,
              code: result.errorCode ?? "none",
              message: result.errorMessage ?? result.error,
              transient: Boolean(result.isTransientFailure),
            });
          }

          if (!result.isTransientFailure || attempt >= maxAttempts) {
            break;
          }

          await new Promise<void>((resolve) => setTimeout(resolve, 400));
          attempt += 1;
        }

        if (!success && requestId === requestIdRef.current) {
          if (!hasSuccessfulLoadRef.current) {
            setRecords([]);
            setErrorMessage(finalErrorMessage ?? "Collection unavailable.");
          } else {
            setErrorMessage(null);
          }
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }

        inFlightRef.current = false;

        if (pendingRefreshRef.current) {
          pendingRefreshRef.current = false;
          void loadCollection({ refresh: true, source: "queued", allowAutoRetry: false });
        }
      }
    },
    [trimmedViewedUserId]
  );

  useEffect(() => {
    if (lastViewedUserIdRef.current !== trimmedViewedUserId) {
      lastViewedUserIdRef.current = trimmedViewedUserId;
      setRecords([]);
      setErrorMessage(null);
      hasSuccessfulLoadRef.current = false;
    }

    void loadCollection({ refresh: false, source: "initial", allowAutoRetry: true });
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
          void loadCollection({ refresh: true, source: "manual-refresh", allowAutoRetry: true });
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

      {showUnavailableState ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Collection unavailable</Text>
          <Text style={styles.stateText}>{errorMessage}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void loadCollection({ refresh: true, source: "manual-retry", allowAutoRetry: true })}
          >
            <Text style={styles.retryButtonText}>{isRefreshing ? "Refreshing..." : "Retry"}</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !showUnavailableState ? (
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
              <AlbumArt
                uri={item.cover}
                style={styles.recordCover}
                debugScreen="public-collection"
                debugRecordId={item.id}
                debugAlbum={item.album}
                debugArtist={item.artist}
                debugUriSource="supabase"
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
