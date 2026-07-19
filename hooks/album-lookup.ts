import { type RecordItem } from "./recordquest-storage";
import {
  isEquivalentCoverArtArchiveImage,
  matchLegacyConstructedCoverArtArchiveUrl,
  normalizeAlbumArtUrlOrNull,
  parseCoverArtArchiveArtworkIdentity,
  type CoverArtArchiveArtworkIdentity,
  type CoverArtArchiveLegacyKind,
} from "../utils/album-art";

const MUSICBRAINZ_RELEASE_URL = "https://musicbrainz.org/ws/2/release";
const MUSICBRAINZ_RELEASE_GROUP_URL = "https://musicbrainz.org/ws/2/release-group";
const COVER_ART_RELEASE_GROUP_URL = "https://coverartarchive.org/release-group";
const COVER_ART_RELEASE_URL = "https://coverartarchive.org/release";
const SEARCH_CACHE_LIMIT = 40;
const ARTWORK_REQUEST_TIMEOUT_MS = 7000;
const NO_ART_CACHE_TTL_MS = 1000 * 60 * 60;

const searchCache = new Map<string, AlbumSearchResult[]>();

type ArtworkCacheEntry = {
  status: "valid" | "no-art";
  url: string;
  fallbackUrl: string;
  expiresAt: number;
};

type ArtworkResolution = {
  status: "valid" | "no-art" | "transient-failure" | "malformed-url";
  url: string;
  fallbackUrl?: string;
  metadataEndpoint?: string;
  path: "preferred" | "release" | "release-group" | "none";
  attempt: number;
};

const artworkResolutionCache = new Map<string, ArtworkCacheEntry>();
const pendingArtworkRequests = new Map<string, Promise<ArtworkResolution>>();
const pendingLegacyRepairRequests = new Map<string, Promise<LegacyArtworkRepairResult>>();
const legacyRepairCache = new Map<string, LegacyArtworkRepairResult>();
const releaseToReleaseGroupCache = new Map<string, string>();
const pendingReleaseToGroupRequests = new Map<string, Promise<string>>();
const releaseGroupAlternateReleaseCache = new Map<string, AlternateReleaseCandidate[]>();
const pendingReleaseGroupAlternateReleaseRequests = new Map<string, Promise<AlternateReleaseCandidate[]>>();
const pendingSearchRequests = new Map<string, Promise<AlbumSearchResult[]>>();

export type AlbumSearchResult = {
  id: string;
  releaseId?: string;
  releaseGroupId?: string;
  album: string;
  artist: string;
  year: string;
  cover: string;
  coverThumbnail?: string;
  genre: string;
  format?: "album" | "ep" | "single";
};

type ScoredAlbumSearchResult = AlbumSearchResult & { score: number };

type ReleaseGroupRow = {
  id?: string;
  title?: string;
  disambiguation?: string;
  "first-release-date"?: string;
  "primary-type"?: string;
  "secondary-types"?: string[];
  "artist-credit"?: Array<{ name?: string; artist?: { name?: string } }>;
  "artist-credit-phrase"?: string;
};

type SearchHints = {
  albumHint: string;
  artistHint: string;
};

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "what",
  "whats",
  "is",
  "story",
  "of",
  "and",
  "in",
  "on",
  "to",
  "for",
  "with",
]);

const SAFE_GENRE_ALLOWLIST = new Set([
  "rock",
  "pop",
  "hip hop",
  "rap",
  "jazz",
  "soul",
  "funk",
  "r&b",
  "electronic",
  "dance",
  "disco",
  "folk",
  "country",
  "blues",
  "classical",
  "punk",
  "metal",
  "reggae",
  "indie",
  "alternative",
  "soundtrack",
  "ambient",
  "experimental",
  "house",
  "techno",
  "new wave",
  "psychedelic",
  "progressive rock",
  "hard rock",
  "soft rock",
  "art rock",
  "garage rock",
  "post-punk",
  "synth-pop",
]);

const GENRE_VARIANTS: Record<string, string> = {
  "rhythm and blues": "r&b",
  "rhythm & blues": "r&b",
  "r and b": "r&b",
  rnb: "r&b",
  "hip-hop": "hip hop",
  hiphop: "hip hop",
  "hip hop": "hip hop",
  synthpop: "synth-pop",
  synthwave: "synth-pop",
  alt: "alternative",
  "alt rock": "alternative",
  "electronica": "electronic",
};

const BLOCKED_GENRE_TERMS = [
  "porn",
  "sex",
  "sexual",
  "nsfw",
  "nazi",
  "hate",
  "racist",
  "terror",
  "murder",
  "kill",
  "drug",
  "meth",
  "cocaine",
];

function containsBlockedGenreTerm(normalizedValue: string): boolean {
  const tokens = normalizedValue.split(" ").filter(Boolean);
  return tokens.some((token) => BLOCKED_GENRE_TERMS.includes(token));
}

function normalizeYear(date?: string) {
  return date?.slice(0, 4) || "Unknown";
}

