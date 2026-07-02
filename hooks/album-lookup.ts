import { type RecordItem } from "./recordquest-storage";

const MUSICBRAINZ_URL = "https://musicbrainz.org/ws/2/release-group";
const COVER_ART_URL = "https://coverartarchive.org/release-group";
const SEARCH_CACHE_LIMIT = 40;

const searchCache = new Map<string, AlbumSearchResult[]>();
const coverCache = new Map<string, string>();
const pendingCoverRequests = new Map<string, Promise<string>>();
const pendingSearchRequests = new Map<string, Promise<AlbumSearchResult[]>>();

export type AlbumSearchResult = {
  id: string;
  album: string;
  artist: string;
  year: string;
  cover: string;
  genre: string;
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

async function fetchReleaseGroupCover(releaseGroupId: string) {
  if (!releaseGroupId) {
    return "";
  }

  const cachedCover = coverCache.get(releaseGroupId);
  if (typeof cachedCover === "string") {
    return cachedCover;
  }

  const inFlightRequest = pendingCoverRequests.get(releaseGroupId);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = (async () => {
    try {
      const coverResponse = await fetch(`${COVER_ART_URL}/${releaseGroupId}`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!coverResponse.ok) {
        coverCache.set(releaseGroupId, "");
        return "";
      }

      const coverData = (await coverResponse.json()) as {
        images?: Array<{
          front?: boolean;
          image?: string;
          thumbnails?: {
            small?: string;
            large?: string;
          };
        }>;
      };

      const frontImage = coverData.images?.find((image) => image.front) ?? coverData.images?.[0];
      const coverUrl = frontImage?.thumbnails?.small || frontImage?.thumbnails?.large || frontImage?.image || "";
      coverCache.set(releaseGroupId, coverUrl);
      return coverUrl;
    } catch {
      coverCache.set(releaseGroupId, "");
      return "";
    } finally {
      pendingCoverRequests.delete(releaseGroupId);
    }
  })();

  pendingCoverRequests.set(releaseGroupId, request);
  return request;
}

async function findReleaseGroups(query: string) {
  const response = await fetch(`${MUSICBRAINZ_URL}/?query=${encodeURIComponent(query)}&fmt=json&limit=18`, {
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
      album: albumTitle,
      artist: artistName,
      year,
      cover: "",
      genre: buildGenre(releaseGroup["primary-type"], releaseGroup["secondary-types"]),
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
        const cover = await fetchReleaseGroupCover(result.id);
        return {
          ...result,
          cover,
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

export function enrichRecordItem(item: RecordItem, metadata: { year: string; cover: string; genre?: string }) {
  return {
    ...item,
    year: metadata.year || item.year,
    cover: metadata.cover || item.cover,
    genre: metadata.genre || item.genre,
  } satisfies RecordItem;
}
