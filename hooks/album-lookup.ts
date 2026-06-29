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

function normalizeYear(date?: string) {
  return date?.slice(0, 4) || "Unknown";
}

function buildGenre(primaryType?: string, secondaryTypes?: string[]) {
  const parts = [primaryType, ...(secondaryTypes ?? [])].filter(Boolean);
  return parts.length ? parts.join(" • ") : "Vinyl";
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

export async function searchAlbumResults(album: string, artist: string) {
  if (!album.trim()) {
    return [] as AlbumSearchResult[];
  }

  try {
    const query = `release:"${album.trim()}"${artist.trim() ? ` AND artist:"${artist.trim()}"` : ""}`;
    const response = await fetch(`${MUSICBRAINZ_URL}/?query=${encodeURIComponent(query)}&fmt=json&limit=5`, {
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

    const releaseGroups = data["release-groups"] ?? [];

    const results = await Promise.all(
      releaseGroups.slice(0, 5).map(async (releaseGroup) => {
        const artistName =
          releaseGroup["artist-credit"]
            ?.map((credit) => credit.name || credit.artist?.name || "")
            .filter(Boolean)
            .join(", ") || releaseGroup["artist-credit-phrase"] || artist.trim() || "Unknown artist";

        const cover = await fetchReleaseGroupCover(releaseGroup.id || "");

        return {
          id: releaseGroup.id || `${releaseGroup.title || album.trim()}-${artistName}`,
          album: releaseGroup.title || album.trim(),
          artist: artistName,
          year: normalizeYear(releaseGroup["first-release-date"]),
          cover,
          genre: buildGenre(releaseGroup["primary-type"], releaseGroup["secondary-types"]),
        } satisfies AlbumSearchResult;
      })
    );

    return results.filter((result) => result.album);
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