function normalizeText(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeWords(value: string) {
  return normalizeText(value).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeGenreToken(value: string) {
  return normalizeText(value)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeExternalGenre(value?: string): string | undefined {
  if (!value) return undefined;

  const normalized = normalizeGenreToken(value);
  if (!normalized) return undefined;

  if (containsBlockedGenreTerm(normalized)) {
    return undefined;
  }

  const canonical = GENRE_VARIANTS[normalized] ?? normalized;

  if (SAFE_GENRE_ALLOWLIST.has(canonical)) {
    return canonical;
  }

  return undefined;
}

function tokenize(value: string) {
  const normalized = normalizeWords(value);
  if (!normalized) return [] as string[];
  return normalized.split(" ").filter((token) => token.length > 1);
}

function tokenizeQuery(value: string) {
  return tokenize(value).filter((token) => !STOPWORDS.has(token));
}

function buildTokenSet(value: string, useQueryRules = false) {
  const source = useQueryRules ? tokenizeQuery(value) : tokenize(value);
  return new Set(source);
}

function coverageRatio(queryTokens: Set<string>, resultTokens: Set<string>): number {
  if (queryTokens.size === 0) return 0;

  let matches = 0;
  for (const token of queryTokens) {
    if (resultTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / queryTokens.size;
}

function includesAny(value: string, keywords: string[]) {
  const normalizedValue = normalizeWords(value);
  return keywords.some((keyword) => normalizedValue.includes(keyword));
}

function tokenOverlapScore(sourceA: string, sourceB: string) {
  const a = new Set(tokenize(sourceA));
  const b = new Set(tokenize(sourceB));

  if (!a.size || !b.size) return 0;

  let matches = 0;
  for (const token of a) {
    if (b.has(token)) matches += 1;
  }

  const ratio = matches / Math.max(a.size, b.size);
  return Math.round(ratio * 70);
}

function buildGenre(primaryType?: string, secondaryTypes?: string[]) {
  const candidates = [primaryType, ...(secondaryTypes ?? [])]
    .map((part) => sanitizeExternalGenre(part))
    .filter((part): part is string => !!part);

  const uniqueCandidates = [...new Set(candidates)];
  if (uniqueCandidates.length === 0) {
    return "";
  }

  return uniqueCandidates[0];
}

function buildReleaseFormat(primaryType?: string): "album" | "ep" | "single" | undefined {
  const normalizedType = normalizeWords(primaryType ?? "");

  if (normalizedType === "album") return "album";
  if (normalizedType === "ep") return "ep";
  if (normalizedType === "single") return "single";

  return undefined;
}

function searchCacheKey(album: string, artist: string) {
  return `${normalizeText(album)}::${normalizeText(artist)}`;
}

function setSearchCache(key: string, value: AlbumSearchResult[]) {
  if (searchCache.has(key)) {
    searchCache.delete(key);
  }

  searchCache.set(key, value);

  while (searchCache.size > SEARCH_CACHE_LIMIT) {
    const oldestKey = searchCache.keys().next().value;
    if (!oldestKey) break;
    searchCache.delete(oldestKey);
  }
}

function buildMeaningfulReleasegroupQuery(album: string, artist: string): string {
  const source = artist.trim() ? album : `${album} ${artist}`;
  const tokens = tokenizeQuery(source).slice(0, 5);
  if (tokens.length === 0) return "";
  return `releasegroup:${tokens.join(" ")}`;
}

function buildTitleFocusedQueryVariants(album: string): string[] {
  const tokens = tokenizeQuery(album).slice(0, 5);
  if (tokens.length === 0) {
    return [];
  }

  const phrase = tokens.join(" ");
  const variants = new Set<string>();
  variants.add(`releasegroup:"${phrase}"`);
  variants.add(`"${phrase}"`);

  if (tokens.length > 1) {
    variants.add(`releasegroup:${tokens.map((token) => `"${token}"`).join(" AND ")}`);
  }

  return [...variants];
}

function buildReleaseGroupQuery(album: string, artist: string) {
  const trimmedAlbum = album.trim();
  const trimmedArtist = artist.trim();

  if (trimmedArtist) {
    return `releasegroup:"${trimmedAlbum}" AND artist:"${trimmedArtist}"`;
  }

  return `releasegroup:"${trimmedAlbum}"`;
}

function extractSearchHints(album: string, artist: string): SearchHints {
  const trimmedAlbum = album.trim();
  const trimmedArtist = artist.trim();

  if (trimmedArtist) {
    return {
      albumHint: trimmedAlbum,
      artistHint: trimmedArtist,
    };
  }

  const words = trimmedAlbum.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const lastWord = words[words.length - 1];
    const remaining = words.slice(0, -1).join(" ");

    if (remaining.length >= 3 && lastWord.length >= 3) {
      return {
        albumHint: remaining,
        artistHint: lastWord,
      };
    }
  }

  return {
    albumHint: trimmedAlbum,
    artistHint: "",
  };
}

function buildLooseQueries(album: string, artist: string): string[] {
  const hints = extractSearchHints(album, artist);
  const rawQuery = `${album.trim()} ${artist.trim()}`.trim();
  const normalizedRawQuery = normalizeWords(rawQuery);
  const meaningfulReleasegroupQuery = buildMeaningfulReleasegroupQuery(album, artist);
  const titleFocusedQueries = buildTitleFocusedQueryVariants(album);
  const queries = new Set<string>();

  if (rawQuery) {
    queries.add(rawQuery);
  }

  if (normalizedRawQuery && normalizedRawQuery !== rawQuery) {
    queries.add(normalizedRawQuery);
  }

  if (meaningfulReleasegroupQuery) {
    queries.add(meaningfulReleasegroupQuery);
  }

  for (const titleFocusedQuery of titleFocusedQueries) {
    queries.add(titleFocusedQuery);
  }

  if (artist.trim()) {
    queries.add(buildReleaseGroupQuery(album, artist));
  }

  if (hints.artistHint) {
    queries.add(buildReleaseGroupQuery(hints.albumHint, hints.artistHint));
    queries.add(`releasegroup:${normalizeWords(hints.albumHint)} artist:${normalizeWords(hints.artistHint)}`);
  }

  return [...queries].filter((query) => query.length > 0).slice(0, 6);
}

function queryLooksAlbumLike(album: string, artist: string) {
  const query = `${album} ${artist}`;
  return !includesAny(query, ["single", "ep", "live", "remix", "karaoke", "tribute"]);
}

function isLikelyPenaltyTermMatch(candidateValue: string, queryValue: string, terms: string[]) {
  const queryIncludesTerms = includesAny(queryValue, terms);
  const valueIncludesTerms = includesAny(candidateValue, terms);
  return valueIncludesTerms && !queryIncludesTerms;
}

function releaseGroupScore(
  releaseGroupTitle: string,
  releaseGroupArtist: string,
  releaseGroupDisambiguation: string,
  releaseYear: string,
  hasFirstReleaseDate: boolean,
  primaryType?: string,
  secondaryTypes?: string[],
  searchAlbum = "",
  searchArtist = ""
) {
  const normalizedTitle = normalizeWords(releaseGroupTitle);
  const normalizedArtist = normalizeWords(releaseGroupArtist);
  const normalizedDisambiguation = normalizeWords(releaseGroupDisambiguation);
  const normalizedSearchAlbum = normalizeWords(searchAlbum);
  const normalizedSearchArtist = normalizeWords(searchArtist);
  const normalizedType = normalizeWords(primaryType ?? "");
  const normalizedSecondaryTypes = (secondaryTypes ?? []).map((value) => normalizeWords(value));
  const combinedResultText = `${normalizedTitle} ${normalizedArtist} ${normalizedDisambiguation}`;
  const combinedQueryText = `${searchAlbum} ${searchArtist}`;
  const normalizedQueryText = normalizeWords(combinedQueryText);

  const queryTokens = buildTokenSet(normalizedQueryText, true);
  const titleTokens = buildTokenSet(normalizedTitle, true);
  const artistTokens = buildTokenSet(normalizedArtist);
  const combinedTokens = buildTokenSet(`${normalizedTitle} ${normalizedArtist}`);

  const titleCoverage = coverageRatio(queryTokens, titleTokens);
  const artistCoverage = coverageRatio(queryTokens, artistTokens);
  const combinedCoverage = coverageRatio(queryTokens, combinedTokens);

  const wantsAlbum = queryLooksAlbumLike(searchAlbum, searchArtist);
  const titleTokenSequence = tokenizeQuery(normalizedTitle);
  const queryTokenSequence = tokenizeQuery(normalizedQueryText);

  let titleOrderMatches = 0;
  let titleOrderCursor = 0;
  for (const token of queryTokenSequence) {
    while (titleOrderCursor < titleTokenSequence.length && titleTokenSequence[titleOrderCursor] !== token) {
      titleOrderCursor += 1;
    }
    if (titleOrderCursor < titleTokenSequence.length) {
      titleOrderMatches += 1;
      titleOrderCursor += 1;
    }
  }

  const allQueryTokensInTitle = queryTokens.size > 0 && titleCoverage === 1;
  const queryTokensInTitleOrder =
    queryTokenSequence.length > 0 && titleOrderMatches === queryTokenSequence.length;

  const hasLiveSignals =
    normalizedSecondaryTypes.some((value) => value.includes("live")) ||
    normalizedDisambiguation.includes("live") ||
    normalizedDisambiguation.includes("bootleg");

  const hasKaraokeSignals =
    normalizedTitle.includes("karaoke") ||
    normalizedArtist.includes("karaoke") ||
    normalizedDisambiguation.includes("karaoke");

  const hasTributeSignals =
    normalizedTitle.includes("tribute") ||
    normalizedArtist.includes("tribute") ||
    normalizedDisambiguation.includes("tribute");

  const hasVariousArtistSignals =
    normalizedArtist.includes("various artists") ||
    normalizedTitle.includes("various artists");

  let score = 0;

  if (normalizedTitle === normalizedSearchAlbum) {
    score += 170;
  } else if (normalizedTitle.startsWith(normalizedSearchAlbum)) {
    score += 120;
  } else if (normalizedTitle.includes(normalizedSearchAlbum) || normalizedSearchAlbum.includes(normalizedTitle)) {
    score += 70;
  }

  if (normalizedQueryText && normalizedTitle.includes(normalizedQueryText)) {
    score += 90;
  }

  if (normalizedQueryText && `${normalizedTitle} ${normalizedArtist}`.includes(normalizedQueryText)) {
    score += 70;
  }

  score += Math.round(combinedCoverage * 220);
  score += Math.round(titleCoverage * 95);
  score += Math.round(artistCoverage * 85);

  if (!normalizedSearchArtist) {
    score += Math.round(titleCoverage * 170);
  }

  if (allQueryTokensInTitle) {
    score += 150;
  }

  if (queryTokensInTitleOrder) {
    score += 80;
  }

  score += tokenOverlapScore(normalizedTitle, normalizedSearchAlbum);

  if (normalizedSearchArtist) {
    if (normalizedArtist === normalizedSearchArtist) {
      score += 115;
    } else if (normalizedArtist.includes(normalizedSearchArtist)) {
      score += 60;
    } else {
      score -= 18;
    }

    score += Math.round(tokenOverlapScore(normalizedArtist, normalizedSearchArtist) * 0.6);
  }

  if (!normalizedTitle || !normalizedArtist) {
    score -= 40;
  }

  if (!hasFirstReleaseDate) {
    score -= 8;
  }

  if (normalizedType === "album") {
    score += 65;
  } else if (normalizedType === "ep") {
    score += wantsAlbum ? -18 : 8;
  } else if (normalizedType === "single") {
    score += wantsAlbum ? -30 : 8;
  } else if (!normalizedType) {
    score -= 6;
  }

  if (normalizedSecondaryTypes.length) {
    score += 4;
  }

  if (normalizedSecondaryTypes.some((value) => value.includes("remix")) && !includesAny(searchAlbum, ["remix"])) {
    score -= 16;
  }

  if (normalizedSecondaryTypes.some((value) => value.includes("demo")) && !includesAny(searchAlbum, ["demo"])) {
    score -= 16;
  }

  if (normalizedSecondaryTypes.some((value) => value.includes("compilation")) && wantsAlbum) {
    score -= 28;
  }

  if (hasLiveSignals && !includesAny(`${searchAlbum} ${searchArtist}`, ["live", "bootleg"])) {
    score -= 24;
  }

  if (hasKaraokeSignals && isLikelyPenaltyTermMatch(combinedResultText, combinedQueryText, ["karaoke"])) {
    score -= 35;
  }

  if (hasTributeSignals && isLikelyPenaltyTermMatch(combinedResultText, combinedQueryText, ["tribute"])) {
    score -= 28;
  }

  if (hasVariousArtistSignals && !includesAny(`${searchAlbum} ${searchArtist}`, ["various", "compilation", "soundtrack"])) {
    score -= 20;
  }

  if (releaseGroupArtist && normalizeText(releaseGroupArtist) !== "unknown artist") {
    score += 12;
  }

  if (hasFirstReleaseDate) {
    score += 14;
  }

  if (releaseYear !== "Unknown") {
    const year = Number.parseInt(releaseYear, 10);
    if (Number.isFinite(year)) {
      if (year <= 1999) {
        score += 6;
      } else if (year >= 2015) {
        score -= 4;
      }
    }
  }

  if (normalizedSecondaryTypes.some((value) => value.includes("soundtrack")) && includesAny(searchAlbum, ["soundtrack", "ost", "score"])) {
    score += 12;
  }

  return score;
}

function buildArtworkCacheKey(releaseId?: string, releaseGroupId?: string): string {
  return `r:${releaseId?.trim() ?? ""}|g:${releaseGroupId?.trim() ?? ""}`;
}

function isTransientHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function isTransientNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("abort")
  );
}

function isCoverArtMetadataEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.toLowerCase().endsWith("coverartarchive.org")) {
      return false;
    }

    return /^\/(release|release-group)\/[0-9a-f-]+\/?$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function sanitizeCoverArtCandidate(rawUrl: unknown): string | null {
  if (typeof rawUrl !== "string") {
    return null;
  }

  const normalized = normalizeAlbumArtUrlOrNull(rawUrl);
  if (!normalized) {
    return null;
  }

  if (isCoverArtMetadataEndpoint(normalized)) {
    return null;
  }

  return normalized;
}

function dedupeUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of urls) {
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    deduped.push(value);
  }

  return deduped;
}

