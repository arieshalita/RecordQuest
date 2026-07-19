import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, type ImageProps, type ImageStyle, type StyleProp } from "react-native";
import { repairLegacyCoverArtUrl } from "../hooks/album-lookup";
import { patchOwnedRecordCover, patchOwnedWishlistCover } from "../hooks/recordquest-supabase-service";
import {
  getFallbackAlbumArtUrl,
  matchLegacyConstructedCoverArtArchiveUrl,
  normalizeAlbumArtUrlOrNull,
  resolveAlbumArtUrl,
} from "../utils/album-art";

type AlbumArtProps = Omit<ImageProps, "source" | "style" | "onError" | "onLoad"> & {
  uri?: string | null;
  hint?: "thumb" | "detail";
  style?: StyleProp<ImageStyle>;
  fallbackUri?: string;
  debugRecordId?: string | number;
  debugAlbum?: string;
  debugArtist?: string;
  debugScreen?: "owner-collection" | "wishlist" | "public-collection" | "other";
  debugUriSource?: "supabase" | "search-result" | "release-lookup" | "release-group-lookup" | "unknown";
  onError?: ImageProps["onError"];
  onLoad?: ImageProps["onLoad"];
};

const probedUris = new Set<string>();
const patchedCoverKeys = new Set<string>();
const confirmed500Uris = new Set<string>();
const successfulRepairSessionCache = new Map<string, string>();

