import { type RecordItem } from "./recordquest-storage";

const MUSICBRAINZ_URL = "https://musicbrainz.org/ws/2/release-group";
const COVER_ART_URL = "https://coverartarchive.org/release-group";

export type AlbumSearchResult = {
  id: string;
  album: string;
  artist: string;
  year: string;
  cover: string;
  genre: string;
};

type ScoredAlbumSearchResult = AlbumSearchResult & { score: number };

function normalizeYear(date?: string) {
  return date?.slice(0, 4) || "Unknown";
}

function normalizeText(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function buildGenre(primaryType?: string, secondaryTypes?: string[]) {
  const parts = [primaryType, ...(secondaryTypes ?? [])].filter(Boolean);
  return parts.length ? parts.join(" • ") : "Vinyl";
}

function releaseGroupScore(
  releaseGroupTitle: string,
  releaseGroupArtist: string,
  primaryType?: string,
  secondaryTypes?: string[],
  searchAlbum = "",
  searchArtist = ""
) {
  const normalizedTitle = normalizeText(releaseGroupTitle);
  const normalizedArtist = normalizeText(releaseGroupArtist);
  const normalizedSearchAlbum = normalizeText(searchAlbum);
  const normalizedSearchArtist = normalizeText(searchArtist);

  let score = 0;

  if (normalizedTitle === normalizedSearchAlbum) {
    score += 100;
  } else if (normalizedTitle.includes(normalizedSearchAlbum) || normalizedSearchAlbum.includes(normalizedTitle)) {
    score += 40;
  }

  if (normalizedSearchArtist && normalizedArtist === normalizedSearchArtist) {
    score += 50;
  } else if (normalizedSearchArtist && normalizedArtist.includes(normalizedSearchArtist)) {
    score += 25;
  }

  const type = normalizeText(primaryType);
  if (type === "album") {
    score += 30;
  } else if (type === "ep") {
    score += 12;
  } else if (type === "single") {
    score += 8;
  }

  if (secondaryTypes?.length) {
    score += secondaryTypes.length * 2;
  }

  return score;
}

async function fetchReleaseGroupCover(releaseGroupId: string) {
  if (!releaseGroupId) {
    return "";
  }

  try {
    const coverResponse = await fetch(`${COVER_ART_URL}/${releaseGroupId}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!coverResponse.ok) {
      return "";
    }

    const coverData = (await coverResponse.json()) as {
      images?: Array<{ image?: string }>;
    };

    return coverData.images?.[0]?.image || "";
  } catch {
    return "";
  }
}

async function findReleaseGroups(query: string) {
  const response = await fetch(`${MUSICBRAINZ_URL}/?query=${encodeURIComponent(query)}&fmt=json&limit=12`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "RecordQuest/1.0 (https://recordquest.app)",
    },
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz search failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    "release-groups"?: Array<{
      id?: string;
      title?: string;
      "first-release-date"?: string;
      "primary-type"?: string;
      "secondary-types"?: string[];
      "artist-credit"?: Array<{ name?: string; artist?: { name?: string } }>;
      "artist-credit-phrase"?: string;
    }>;
  };

  return data["release-groups"] ?? [];
}

function buildArtistName(releaseGroup: {
  "artist-credit"?: Array<{ name?: string; artist?: { name?: string } }>;
  "artist-credit-phrase"?: string;
}) {
  return (
    releaseGroup["artist-credit"]
      ?.map((credit) => credit.name || credit.artist?.name || "")
      .filter(Boolean)
      .join(", ") || releaseGroup["artist-credit-phrase"] || "Unknown artist"
  );
}

async function mapReleaseGroupsToResults(
  releaseGroups: Array<{
    id?: string;
    title?: string;
    "first-release-date"?: string;
    "primary-type"?: string;
    "secondary-types"?: string[];
    "artist-credit"?: Array<{ name?: string; artist?: { name?: string } }>;
    "artist-credit-phrase"?: string;
  }>,
  album: string,
  artist: string
) {
  const scoredResults: ScoredAlbumSearchResult[] = (
    releaseGroups || []
  ).map((releaseGroup) => {
    const artistName = buildArtistName(releaseGroup);
    const albumTitle = releaseGroup.title?.trim() || album.trim();
    const score = releaseGroupScore(
      albumTitle,
      artistName,
      releaseGroup["primary-type"],
      releaseGroup["secondary-types"],
      album,
      artist
    );

    return {
      id: releaseGroup.id || `${albumTitle}-${artistName}`,
      album: albumTitle,
      artist: artistName,
      year: normalizeYear(releaseGroup["first-release-date"]),
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

  try {
    const albumQuery = `release:"${album.trim()}"${artist.trim() ? ` AND artist:"${artist.trim()}"` : ""}`;

    const primaryReleaseGroups = await findReleaseGroups(albumQuery);
    let results = await mapReleaseGroupsToResults(primaryReleaseGroups, album, artist);

    if (!results.length && artist.trim()) {
      const fallbackQuery = `release:"${album.trim()}"`;
      const fallbackReleaseGroups = await findReleaseGroups(fallbackQuery);
      results = await mapReleaseGroupsToResults(fallbackReleaseGroups, album, artist);
    }

    const enrichedResults = await Promise.all(
      results.map(async (result) => ({
        ...result,
        cover: await fetchReleaseGroupCover(result.id),
      }))
    );

    return enrichedResults
      .sort((a, b) => {
        const aCover = a.cover ? 1 : 0;
        const bCover = b.cover ? 1 : 0;
        if (aCover !== bCover) {
          return bCover - aCover;
        }
        return b.score - a.score;
      })
      .slice(0, 8)
      .map(({ score, ...result }) => result);
  } catch (error) {
    console.warn("Album search failed:", error);
    return [] as AlbumSearchResult[];
  }
}

export async function lookupAlbumMetadata(album: string, artist: string) {
  const [firstMatch] = await searchAlbumResults(album, artist);
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