type CoverArtArchiveImageRow = {
  front?: boolean;
  image?: string;
  release?: string | { id?: string };
  thumbnails?: Record<string, string | undefined>;
};

type CoverArtArchivePayload = {
  images?: CoverArtArchiveImageRow[];
};

type CoverArtCandidate = {
  url: string;
  identity: CoverArtArchiveArtworkIdentity | null;
  sourceReleaseMbid: string | null;
  sourceReleaseFieldKind: "string" | "object" | "missing";
};

type ParsedCoverArtCandidates = {
  primaryUrl: string;
  fallbackUrl?: string;
  candidates: CoverArtCandidate[];
  sourceReleaseMbid?: string;
};

type CoverArtLookupResult = {
  status: "valid" | "no-art" | "transient-failure" | "malformed-url";
  metadataEndpoint: string;
  attempt: number;
  path: "release" | "release-group";
  primaryUrl: string;
  fallbackUrl?: string;
  candidates: CoverArtCandidate[];
  sourceReleaseMbid?: string;
};

type MusicBrainzReleaseLookupPayload = {
  "release-group"?: {
    id?: string;
  };
};

type MusicBrainzGroupReleaseRow = {
  id?: string;
  title?: string;
  status?: string;
  date?: string;
  country?: string;
  "release-group"?: {
    id?: string;
    "primary-type"?: string;
  };
  "cover-art-archive"?: {
    front?: boolean;
  };
};

type MusicBrainzReleaseBrowsePayload = {
  releases?: MusicBrainzGroupReleaseRow[];
};

type AlternateReleaseCandidate = {
  releaseMbid: string;
  status: string;
  date: string;
  country: string;
  hasFrontCover: boolean | null;
  primaryType: string;
};

function readSourceReleaseMbid(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(trimmed)) {
      return trimmed;
    }
  }

  if (value && typeof value === "object") {
    const record = value as { id?: unknown };
    if (typeof record.id === "string") {
      const trimmed = record.id.trim().toLowerCase();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(trimmed)) {
        return trimmed;
      }
    }
  }

  return null;
}

function readSourceReleaseFieldKind(value: unknown): "string" | "object" | "missing" {
  if (typeof value === "string") {
    return "string";
  }

  if (value && typeof value === "object") {
    return "object";
  }

  return "missing";
}