async function runDevUriHealthProbe(uri: string): Promise<void> {
  if (!__DEV__ || !uri || probedUris.has(uri)) {
    return;
  }

  probedUris.add(uri);

  try {
    const headResponse = await fetch(uri, { method: "HEAD" });
    if (__DEV__) {
      console.log("[RecordQuest][album-art] uri health probe (HEAD)", {
        uri,
        status: headResponse.status,
        finalUrl: headResponse.url,
        contentType: headResponse.headers.get("content-type") ?? "unknown",
      });
    }

    if (headResponse.status === 500) {
      confirmed500Uris.add(uri);
    }

    if (headResponse.status !== 405) {
      return;
    }
  } catch (error) {
    if (__DEV__) {
      console.log("[RecordQuest][album-art] uri health probe (HEAD) failed", {
        uri,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  try {
    const getResponse = await fetch(uri, {
      method: "GET",
      headers: {
        Range: "bytes=0-0",
      },
    });

    if (__DEV__) {
      console.log("[RecordQuest][album-art] uri health probe (GET)", {
        uri,
        status: getResponse.status,
        finalUrl: getResponse.url,
        contentType: getResponse.headers.get("content-type") ?? "unknown",
      });
    }

    if (getResponse.status === 500) {
      confirmed500Uris.add(uri);
    }
  } catch (error) {
    if (__DEV__) {
      console.log("[RecordQuest][album-art] uri health probe (GET) failed", {
        uri,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }
}

export function AlbumArt({
  uri,
  hint = "thumb",
  fallbackUri,
  debugRecordId,
  debugAlbum,
  debugArtist,
  debugScreen = "other",
  debugUriSource = "unknown",
  onError,
  onLoad,
  ...imageProps
}: AlbumArtProps) {
  const normalizedPrimaryUri = normalizeAlbumArtUrlOrNull(uri);
  const fallback = resolveAlbumArtUrl(fallbackUri ?? getFallbackAlbumArtUrl(), hint);
  const [stage, setStage] = useState<"primary" | "retry" | "fallback">("primary");
  const [activeUri, setActiveUri] = useState<string | null>(normalizedPrimaryUri);
  const [repairedPrimaryUri, setRepairedPrimaryUri] = useState<string | null>(null);
  const [repairedFallbackUri, setRepairedFallbackUri] = useState<string | null>(null);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const [isCurrentLoading, setIsCurrentLoading] = useState<boolean>(Boolean(normalizedPrimaryUri));
  const versionRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instanceIdRef = useRef(`art-${Math.random().toString(36).slice(2, 9)}`);
  const renderCountRef = useRef(0);
  const repairAttemptedByUriRef = useRef(new Set<string>());
  const repairInFlightByUriRef = useRef(new Set<string>());
  const attemptedUrisRef = useRef(new Set<string>());
  const attemptedReleaseMbidsRef = useRef(new Set<string>());
  const originReleaseMbidRef = useRef<string | null>(null);
  const resolvedReleaseGroupMbidRef = useRef<string | null>(null);
  const pendingOwnerPatchUrlRef = useRef<string | null>(null);
  const currentSourceUriRef = useRef<string>("");
  const successfulLoadedUriRef = useRef<string | null>(null);
  const failedUrisRef = useRef(new Set<string>());
  const renderDecisionRef = useRef<string>("");

  function cacheKeyForSession(recordId: string | number | undefined, failedUrl: string | null): string | null {
    if (recordId === undefined || recordId === null) {
      return null;
    }

    const normalizedFailedUrl = normalizeAlbumArtUrlOrNull(failedUrl);
    if (!normalizedFailedUrl) {
      return null;
    }

    return `${debugScreen}:${String(recordId)}:${normalizedFailedUrl}`;
  }

  function logMutation(
    field: string,
    previousValue: unknown,
    nextValue: unknown,
    reason: string,
    capturedVersion?: number
  ): void {
    if (!__DEV__) {
      return;
    }

    console.log("[RecordQuest][album-art] mutation", {
      instanceId: instanceIdRef.current,
      field,
      previousValue,
      nextValue,
      reason,
      capturedVersion: capturedVersion ?? versionRef.current,
      currentVersion: versionRef.current,
      stage,
      staleCallback:
        typeof capturedVersion === "number" ? capturedVersion !== versionRef.current : false,
      attemptedUrls: [...attemptedUrisRef.current],
    });
  }

  function setStageWithLog(nextStage: "primary" | "retry" | "fallback", reason: string, capturedVersion?: number): void {
    setStage((previous) => {
      if (previous !== nextStage) {
        logMutation("stage", previous, nextStage, reason, capturedVersion);
      }
      return nextStage;
    });
  }

  function setActiveUriWithLog(nextUri: string | null, reason: string, capturedVersion?: number): void {
    setActiveUri((previous) => {
      if (previous !== nextUri) {
        logMutation("activeUri", previous, nextUri, reason, capturedVersion);
      }
      return nextUri;
    });
  }

  function setRepairedPrimaryUriWithLog(nextUri: string | null, reason: string, capturedVersion?: number): void {
    setRepairedPrimaryUri((previous) => {
      if (previous !== nextUri) {
        logMutation("repairedPrimaryUri", previous, nextUri, reason, capturedVersion);
      }
      return nextUri;
    });
  }

  function setRepairedFallbackUriWithLog(nextUri: string | null, reason: string, capturedVersion?: number): void {
    setRepairedFallbackUri((previous) => {
      if (previous !== nextUri) {
        logMutation("repairedFallbackUri", previous, nextUri, reason, capturedVersion);
      }
      return nextUri;
    });
  }

  function setPendingPatchUrlWithLog(nextUri: string | null, reason: string, capturedVersion?: number): void {
    const previous = pendingOwnerPatchUrlRef.current;
    if (previous !== nextUri) {
      logMutation("stagedOwnerPatchUrl", previous, nextUri, reason, capturedVersion);
    }
    pendingOwnerPatchUrlRef.current = nextUri;
  }

  function recordAttemptedUri(url: string, reason: string, capturedVersion?: number): void {
    if (!attemptedUrisRef.current.has(url)) {
      attemptedUrisRef.current.add(url);
      logMutation("attemptedUrls", "(append)", url, reason, capturedVersion);
    }
  }

  function markUriFailed(uriValue: string, reason: string, capturedVersion?: number): void {
    if (!failedUrisRef.current.has(uriValue)) {
      failedUrisRef.current.add(uriValue);
      logMutation("failedUris", "(append)", uriValue, reason, capturedVersion);
    }
  }

  function clearUriFailure(uriValue: string, reason: string, capturedVersion?: number): void {
    if (failedUrisRef.current.delete(uriValue)) {
      logMutation("failedUris", uriValue, "(removed)", reason, capturedVersion);
    }
  }

  renderCountRef.current += 1;
  const effectivePrimaryUri = activeUri ?? repairedPrimaryUri ?? normalizedPrimaryUri;
  const retryUri = effectivePrimaryUri;

  async function patchOwnerCoverIfAllowed(nextUrl: string): Promise<void> {
    if (!Number.isFinite(Number(debugRecordId))) {
      if (__DEV__) {
        console.log("[RecordQuest][album-art] owner patch skipped", {
          reason: "invalid record id",
          screen: debugScreen,
          recordId: debugRecordId ?? null,
        });
      }
      return;
    }

    const recordId = Number(debugRecordId);
    const normalizedNextUrl = normalizeAlbumArtUrlOrNull(nextUrl);
    if (!normalizedNextUrl) {
      return;
    }

    const table = debugScreen === "wishlist" ? "wishlist" : debugScreen === "owner-collection" ? "records" : null;

    if (!table) {
      if (__DEV__) {
        console.log("[RecordQuest][album-art] owner patch skipped", {
          reason: "public or unknown ownership context",
          screen: debugScreen,
          recordId,
        });
      }
      return;
    }

    const patchKey = `${table}:${recordId}:${normalizedNextUrl}`;
    if (patchedCoverKeys.has(patchKey)) {
      return;
    }

    patchedCoverKeys.add(patchKey);

    if (__DEV__) {
      console.log("[RecordQuest][album-art] owner patch attempted", {
        table,
        recordId,
        nextUrl: normalizedNextUrl,
      });
    }

    const didPatch =
      table === "records"
        ? await patchOwnedRecordCover(recordId, normalizedNextUrl)
        : await patchOwnedWishlistCover(recordId, normalizedNextUrl);

    if (__DEV__) {
      console.log("[RecordQuest][album-art] owner patch result", {
        table,
        recordId,
        success: didPatch,
      });
    }
  }

  async function tryLegacyRepair(currentVersion: number, failedUri: string): Promise<boolean> {
    if (repairInFlightByUriRef.current.has(failedUri)) {
      return true;
    }

    const legacyMatch = matchLegacyConstructedCoverArtArchiveUrl(failedUri);
    if (!legacyMatch) {
      return false;
    }

    repairAttemptedByUriRef.current.add(failedUri);
    repairInFlightByUriRef.current.add(failedUri);

    if (__DEV__) {
      console.log("[RecordQuest][album-art] legacy repair attempted", {
        screen: debugScreen,
        recordId: debugRecordId ?? null,
        album: debugAlbum ?? "unknown",
        artist: debugArtist ?? "unknown",
        originalStoredUrl: typeof uri === "string" ? uri : null,
        legacyMatched: true,
        kind: legacyMatch.kind,
        mbid: legacyMatch.mbid,
      });
    }

    try {
      const repaired = await repairLegacyCoverArtUrl(failedUri, {
        failedUrl: failedUri,
        attemptedUrls: [...attemptedUrisRef.current],
        attemptedReleaseMbids: [...attemptedReleaseMbidsRef.current],
        originReleaseMbid: originReleaseMbidRef.current ?? undefined,
        resolvedReleaseGroupMbid: resolvedReleaseGroupMbidRef.current ?? undefined,
      });

      if (currentVersion !== versionRef.current) {
        if (__DEV__) {
          console.log("[RecordQuest][album-art] stale repair result ignored", {
            instanceId: instanceIdRef.current,
            failedUri,
          });
        }
        return true;
      }

      if (__DEV__) {
        console.log("[RecordQuest][album-art] legacy repair result", {
          screen: debugScreen,
          recordId: debugRecordId ?? null,
          album: debugAlbum ?? "unknown",
          artist: debugArtist ?? "unknown",
          kind: repaired.kind ?? legacyMatch.kind,
          mbid: repaired.mbid ?? legacyMatch.mbid,
          metadataEndpoint: repaired.metadataEndpoint ?? null,
          selectedPrimaryUrl: repaired.url || null,
          selectedFallbackUrl: repaired.fallbackUrl ?? null,
          status: repaired.status,
          releaseGroupMbid: repaired.releaseGroupMbid ?? null,
          releaseGroupMetadataEndpoint: repaired.releaseGroupMetadataEndpoint ?? null,
          sourceReleaseMbid: repaired.sourceReleaseMbid ?? null,
          candidateReleaseMbid: repaired.candidateReleaseMbid ?? null,
          candidateIndex: repaired.candidateIndex ?? null,
        });
      }

      if (repaired.sourceReleaseMbid) {
        originReleaseMbidRef.current = repaired.sourceReleaseMbid;
      }

      if (repaired.releaseGroupMbid) {
        resolvedReleaseGroupMbidRef.current = repaired.releaseGroupMbid;
      }

      if (repaired.candidateReleaseMbid) {
        attemptedReleaseMbidsRef.current.add(repaired.candidateReleaseMbid.toLowerCase());
      }

      const normalizedReplacementUrl = normalizeAlbumArtUrlOrNull(repaired.url);
      if (
        !normalizedReplacementUrl ||
        (repaired.status !== "alternate-image-found" && repaired.status !== "alternate-release-found") ||
        attemptedUrisRef.current.has(normalizedReplacementUrl)
      ) {
        return true;
      }

      attemptedUrisRef.current.add(normalizedReplacementUrl);
      setLoadedUri((previous) => (previous === normalizedReplacementUrl ? previous : null));
      setRepairedPrimaryUriWithLog(normalizedReplacementUrl, "legacy repair accepted", currentVersion);
      setRepairedFallbackUriWithLog(repaired.fallbackUrl ?? null, "legacy repair accepted", currentVersion);
      setPendingPatchUrlWithLog(normalizedReplacementUrl, "legacy repair accepted", currentVersion);
      setActiveUriWithLog(normalizedReplacementUrl, "legacy repair accepted", currentVersion);
      setIsCurrentLoading(true);
      setStageWithLog("primary", "legacy repair accepted", currentVersion);
      return true;
    } finally {
      repairInFlightByUriRef.current.delete(failedUri);
    }
  }

  useEffect(() => {
    const cacheKey = cacheKeyForSession(debugRecordId, normalizedPrimaryUri);
    const cachedSuccessfulUri = cacheKey ? successfulRepairSessionCache.get(cacheKey) ?? null : null;

    if (__DEV__) {
      console.log("[RecordQuest][album-art] reset lifecycle", {
        instanceId: instanceIdRef.current,
        recordId: debugRecordId ?? null,
        normalizedPrimaryUri,
        cacheKey,
        cachedSuccessfulUri,
        sessionCacheHit: Boolean(cachedSuccessfulUri),
      });
    }

    setStageWithLog("primary", "record or stored cover changed");
    setRepairedPrimaryUriWithLog(cachedSuccessfulUri, "record or stored cover changed");
    setRepairedFallbackUriWithLog(null, "record or stored cover changed");
    setActiveUriWithLog(cachedSuccessfulUri ?? normalizedPrimaryUri, "record or stored cover changed");
    successfulLoadedUriRef.current = cachedSuccessfulUri;
    setLoadedUri(cachedSuccessfulUri);
    setIsCurrentLoading(Boolean(cachedSuccessfulUri ?? normalizedPrimaryUri));
    attemptedUrisRef.current.clear();
    attemptedReleaseMbidsRef.current.clear();
    originReleaseMbidRef.current = null;
    resolvedReleaseGroupMbidRef.current = null;
    failedUrisRef.current.clear();
    setPendingPatchUrlWithLog(null, "record or stored cover changed");

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [debugRecordId, normalizedPrimaryUri]);

  useEffect(() => {
    versionRef.current += 1;

    logMutation("uriVersion", versionRef.current - 1, versionRef.current, "effective uri update");

    if (__DEV__) {
      console.log("[RecordQuest][album-art] uri update", {
        instanceId: instanceIdRef.current,
        renderCount: renderCountRef.current,
        remountLikely: renderCountRef.current === 1,
        screen: debugScreen,
        recordId: debugRecordId ?? null,
        album: debugAlbum ?? "unknown",
        artist: debugArtist ?? "unknown",
        uriSource: debugUriSource,
        rawCover: typeof uri === "string" ? uri : null,
        normalizedCover: normalizedPrimaryUri,
        activeUri: effectivePrimaryUri,
        legacyMatched: Boolean(matchLegacyConstructedCoverArtArchiveUrl(normalizedPrimaryUri)),
      });
    }
  }, [effectivePrimaryUri, fallback, debugAlbum, debugArtist, debugRecordId, debugScreen, debugUriSource, normalizedPrimaryUri, uri]);

  const sourceUri =
    stage === "primary"
      ? resolveAlbumArtUrl(effectivePrimaryUri, hint)
      : stage === "retry"
        ? resolveAlbumArtUrl(retryUri ?? repairedFallbackUri, hint)
          : fallback;

  const source = useMemo(() => ({ uri: sourceUri }), [sourceUri]);

  const flattenedStyle = StyleSheet.flatten(imageProps.style as ImageStyle | ImageStyle[] | undefined);
  const width = typeof flattenedStyle?.width === "number" ? flattenedStyle.width : null;
  const height = typeof flattenedStyle?.height === "number" ? flattenedStyle.height : null;
  const opacity = typeof flattenedStyle?.opacity === "number" ? flattenedStyle.opacity : 1;
  const normalizedSourceUri = normalizeAlbumArtUrlOrNull(sourceUri);
  const currentUriLoaded = Boolean(normalizedSourceUri && loadedUri === normalizedSourceUri);
  const currentUriFailed = Boolean(normalizedSourceUri && failedUrisRef.current.has(normalizedSourceUri));
  const showPlaceholder = stage === "fallback" || !normalizedSourceUri || currentUriFailed;
  const showImage = Boolean(normalizedSourceUri) && currentUriLoaded && !currentUriFailed;
  const showSpinner = isCurrentLoading && !showImage;
  const showOverlay = false;

  useEffect(() => {
    if (!normalizedSourceUri) {
      setIsCurrentLoading(false);
      return;
    }

    if (loadedUri === normalizedSourceUri && !currentUriFailed) {
      setIsCurrentLoading(false);
      return;
    }

    if (!currentUriFailed) {
      setIsCurrentLoading(true);
    }
  }, [normalizedSourceUri, loadedUri, currentUriFailed]);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    const reason = showImage
      ? "current-uri-loaded"
      : showPlaceholder
        ? "placeholder-branch"
        : showSpinner
          ? "loading-current-uri"
          : "intermediate";

    const snapshot = JSON.stringify({
      recordId: debugRecordId ?? null,
      activeUri,
      loadedUri,
      currentUriLoaded,
      currentUriFailed,
      loading: isCurrentLoading,
      showImage,
      showPlaceholder,
      showSpinner,
      showOverlay,
      width,
      height,
      opacity,
      uriVersion: versionRef.current,
      reason,
    });

    if (snapshot === renderDecisionRef.current) {
      return;
    }

    renderDecisionRef.current = snapshot;

    console.log("[RecordQuest][album-art] render decision", {
      instanceId: instanceIdRef.current,
      recordId: debugRecordId ?? null,
      activeUri,
      loadedUri,
      currentUriLoaded,
      currentUriFailed,
      loading: isCurrentLoading,
      showImage,
      showPlaceholder,
      showSpinner,
      showOverlay,
      width,
      height,
      opacity,
      uriVersion: versionRef.current,
      reason,
    });
  }, [
    activeUri,
    currentUriFailed,
    currentUriLoaded,
    debugRecordId,
    height,
    isCurrentLoading,
    loadedUri,
    opacity,
    showImage,
    showOverlay,
    showPlaceholder,
    showSpinner,
    width,
  ]);

  useEffect(() => {
    currentSourceUriRef.current = sourceUri;
  }, [sourceUri]);

  return (
    <Image
      {...imageProps}
      source={source}
      onError={(event) => {
        const eventVersion = versionRef.current;
        const nativeError = event.nativeEvent?.error ?? "unknown";

        if (sourceUri !== currentSourceUriRef.current || eventVersion !== versionRef.current) {
          if (__DEV__) {
            console.log("[RecordQuest][album-art] stale onError ignored", {
              instanceId: instanceIdRef.current,
              sourceUri,
              currentSourceUri: currentSourceUriRef.current,
              eventVersion,
              currentVersion: versionRef.current,
            });
          }
          return;
        }

        if (
          successfulLoadedUriRef.current &&
          sourceUri !== successfulLoadedUriRef.current &&
          effectivePrimaryUri === successfulLoadedUriRef.current
        ) {
          if (__DEV__) {
            console.log("[RecordQuest][album-art] old candidate onError ignored after success", {
              sourceUri,
              successfulLoadedUri: successfulLoadedUriRef.current,
            });
          }
          return;
        }

        if (normalizedSourceUri && loadedUri === normalizedSourceUri) {
          if (__DEV__) {
            console.log("[RecordQuest][album-art] onError ignored for already-loaded uri", {
              uri: normalizedSourceUri,
              instanceId: instanceIdRef.current,
            });
          }
          return;
        }

        if (normalizedSourceUri) {
          markUriFailed(normalizedSourceUri, "image onError", eventVersion);
          setIsCurrentLoading(false);
        }

        if (__DEV__) {
          console.log("[RecordQuest][album-art] image onError", {
            instanceId: instanceIdRef.current,
            renderCount: renderCountRef.current,
            remountLikely: renderCountRef.current === 1,
            screen: debugScreen,
            recordId: debugRecordId ?? null,
            album: debugAlbum ?? "unknown",
            artist: debugArtist ?? "unknown",
            uriSource: debugUriSource,
            rawCover: typeof uri === "string" ? uri : null,
            normalizedCover: normalizedPrimaryUri,
            imageUri: sourceUri,
            retryUri,
            repairedPrimaryUri,
            repairedFallbackUri,
            cacheBustApplied: false,
            stage,
            nativeError,
            legacyMatched: Boolean(matchLegacyConstructedCoverArtArchiveUrl(normalizedPrimaryUri)),
          });
        }

        if (stage === "primary" && effectivePrimaryUri) {
          const alreadyAttemptedLegacyRepair = repairAttemptedByUriRef.current.has(effectivePrimaryUri);
          const legacyMatch = matchLegacyConstructedCoverArtArchiveUrl(effectivePrimaryUri);
          const repairInFlight = repairInFlightByUriRef.current.has(effectivePrimaryUri);
          const looksLikeCoverArtArchiveUrl = effectivePrimaryUri.includes("coverartarchive.org");

          if (!alreadyAttemptedLegacyRepair && legacyMatch) {
            recordAttemptedUri(sourceUri, "primary failed before repair", eventVersion);
            void tryLegacyRepair(eventVersion, effectivePrimaryUri);
            void runDevUriHealthProbe(sourceUri);
            return;
          }

          if (!alreadyAttemptedLegacyRepair && looksLikeCoverArtArchiveUrl && !legacyMatch && __DEV__) {
            console.log("[RecordQuest][album-art] legacy repair not possible", {
              reason: "could not extract stable release/release-group MBID",
              imageUri: effectivePrimaryUri,
            });
          }

          if (repairInFlight) {
            return;
          }

          if (__DEV__) {
            console.log("[RecordQuest][album-art] image load failure, retrying once", {
              uri: effectivePrimaryUri,
            });
          }

          recordAttemptedUri(sourceUri, "primary failed before single retry", eventVersion);

          if (confirmed500Uris.has(sourceUri)) {
            if (__DEV__) {
              console.log("[RecordQuest][album-art] skipping retry after confirmed 500", {
                uri: sourceUri,
              });
            }
            setStageWithLog("fallback", "confirmed 500 skip retry", eventVersion);
            onError?.(event);
            return;
          }

          void runDevUriHealthProbe(sourceUri);

          retryTimerRef.current = setTimeout(() => {
            if (eventVersion !== versionRef.current) {
              if (__DEV__) {
                console.log("[RecordQuest][album-art] stale retry ignored", {
                  instanceId: instanceIdRef.current,
                  imageUri: sourceUri,
                });
              }
              return;
            }

            setStageWithLog("retry", "single retry scheduled", eventVersion);
          }, 220);
        } else if (stage !== "fallback") {
          if (__DEV__) {
            console.log("[RecordQuest][album-art] image load failed, falling back", {
              uri: effectivePrimaryUri,
            });
          }
          setStageWithLog("fallback", "retry exhausted", eventVersion);
        }

        onError?.(event);
      }}
      onLoad={(event) => {
        const eventVersion = versionRef.current;
        if (sourceUri !== currentSourceUriRef.current || eventVersion !== versionRef.current) {
          if (__DEV__) {
            console.log("[RecordQuest][album-art] stale onLoad ignored", {
              sourceUri,
              currentSourceUri: currentSourceUriRef.current,
              eventVersion,
              currentVersion: versionRef.current,
            });
          }
          return;
        }

        const pendingPatchUrl = pendingOwnerPatchUrlRef.current;
        const normalizedSourceUri = normalizeAlbumArtUrlOrNull(sourceUri);

        if (normalizedSourceUri) {
          clearUriFailure(normalizedSourceUri, "image onLoad", eventVersion);
          successfulLoadedUriRef.current = normalizedSourceUri;
          setLoadedUri(normalizedSourceUri);
          setIsCurrentLoading(false);
          setActiveUriWithLog(normalizedSourceUri, "image onLoad success", eventVersion);
          setStageWithLog("primary", "image onLoad success", eventVersion);
        }

        const sessionCacheKey = cacheKeyForSession(debugRecordId, normalizedPrimaryUri);
        if (sessionCacheKey && normalizedSourceUri) {
          successfulRepairSessionCache.set(sessionCacheKey, normalizedSourceUri);
        }

        if (pendingPatchUrl && normalizedSourceUri && pendingPatchUrl === normalizedSourceUri) {
          setPendingPatchUrlWithLog(null, "candidate onLoad confirmed", eventVersion);

          if (__DEV__) {
            console.log("[RecordQuest][album-art] candidate image onLoad success", {
              screen: debugScreen,
              recordId: debugRecordId ?? null,
              loadedUrl: normalizedSourceUri,
            });
          }

          void patchOwnerCoverIfAllowed(normalizedSourceUri);
        }

        if (__DEV__) {
          console.log("[RecordQuest][album-art] onLoad source role", {
            role: "visible",
            sourceUri,
            instanceId: instanceIdRef.current,
          });
        }

        onLoad?.(event);
      }}
    />
  );
}