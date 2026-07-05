import { RecordItem, CollectionAnalytics } from "../hooks/types";

function normalizeTextValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

function parseDateValue(value: string | undefined): Date | null {
  if (!value) return null;

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp);
}

function getDecadeLabel(year: number): string {
  const decadeYear = Math.floor(year / 10) * 10;
  return `${decadeYear}s`;
}

function parsePriceValue(value: string | undefined): number | null {
  if (!value) return null;

  const normalized = value.replace(/[^0-9.-]/g, "").trim();
  if (!normalized) return null;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateCollectionAnalytics(
  records: RecordItem[],
  wishlist: RecordItem[],
  storeCheckIns: Record<string, number>,
  activity: string[]
): CollectionAnalytics {
  // Unique artists and genres
  const uniqueArtists = new Set(records.map((r) => normalizeTextValue(r.artist)).filter(Boolean));
  const uniqueGenres = new Set(records.map((r) => normalizeTextValue(r.genre)).filter(Boolean));

  // Year statistics
  const yearsWithoutUnknown = records
    .map((r) => parseInt(r.year, 10))
    .filter((y) => !isNaN(y) && y > 0);
  const averageYear =
    yearsWithoutUnknown.length > 0
      ? Math.round(yearsWithoutUnknown.reduce((a, b) => a + b, 0) / yearsWithoutUnknown.length)
      : 0;

  const oldestAlbum =
    yearsWithoutUnknown.length > 0
      ? records.reduce((oldest, current) => {
          const currentYear = parseInt(current.year, 10);
          const oldestYear = parseInt(oldest.year, 10);
          if (isNaN(currentYear) || currentYear <= 0) return oldest;
          if (isNaN(oldestYear) || oldestYear <= 0) return current;
          return currentYear < oldestYear ? current : oldest;
        })
      : null;

  const newestAlbum =
    yearsWithoutUnknown.length > 0
      ? records.reduce((newest, current) => {
          const currentYear = parseInt(current.year, 10);
          const newestYear = parseInt(newest.year, 10);
          if (isNaN(currentYear) || currentYear <= 0) return newest;
          if (isNaN(newestYear) || newestYear <= 0) return current;
          return currentYear > newestYear ? current : newest;
        })
      : null;

  // Artist frequency
  const artistCounts = records.reduce(
    (acc, record) => {
      acc[record.artist] = (acc[record.artist] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const mostCollectedArtist: { artist: string; count: number } | null =
    Object.entries(artistCounts).length > 0
      ? Object.entries(artistCounts).reduce<{ artist: string; count: number }>(
          (max, [artist, count]) => (count > max.count ? { artist, count } : max),
          { artist: "", count: 0 }
        )
      : null;

  // Genre frequency
  const genreCounts = records.reduce(
    (acc, record) => {
      acc[record.genre] = (acc[record.genre] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const favoriteGenre: { genre: string; count: number } | null =
    Object.entries(genreCounts).length > 0
      ? Object.entries(genreCounts).reduce<{ genre: string; count: number }>(
          (max, [genre, count]) => (count > max.count ? { genre, count } : max),
          { genre: "", count: 0 }
        )
      : null;

  const decadeCounts = records.reduce(
    (acc, record) => {
      const parsedYear = Number.parseInt(record.year, 10);
      if (!Number.isFinite(parsedYear) || parsedYear <= 0) {
        return acc;
      }

      const decade = getDecadeLabel(parsedYear);
      acc[decade] = (acc[decade] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const favoriteDecade: { decade: string; count: number } | null =
    Object.entries(decadeCounts).length > 0
      ? Object.entries(decadeCounts).reduce<{ decade: string; count: number }>(
          (max, [decade, count]) => (count > max.count ? { decade, count } : max),
          { decade: "", count: 0 }
        )
      : null;

  // Store information
  const albumsWithStore = records.filter((r) => r.purchasedAt?.trim()).length;
  const albumsWithStory = records.filter((r) => r.notes?.trim()).length;

  // Ratings
  const ratingsCount = records.filter((r) => typeof r.rating === "number" && r.rating > 0).length;
  const averageRating =
    ratingsCount > 0
      ? Math.round(
          (records.reduce((sum, r) => sum + (typeof r.rating === "number" && r.rating > 0 ? r.rating : 0), 0) /
            ratingsCount) *
            10
        ) / 10
      : 0;

  const highestRatedRecord = ratingsCount > 0
    ? records.reduce<RecordItem | null>((best, record) => {
        const rating = typeof record.rating === "number" && record.rating > 0 ? record.rating : null;
        if (rating === null) return best;
        const bestRating = typeof best?.rating === "number" ? best.rating : -1;
        return rating > bestRating ? record : best;
      }, null)
    : null;

  const recordsWithAddedAt = records
    .map((record) => ({ record, addedAt: parseDateValue(record.added_at) }))
    .filter((entry): entry is { record: RecordItem; addedAt: Date } => entry.addedAt !== null);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const recordsAddedThisMonth = recordsWithAddedAt.filter(
    ({ addedAt }) => addedAt.getFullYear() === currentYear && addedAt.getMonth() === currentMonth
  ).length;

  const recordsAddedThisYear = recordsWithAddedAt.filter(
    ({ addedAt }) => addedAt.getFullYear() === currentYear
  ).length;

  const addedMonthCounts = recordsWithAddedAt.reduce((acc, { addedAt }) => {
    const key = `${addedAt.getFullYear()}-${String(addedAt.getMonth() + 1).padStart(2, "0")}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostActiveCollectingMonth: { label: string; count: number } | null =
    Object.entries(addedMonthCounts).length > 0
      ? Object.entries(addedMonthCounts).reduce<{ label: string; count: number } | null>((best, [key, count]) => {
          const [year, month] = key.split("-");
          const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          });

          if (!best || count > best.count) {
            return { label, count };
          }

          return best;
        }, null)
      : null;

  const mostRecentAddition = recordsWithAddedAt.length > 0
    ? [...recordsWithAddedAt].sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())[0].record
    : null;

  const firstRecordedAddition = recordsWithAddedAt.length > 0
    ? [...recordsWithAddedAt].sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime())[0].record
    : null;

  const wishlistWithAddedAt = wishlist
    .map((record) => ({ record, addedAt: parseDateValue(record.added_at) }))
    .filter((entry): entry is { record: RecordItem; addedAt: Date } => entry.addedAt !== null);

  const wishlistAddedThisMonth = wishlistWithAddedAt.filter(
    ({ addedAt }) => addedAt.getFullYear() === currentYear && addedAt.getMonth() === currentMonth
  ).length;

  const mostRecentWishlistAddition = wishlistWithAddedAt.length > 0
    ? [...wishlistWithAddedAt].sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())[0].record
    : null;

  // Store check-ins
  const storesVisited = Object.keys(storeCheckIns).length;
  const totalCheckIns = Object.values(storeCheckIns).reduce((sum, count) => sum + count, 0);
  const favoriteStore: { id: string; name: string; count: number } | null =
    storesVisited > 0
      ? Object.entries(storeCheckIns).reduce<{ id: string; name: string; count: number } | null>(
          (max, [storeId, count]) => {
            const maxCount = max?.count ?? 0;
            return count > maxCount ? { id: storeId, name: storeId, count } : max;
          },
          null
        )
      : null;

  // Wishlist completion
  const wishlistCompletionCount = activity.filter((entry) => entry.startsWith("Found ")).length;
  const wishlistCompletionPercent =
    wishlist.length > 0
      ? Math.round((wishlistCompletionCount / (wishlist.length + wishlistCompletionCount)) * 100)
      : 0;

  // Most recent album (from records, assuming array order)
  const mostRecentAlbum = records.length > 0 ? records[0] : null;

  return {
    totalArtists: uniqueArtists.size,
    totalGenres: uniqueGenres.size,
    averageYear,
    oldestAlbum,
    newestAlbum,
    mostCollectedArtist,
    favoriteGenre,
    favoriteDecade,
    albumsWithStore,
    albumsWithStory,
    averageRating,
    highestRatedRecord,
    recordsAddedThisMonth,
    recordsAddedThisYear,
    mostActiveCollectingMonth,
    mostRecentAddition,
    firstRecordedAddition,
    wishlistAddedThisMonth,
    mostRecentWishlistAddition,
    storesVisited,
    totalCheckIns,
    favoriteStore,
    wishlistCount: wishlist.length,
    wishlistCompletionPercent,
    mostRecentAlbum,
  };
}