function parseCoverArtUrls(
  payload: CoverArtArchivePayload,
  kind: "release" | "release-group",
  fallbackSourceMbid: string
): ParsedCoverArtCandidates | null {
  const images = Array.isArray(payload.images) ? payload.images : [];
  if (!images.length) {
    return null;
  }

  const frontCandidates = images.filter((image) => image.front);
  const selectedImages = frontCandidates.length ? frontCandidates : images;
  const dedupedCandidates: CoverArtCandidate[] = [];
  const seenCandidateKeys = new Set<string>();
  const seenIdentityKeys = new Set<string>();

  for (const imageRow of selectedImages) {
    const sourceReleaseFieldKind = readSourceReleaseFieldKind(imageRow.release);
    const sourceReleaseMbid = readSourceReleaseMbid(imageRow.release) ?? fallbackSourceMbid;

    const thumbnailSmall = sanitizeCoverArtCandidate(imageRow.thumbnails?.small);
    const thumbnail250 = sanitizeCoverArtCandidate(imageRow.thumbnails?.["250"]);
    const thumbnail500 = sanitizeCoverArtCandidate(imageRow.thumbnails?.["500"]);
    const thumbnailLarge = sanitizeCoverArtCandidate(imageRow.thumbnails?.large);
    const fullImage = sanitizeCoverArtCandidate(imageRow.image);

    const preferredOrder = dedupeUrls([
      thumbnailSmall,
      thumbnail250,
      thumbnail500,
      thumbnailLarge,
      fullImage,
    ]);

    for (const candidateUrl of preferredOrder) {
      const identity = parseCoverArtArchiveArtworkIdentity(candidateUrl);
      const candidateKey = `${candidateUrl}::${sourceReleaseMbid}`;

      if (seenCandidateKeys.has(candidateKey)) {
        continue;
      }

      if (identity?.imageId) {
        const identityKey = `${identity.kind}:${identity.mbid}:${identity.imageId}:${sourceReleaseMbid}`;
        if (seenIdentityKeys.has(identityKey)) {
          continue;
        }
        seenIdentityKeys.add(identityKey);
      }

      seenCandidateKeys.add(candidateKey);
      dedupedCandidates.push({
        url: candidateUrl,
        identity,
        sourceReleaseMbid,
        sourceReleaseFieldKind,
      });
    }
  }

  if (!dedupedCandidates.length) {
    return null;
  }

  const firstWithSourceRelease = dedupedCandidates.find((candidate) => candidate.sourceReleaseMbid)?.sourceReleaseMbid;

  return {
    primaryUrl: dedupedCandidates[0].url,
    fallbackUrl: dedupedCandidates[1]?.url,
    candidates: dedupedCandidates,
    sourceReleaseMbid: firstWithSourceRelease ?? undefined,
  };
}

function toArtworkResolution(outcome: CoverArtLookupResult): ArtworkResolution {
  return {
    status: outcome.status,
    url: outcome.primaryUrl,
    fallbackUrl: outcome.fallbackUrl,
    metadataEndpoint: outcome.metadataEndpoint,
    path: outcome.path,
    attempt: outcome.attempt,
  };
}

function toIdentityKey(identity: CoverArtArchiveArtworkIdentity | null): string | null {
  if (!identity?.imageId) {
    return null;
  }

  return `${identity.kind}:${identity.mbid}:${identity.imageId}`;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARTWORK_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "RecordQuest/1.0 (https://recordquest.app)",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupCoverArtCandidatesById(
  id: string,
  kind: "release" | "release-group",
  maxAttempts = 2
): Promise<CoverArtLookupResult> {
  const trimmedId = id.trim();
  if (!trimmedId) {
    return {
      status: "no-art",
      primaryUrl: "",
      candidates: [],
      metadataEndpoint: "",
      path: kind,
      attempt: 1,
    };
  }

  const endpoint = kind === "release" ? COVER_ART_RELEASE_URL : COVER_ART_RELEASE_GROUP_URL;
  const metadataEndpoint = `${endpoint}/${trimmedId}`;
  const requestKey = `${kind}:${trimmedId}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = Date.now();

    function logTerminalOutcome(outcome: string, extra?: Record<string, unknown>): void {
      if (!__DEV__) {
        return;
      }

      console.log("[RecordQuest][artwork] lookup terminal", {
        requestKey,
        stage: kind,
        mbid: trimmedId,
        metadataEndpoint,
        attempt,
        elapsedMs: Date.now() - startedAt,
        outcome,
        ...(extra ?? {}),
      });
    }

    if (__DEV__) {
      console.log("[RecordQuest][artwork] lookup attempt", {
        stage: kind,
        requestKey: `${kind}:${trimmedId}`,
        attempt,
        id: trimmedId,
      });
    }

    try {
      const response = await fetchWithTimeout(metadataEndpoint);

      if (response.ok) {
        const payload = (await response.json()) as CoverArtArchivePayload;
        const parsed = parseCoverArtUrls(payload, kind, trimmedId);

        if (!parsed) {
          logTerminalOutcome("no-front-images");
          return {
            status: "no-art",
            primaryUrl: "",
            candidates: [],
            metadataEndpoint,
            path: kind,
            attempt,
          };
        }

        if (__DEV__) {
          console.log("[RecordQuest][artwork] metadata parsed", {
            stage: kind,
            id: trimmedId,
            metadataEndpoint,
            selectedPrimaryUrl: parsed.primaryUrl,
            selectedFallbackUrl: parsed.fallbackUrl ?? null,
            candidateCount: parsed.candidates.length,
          });
        }

        logTerminalOutcome("metadata-parsed", {
          sourceReleaseMbid: parsed.sourceReleaseMbid ?? null,
          candidateCount: parsed.candidates.length,
        });

        return {
          status: "valid",
          primaryUrl: parsed.primaryUrl,
          fallbackUrl: parsed.fallbackUrl,
          candidates: parsed.candidates,
          sourceReleaseMbid: parsed.sourceReleaseMbid,
          metadataEndpoint,
          path: kind,
          attempt,
        };
      }

      if (response.status === 404) {
        logTerminalOutcome("http-non-success", { status: response.status });
        return {
          status: "no-art",
          primaryUrl: "",
          candidates: [],
          metadataEndpoint,
          path: kind,
          attempt,
        };
      }

      if (isTransientHttpStatus(response.status) && attempt < maxAttempts) {
        if (__DEV__) {
          console.log("[RecordQuest][artwork] transient http retry", {
            requestKey,
            status: response.status,
            attempt,
          });
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 350));
        continue;
      }

      logTerminalOutcome("http-non-success", { status: response.status });

      return {
        status: isTransientHttpStatus(response.status) ? "transient-failure" : "no-art",
        primaryUrl: "",
        candidates: [],
        metadataEndpoint,
        path: kind,
        attempt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      const timeout = message.toLowerCase().includes("abort");

      if (isTransientNetworkError(error) && attempt < maxAttempts) {
        if (__DEV__) {
          console.log("[RecordQuest][artwork] transient network retry", {
            requestKey,
            attempt,
            message,
            timeout,
          });
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 350));
        continue;
      }

      logTerminalOutcome(timeout ? "timeout" : "fetch-exception", {
        message,
      });

      return {
        status: isTransientNetworkError(error) ? "transient-failure" : "no-art",
        primaryUrl: "",
        candidates: [],
        metadataEndpoint,
        path: kind,
        attempt,
      };
    }
  }

  if (__DEV__) {
    console.log("[RecordQuest][artwork] lookup terminal", {
      requestKey,
      stage: kind,
      mbid: trimmedId,
      metadataEndpoint,
      attempt: maxAttempts,
      outcome: "transient-failure-after-final-retry",
    });
  }

  return {
    status: "transient-failure",
    primaryUrl: "",
    candidates: [],
    metadataEndpoint,
    path: kind,
    attempt: maxAttempts,
  };
}

async function lookupCoverArtById(
  id: string,
  kind: "release" | "release-group"
): Promise<ArtworkResolution> {
  const lookup = await lookupCoverArtCandidatesById(id, kind);
  return toArtworkResolution(lookup);
}

type ArtworkSelectionInput = {
  preferredUrl?: string;
  releaseId?: string;
  releaseGroupId?: string;
  selectedAlbumLabel: string;
};

export type LegacyArtworkRepairResult = {
  status:
    | "identical-result"
    | "same-image-alternate-size"
    | "alternate-image-found"
    | "alternate-release-found"
    | "no-alternate-art"
    | "transient-metadata-failure"
    | "unrepairable";
  url: string;
  fallbackUrl?: string;
  metadataEndpoint?: string;
  releaseGroupMetadataEndpoint?: string;
  releaseGroupMbid?: string;
  sourceReleaseMbid?: string;
  candidateIndex?: number;
  candidateReleaseMbid?: string;
  kind?: CoverArtArchiveLegacyKind;
  mbid?: string;
};

type LegacyRepairContext = {
  failedUrl: string;
  attemptedUrls: string[];
  attemptedReleaseMbids?: string[];
  originReleaseMbid?: string;
  resolvedReleaseGroupMbid?: string;
};

function buildAttemptedSet(attemptedUrls: string[]): Set<string> {
  const attempted = new Set<string>();
  for (const url of attemptedUrls) {
    const normalized = normalizeAlbumArtUrlOrNull(url);
    if (normalized) {
      attempted.add(normalized);
    }
  }

  return attempted;
}

function isSameImageAlternateSize(
  failedIdentity: CoverArtArchiveArtworkIdentity | null,
  candidateIdentity: CoverArtArchiveArtworkIdentity | null,
  failedUrl: string,
  candidateUrl: string
): boolean {
  if (!isEquivalentCoverArtArchiveImage(failedIdentity, candidateIdentity)) {
    return false;
  }

  return normalizeAlbumArtUrlOrNull(failedUrl) !== normalizeAlbumArtUrlOrNull(candidateUrl);
}

async function resolveReleaseGroupIdForRelease(releaseId: string): Promise<string> {
  const trimmedReleaseId = releaseId.trim().toLowerCase();
  if (!trimmedReleaseId) {
    return "";
  }

  const cached = releaseToReleaseGroupCache.get(trimmedReleaseId);
  if (typeof cached === "string") {
    return cached;
  }

  const inFlight = pendingReleaseToGroupRequests.get(trimmedReleaseId);
  if (inFlight) {
    return inFlight;
  }

  const request: Promise<string> = (async () => {
    const endpoint = `${MUSICBRAINZ_RELEASE_URL}/${trimmedReleaseId}?inc=release-groups&fmt=json`;

    try {
      const response = await fetchWithTimeout(endpoint);
      if (!response.ok) {
        releaseToReleaseGroupCache.set(trimmedReleaseId, "");
        return "";
      }

      const payload = (await response.json()) as MusicBrainzReleaseLookupPayload;
      const releaseGroupId = payload["release-group"]?.id?.trim().toLowerCase() ?? "";
      releaseToReleaseGroupCache.set(trimmedReleaseId, releaseGroupId);
      return releaseGroupId;
    } catch {
      return "";
    } finally {
      pendingReleaseToGroupRequests.delete(trimmedReleaseId);
    }
  })();

  pendingReleaseToGroupRequests.set(trimmedReleaseId, request);
  return request;
}

function scoreAlternateReleaseCandidate(candidate: AlternateReleaseCandidate): number {
  let score = 0;

  const status = candidate.status.toLowerCase();
  const primaryType = candidate.primaryType.toLowerCase();

  if (status === "official") {
    score += 60;
  }

  if (primaryType === "album") {
    score += 40;
  }

  if (candidate.hasFrontCover === true) {
    score += 35;
  } else if (candidate.hasFrontCover === false) {
    score -= 25;
  }

  if (candidate.country) {
    score += 10;
  }

  if (candidate.date) {
    score += 10;
  }

  return score;
}

async function loadAlternateReleasesForReleaseGroup(releaseGroupMbid: string): Promise<AlternateReleaseCandidate[]> {
  const trimmedGroupMbid = releaseGroupMbid.trim().toLowerCase();
  if (!trimmedGroupMbid) {
    return [];
  }

  const cached = releaseGroupAlternateReleaseCache.get(trimmedGroupMbid);
  if (cached) {
    return cached;
  }

  const inFlight = pendingReleaseGroupAlternateReleaseRequests.get(trimmedGroupMbid);
  if (inFlight) {
    return inFlight;
  }

  const request: Promise<AlternateReleaseCandidate[]> = (async () => {
    const endpoint = `${MUSICBRAINZ_RELEASE_URL}?release-group=${encodeURIComponent(trimmedGroupMbid)}&fmt=json&limit=100`;

    try {
      const response = await fetchWithTimeout(endpoint);
      if (!response.ok) {
        if (__DEV__) {
          console.log("[RecordQuest][artwork] musicbrainz alternate releases terminal", {
            requestKey: `mb-release-group-releases:${trimmedGroupMbid}`,
            endpoint,
            outcome: "http-non-success",
            status: response.status,
          });
        }

        releaseGroupAlternateReleaseCache.set(trimmedGroupMbid, []);
        return [];
      }

      let payload: MusicBrainzReleaseBrowsePayload;

      try {
        payload = (await response.json()) as MusicBrainzReleaseBrowsePayload;
      } catch (error) {
        if (__DEV__) {
          console.log("[RecordQuest][artwork] musicbrainz alternate releases terminal", {
            requestKey: `mb-release-group-releases:${trimmedGroupMbid}`,
            endpoint,
            outcome: "json-parse-failure",
            message: error instanceof Error ? error.message : "unknown error",
          });
        }

        releaseGroupAlternateReleaseCache.set(trimmedGroupMbid, []);
        return [];
      }

      const rows = Array.isArray(payload.releases) ? payload.releases : [];

      const seenReleaseIds = new Set<string>();
      const candidates: AlternateReleaseCandidate[] = [];

      for (const row of rows) {
        const releaseMbid = row.id?.trim().toLowerCase() ?? "";
        if (!releaseMbid || seenReleaseIds.has(releaseMbid)) {
          continue;
        }

        seenReleaseIds.add(releaseMbid);
        candidates.push({
          releaseMbid,
          status: row.status?.trim() ?? "",
          date: row.date?.trim() ?? "",
          country: row.country?.trim() ?? "",
          hasFrontCover:
            typeof row["cover-art-archive"]?.front === "boolean"
              ? row["cover-art-archive"]?.front
              : null,
          primaryType: row["release-group"]?.["primary-type"]?.trim() ?? "",
        });
      }

      candidates.sort((a, b) => scoreAlternateReleaseCandidate(b) - scoreAlternateReleaseCandidate(a));
      releaseGroupAlternateReleaseCache.set(trimmedGroupMbid, candidates);

      if (__DEV__) {
        console.log("[RecordQuest][artwork] musicbrainz alternate releases terminal", {
          requestKey: `mb-release-group-releases:${trimmedGroupMbid}`,
          endpoint,
          outcome: "success",
          candidateCount: candidates.length,
        });
      }

      return candidates;
    } catch (error) {
      if (__DEV__) {
        const message = error instanceof Error ? error.message : "unknown error";
        console.log("[RecordQuest][artwork] musicbrainz alternate releases terminal", {
          requestKey: `mb-release-group-releases:${trimmedGroupMbid}`,
          endpoint,
          outcome: message.toLowerCase().includes("abort") ? "timeout" : "fetch-exception",
          message,
        });
      }

      return [];
    } finally {
      pendingReleaseGroupAlternateReleaseRequests.delete(trimmedGroupMbid);
    }
  })();

  pendingReleaseGroupAlternateReleaseRequests.set(trimmedGroupMbid, request);
  return request;
}

function pickAlternateCandidate(
  failedUrl: string,
  failedIdentity: CoverArtArchiveArtworkIdentity | null,
  candidates: CoverArtCandidate[],
  attemptedSet: Set<string>,
  excludedIdentityKeys: Set<string>
): {
  candidate: CoverArtCandidate | null;
  rejectedAsIdentical: string[];
  rejectedAsSameImageAlternateSize: string[];
} {
  const rejectedAsIdentical: string[] = [];
  const rejectedAsSameImageAlternateSize: string[] = [];

  const normalizedFailedUrl = normalizeAlbumArtUrlOrNull(failedUrl);

  for (const candidate of candidates) {
    const normalizedCandidateUrl = normalizeAlbumArtUrlOrNull(candidate.url);
    if (!normalizedCandidateUrl) {
      continue;
    }

    if (attemptedSet.has(normalizedCandidateUrl)) {
      rejectedAsIdentical.push(normalizedCandidateUrl);
      continue;
    }

    if (normalizedFailedUrl && normalizedCandidateUrl === normalizedFailedUrl) {
      rejectedAsIdentical.push(normalizedCandidateUrl);
      continue;
    }

    if (isSameImageAlternateSize(failedIdentity, candidate.identity, failedUrl, normalizedCandidateUrl)) {
      rejectedAsSameImageAlternateSize.push(normalizedCandidateUrl);
      continue;
    }

    const identityKey = toIdentityKey(candidate.identity);
    if (identityKey && excludedIdentityKeys.has(identityKey)) {
      rejectedAsSameImageAlternateSize.push(normalizedCandidateUrl);
      continue;
    }

    return {
      candidate,
      rejectedAsIdentical,
      rejectedAsSameImageAlternateSize,
    };
  }

  return {
    candidate: null,
    rejectedAsIdentical,
    rejectedAsSameImageAlternateSize,
  };
}

async function resolveArtworkForSelection(input: ArtworkSelectionInput): Promise<ArtworkResolution> {
  const preferredUrl = normalizeAlbumArtUrlOrNull(input.preferredUrl);
  const releaseId = input.releaseId?.trim() || "";
  const releaseGroupId = input.releaseGroupId?.trim() || "";
  const cacheKey = buildArtworkCacheKey(releaseId, releaseGroupId);

  if (__DEV__) {
    console.log("[RecordQuest][artwork] resolve start", {
      album: input.selectedAlbumLabel,
      hasPreferred: Boolean(preferredUrl),
      hasReleaseId: Boolean(releaseId),
      hasReleaseGroupId: Boolean(releaseGroupId),
    });
  }

  if (preferredUrl) {
    if (__DEV__) {
      console.log("[RecordQuest][artwork] resolve result", {
        album: input.selectedAlbumLabel,
        classification: "valid artwork",
        path: "preferred",
      });
    }

    return {
      status: "valid",
      url: preferredUrl,
      path: "preferred",
      attempt: 1,
    };
  }

  if (!releaseId && !releaseGroupId) {
    return {
      status: "no-art",
      url: "",
      path: "none",
      attempt: 1,
    };
  }

  const cached = artworkResolutionCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return {
      status: cached.status,
      url: cached.url,
      fallbackUrl: cached.fallbackUrl,
      path: "none",
      attempt: 1,
    };
  }

  const inFlight = pendingArtworkRequests.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const request: Promise<ArtworkResolution> = (async (): Promise<ArtworkResolution> => {
    if (releaseId) {
      const releaseOutcome = await lookupCoverArtById(releaseId, "release");

      if (releaseOutcome.status === "valid") {
        artworkResolutionCache.set(cacheKey, {
          status: "valid",
          url: releaseOutcome.url,
          fallbackUrl: releaseOutcome.fallbackUrl ?? "",
          expiresAt: Date.now() + NO_ART_CACHE_TTL_MS,
        });
        return releaseOutcome;
      }

      if (!releaseGroupId) {
        if (releaseOutcome.status === "no-art") {
          artworkResolutionCache.set(cacheKey, {
            status: "no-art",
            url: "",
            fallbackUrl: "",
            expiresAt: Date.now() + NO_ART_CACHE_TTL_MS,
          });
        }
        return releaseOutcome;
      }
    }

    if (releaseGroupId) {
      const groupOutcome = await lookupCoverArtById(releaseGroupId, "release-group");

      if (groupOutcome.status === "valid") {
        artworkResolutionCache.set(cacheKey, {
          status: "valid",
          url: groupOutcome.url,
          fallbackUrl: groupOutcome.fallbackUrl ?? "",
          expiresAt: Date.now() + NO_ART_CACHE_TTL_MS,
        });
        return groupOutcome;
      }

      if (groupOutcome.status === "no-art") {
        artworkResolutionCache.set(cacheKey, {
          status: "no-art",
          url: "",
          fallbackUrl: "",
          expiresAt: Date.now() + NO_ART_CACHE_TTL_MS,
        });
      }

      return groupOutcome;
    }

    return {
      status: "no-art",
      url: "",
      path: "none",
      attempt: 1,
    };
  })();

  pendingArtworkRequests.set(cacheKey, request);

  try {
    const outcome = await request;

    if (__DEV__) {
      console.log("[RecordQuest][artwork] resolve result", {
        album: input.selectedAlbumLabel,
        classification:
          outcome.status === "valid"
            ? "valid artwork"
            : outcome.status === "no-art"
              ? "confirmed no artwork"
              : outcome.status === "transient-failure"
                ? "transient failure"
                : "malformed URL",
        path: outcome.path,
        attempt: outcome.attempt,
      });
    }

    return outcome;
  } finally {
    pendingArtworkRequests.delete(cacheKey);
  }
}

async function findReleaseGroups(query: string) {
  const response = await fetch(`${MUSICBRAINZ_RELEASE_GROUP_URL}/?query=${encodeURIComponent(query)}&fmt=json&limit=18`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "RecordQuest/1.0 (https://recordquest.app)",
    },
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz search failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    "release-groups"?: ReleaseGroupRow[];
  };

  return data["release-groups"] ?? [];
}

function buildArtistName(releaseGroup: ReleaseGroupRow) {
  return (
    releaseGroup["artist-credit"]
      ?.map((credit) => credit.name || credit.artist?.name || "")
      .filter(Boolean)
      .join(", ") || releaseGroup["artist-credit-phrase"] || "Unknown artist"
  );
}

function dedupeReleaseGroupsById(releaseGroups: ReleaseGroupRow[]): ReleaseGroupRow[] {
  const seen = new Set<string>();
  const deduped: ReleaseGroupRow[] = [];

  for (const group of releaseGroups) {
    const id = group.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push(group);
  }

  return deduped;
}

async function mapReleaseGroupsToResults(
  releaseGroups: ReleaseGroupRow[],
  album: string,
  artist: string
) {
  const scoredResults: ScoredAlbumSearchResult[] = (
    releaseGroups || []
  ).map((releaseGroup) => {
    const artistName = buildArtistName(releaseGroup);
    const albumTitle = releaseGroup.title?.trim() || album.trim();
    const year = normalizeYear(releaseGroup["first-release-date"]);
    const score = releaseGroupScore(
      albumTitle,
      artistName,
      releaseGroup.disambiguation?.trim() || "",
      year,
      !!releaseGroup["first-release-date"],
      releaseGroup["primary-type"],
      releaseGroup["secondary-types"],
      album,
      artist
    );

    return {
      id: releaseGroup.id || `${albumTitle}-${artistName}`,
      releaseGroupId: releaseGroup.id || undefined,
      album: albumTitle,
      artist: artistName,
      year,
      cover: "",
      coverThumbnail: undefined,
      genre: buildGenre(releaseGroup["primary-type"], releaseGroup["secondary-types"]),
      format: buildReleaseFormat(releaseGroup["primary-type"]),
      score,
    };
  });

  return scoredResults
    .filter((result) => result.album)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export async function searchAlbumResults(album: string, artist: string) {
  if (!album.trim()) {
    return [] as AlbumSearchResult[];
  }

  const cacheKey = searchCacheKey(album, artist);
  const cachedResults = searchCache.get(cacheKey);
  if (cachedResults) {
    return cachedResults;
  }

  const pendingSearch = pendingSearchRequests.get(cacheKey);
  if (pendingSearch) {
    return pendingSearch;
  }

  const searchPromise = (async () => {
    const queries = buildLooseQueries(album, artist);
    const releaseGroupResponses = await Promise.all(queries.map((query) => findReleaseGroups(query)));

    const mergedReleaseGroups = dedupeReleaseGroupsById(releaseGroupResponses.flat());

    let results = await mapReleaseGroupsToResults(mergedReleaseGroups, album, artist);
    results = results
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        const resolution = await resolveArtworkForSelection({
          preferredUrl: result.cover,
          releaseId: result.releaseId,
          releaseGroupId: result.releaseGroupId || result.id,
          selectedAlbumLabel: `${result.album} - ${result.artist}`,
        });

        const cover = resolution.status === "valid" ? resolution.url : "";
        const coverThumbnail = resolution.status === "valid" ? resolution.fallbackUrl ?? cover : undefined;

        return {
          ...result,
          cover,
          coverThumbnail,
          score: result.score + (cover ? 16 : 0),
        } satisfies ScoredAlbumSearchResult;
      })
    );

    const finalResults = enrichedResults
      .sort((a, b) => {
        const scoreDiff = b.score - a.score;
        if (scoreDiff !== 0) return scoreDiff;

        if (
          normalizeWords(a.album) === normalizeWords(b.album) &&
          normalizeWords(a.artist) === normalizeWords(b.artist)
        ) {
          const yearA = Number.parseInt(a.year, 10);
          const yearB = Number.parseInt(b.year, 10);

          if (Number.isFinite(yearA) && Number.isFinite(yearB)) {
            return yearA - yearB;
          }
        }

        return b.album.length - a.album.length;
      })
      .slice(0, 8)
      .map(({ score, ...result }) => result);

    setSearchCache(cacheKey, finalResults);
    return finalResults;
  })();

  pendingSearchRequests.set(cacheKey, searchPromise);

  try {
    return await searchPromise;
  } finally {
    pendingSearchRequests.delete(cacheKey);
  }
}

export async function lookupAlbumMetadata(album: string, artist: string) {
  let firstMatch: AlbumSearchResult | undefined;

  try {
    [firstMatch] = await searchAlbumResults(album, artist);
  } catch (error) {
    console.warn("Album metadata lookup failed:", error);
    return null;
  }

  if (!firstMatch) {
    return null;
  }

  return {
    year: firstMatch.year,
    cover: firstMatch.cover,
    genre: firstMatch.genre,
  };
}

export async function resolveSearchResultArtwork(result: AlbumSearchResult): Promise<string> {
  const resolution = await resolveArtworkForSelection({
    preferredUrl: result.cover,
    releaseId: result.releaseId,
    releaseGroupId: result.releaseGroupId || result.id,
    selectedAlbumLabel: `${result.album} - ${result.artist}`,
  });

  return resolution.status === "valid" ? resolution.url : "";
}

export async function repairLegacyCoverArtUrl(
  rawUrl: string,
  context: LegacyRepairContext
): Promise<LegacyArtworkRepairResult> {
  const legacyMatch = matchLegacyConstructedCoverArtArchiveUrl(rawUrl);

  if (!legacyMatch) {
    return {
      status: "unrepairable",
      url: "",
    };
  }

  const failedUrl = normalizeAlbumArtUrlOrNull(context.failedUrl) ?? normalizeAlbumArtUrlOrNull(rawUrl) ?? "";
  const attemptedSet = buildAttemptedSet(context.attemptedUrls);
  if (failedUrl) {
    attemptedSet.add(failedUrl);
  }

  const attemptedReleaseSet = new Set(
    (context.attemptedReleaseMbids ?? [])
      .map((mbid) => mbid.trim().toLowerCase())
      .filter((mbid) => mbid.length > 0)
  );

  const failedIdentity = parseCoverArtArchiveArtworkIdentity(failedUrl || rawUrl);
  const failedIdentityKey = toIdentityKey(failedIdentity);
  const excludedIdentityKeys = new Set<string>();

  if (failedIdentityKey) {
    excludedIdentityKeys.add(failedIdentityKey);
  }

  const attemptedUrlFingerprint = [...attemptedSet].sort().join("|");
  const attemptedReleaseFingerprint = [...attemptedReleaseSet].sort().join("|");
  const cacheKey = `${legacyMatch.kind}:${legacyMatch.mbid}:${failedIdentityKey ?? "no-image"}:${attemptedUrlFingerprint}:${attemptedReleaseFingerprint}`;
  const cached = legacyRepairCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inFlight = pendingLegacyRepairRequests.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const request: Promise<LegacyArtworkRepairResult> = (async () => {
    let hadIdenticalCandidate = false;
    let hadSameImageSizeVariant = false;
    let hadTransientFailure = false;

    const originReleaseMbid =
      context.originReleaseMbid?.trim().toLowerCase() ||
      (legacyMatch.kind === "release" ? legacyMatch.mbid : "");

    if (__DEV__) {
      console.log("[RecordQuest][artwork] repair start", {
        requestKey: `${legacyMatch.kind}:${legacyMatch.mbid}`,
        originalFailedReleaseMbid: originReleaseMbid || null,
      });
    }

    let releaseLookup: CoverArtLookupResult | null = null;

    if (legacyMatch.kind === "release") {
      releaseLookup = await lookupCoverArtCandidatesById(legacyMatch.mbid, "release", 1);

      if (releaseLookup.status === "transient-failure") {
        hadTransientFailure = true;
      }

      if (releaseLookup.status === "valid") {
        const sameReleasePick = pickAlternateCandidate(
          failedUrl || rawUrl,
          failedIdentity,
          releaseLookup.candidates,
          attemptedSet,
          excludedIdentityKeys
        );

        if (__DEV__) {
          console.log("[RecordQuest][artwork] release metadata candidates", {
            metadataEndpoint: releaseLookup.metadataEndpoint,
            candidateCount: releaseLookup.candidates.length,
            rejectedIdentical: sameReleasePick.rejectedAsIdentical,
            rejectedSameImageAlternateSize: sameReleasePick.rejectedAsSameImageAlternateSize,
          });
        }

        hadIdenticalCandidate = hadIdenticalCandidate || sameReleasePick.rejectedAsIdentical.length > 0;
        hadSameImageSizeVariant =
          hadSameImageSizeVariant || sameReleasePick.rejectedAsSameImageAlternateSize.length > 0;

        if (sameReleasePick.candidate) {
          return {
            status: "alternate-image-found",
            url: sameReleasePick.candidate.url,
            metadataEndpoint: releaseLookup.metadataEndpoint,
            kind: legacyMatch.kind,
            mbid: legacyMatch.mbid,
            sourceReleaseMbid: sameReleasePick.candidate.sourceReleaseMbid ?? undefined,
            candidateIndex: 0,
            candidateReleaseMbid: legacyMatch.mbid,
          };
        }
      }
    }

    const releaseGroupMbid =
      context.resolvedReleaseGroupMbid?.trim().toLowerCase() ||
      (legacyMatch.kind === "release-group"
        ? legacyMatch.mbid
        : originReleaseMbid
          ? await resolveReleaseGroupIdForRelease(originReleaseMbid)
          : "");

    if (__DEV__) {
      console.log("[RecordQuest][artwork] resolved release-group mbid", {
        requestKey: `${legacyMatch.kind}:${legacyMatch.mbid}`,
        releaseGroupMbid,
      });
    }

    if (!releaseGroupMbid) {
      return {
        status: hadTransientFailure ? "transient-metadata-failure" : "no-alternate-art",
        url: "",
        metadataEndpoint: releaseLookup?.metadataEndpoint,
        kind: legacyMatch.kind,
        mbid: legacyMatch.mbid,
      };
    }

    const alternateReleases = await loadAlternateReleasesForReleaseGroup(releaseGroupMbid);

    const filteredByFrontPreference = alternateReleases.filter((candidate) => candidate.hasFrontCover !== false);
    const pool = filteredByFrontPreference.length >= 3 ? filteredByFrontPreference : alternateReleases;

    const selectedAlternateReleases: AlternateReleaseCandidate[] = [];
    const seenReleaseIds = new Set<string>();

    for (const candidate of pool) {
      if (selectedAlternateReleases.length >= 3) {
        break;
      }

      if (!candidate.releaseMbid || seenReleaseIds.has(candidate.releaseMbid)) {
        continue;
      }

      if (originReleaseMbid && candidate.releaseMbid === originReleaseMbid) {
        continue;
      }

      if (attemptedReleaseSet.has(candidate.releaseMbid)) {
        continue;
      }

      seenReleaseIds.add(candidate.releaseMbid);
      selectedAlternateReleases.push(candidate);
    }

    if (__DEV__) {
      console.log("[RecordQuest][artwork] alternate release candidates", {
        requestKey: `${legacyMatch.kind}:${legacyMatch.mbid}`,
        releaseGroupMbid,
        count: selectedAlternateReleases.length,
        candidates: selectedAlternateReleases.map((candidate) => ({
          releaseMbid: candidate.releaseMbid,
          status: candidate.status,
          date: candidate.date,
          country: candidate.country,
          hasFrontCover: candidate.hasFrontCover,
        })),
      });
    }

    for (let index = 0; index < selectedAlternateReleases.length; index += 1) {
      const candidateRelease = selectedAlternateReleases[index];
      const lookup = await lookupCoverArtCandidatesById(candidateRelease.releaseMbid, "release", 1);

      if (lookup.status === "transient-failure") {
        hadTransientFailure = true;
        continue;
      }

      if (lookup.status !== "valid") {
        continue;
      }

      const pick = pickAlternateCandidate(
        failedUrl || rawUrl,
        failedIdentity,
        lookup.candidates,
        attemptedSet,
        excludedIdentityKeys
      );

      hadIdenticalCandidate = hadIdenticalCandidate || pick.rejectedAsIdentical.length > 0;
      hadSameImageSizeVariant =
        hadSameImageSizeVariant || pick.rejectedAsSameImageAlternateSize.length > 0;

      if (__DEV__) {
        console.log("[RecordQuest][artwork] alternate release lookup result", {
          requestKey: `${legacyMatch.kind}:${legacyMatch.mbid}`,
          candidateReleaseMbid: candidateRelease.releaseMbid,
          candidateIndex: index,
          metadataEndpoint: lookup.metadataEndpoint,
          rejectedIdentical: pick.rejectedAsIdentical,
          rejectedSameImageAlternateSize: pick.rejectedAsSameImageAlternateSize,
        });
      }

      if (pick.candidate) {
        return {
          status: "alternate-release-found",
          url: pick.candidate.url,
          metadataEndpoint: releaseLookup?.metadataEndpoint,
          releaseGroupMbid,
          sourceReleaseMbid: pick.candidate.sourceReleaseMbid ?? candidateRelease.releaseMbid,
          candidateIndex: index,
          candidateReleaseMbid: candidateRelease.releaseMbid,
          kind: legacyMatch.kind,
          mbid: legacyMatch.mbid,
        };
      }

      if (__DEV__) {
        console.log("[RecordQuest][artwork] moving to next alternate release", {
          requestKey: `${legacyMatch.kind}:${legacyMatch.mbid}`,
          nextCandidateIndex: index + 1,
        });
      }
    }

    const terminalStatus = hadSameImageSizeVariant
      ? "same-image-alternate-size"
      : hadIdenticalCandidate
        ? "identical-result"
        : hadTransientFailure
          ? "transient-metadata-failure"
          : "no-alternate-art";

    if (__DEV__) {
      console.log("[RecordQuest][artwork] fallback exhausted", {
        requestKey: `${legacyMatch.kind}:${legacyMatch.mbid}`,
        releaseGroupMbid,
        status: terminalStatus,
      });
    }

    return {
      status: terminalStatus,
      url: "",
      metadataEndpoint: releaseLookup?.metadataEndpoint,
      releaseGroupMbid,
      kind: legacyMatch.kind,
      mbid: legacyMatch.mbid,
    };
  })();

  pendingLegacyRepairRequests.set(cacheKey, request);

  try {
    const outcome = await request;
    legacyRepairCache.set(cacheKey, outcome);
    return outcome;
  } finally {
    pendingLegacyRepairRequests.delete(cacheKey);
  }
}

export function enrichRecordItem(item: RecordItem, metadata: { year: string; cover: string; genre?: string }) {
  const normalizedCover = normalizeAlbumArtUrlOrNull(metadata.cover);

  return {
    ...item,
    year: metadata.year || item.year,
    cover: normalizedCover || item.cover,
    genre: metadata.genre || item.genre,
  } satisfies RecordItem;
}
