import { RecordItem, CollectionAnalytics } from "../hooks/types";

export function calculateCollectionAnalytics(
  records: RecordItem[],
  wishlist: RecordItem[],
  storeCheckIns: Record<string, number>,
  activity: string[]
): CollectionAnalytics {
  // Unique artists and genres
  const uniqueArtists = new Set(records.map((r) => r.artist));
  const uniqueGenres = new Set(records.map((r) => r.genre));

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
    albumsWithStore,
    albumsWithStory,
    averageRating,
    storesVisited,
    totalCheckIns,
    favoriteStore,
    wishlistCount: wishlist.length,
    wishlistCompletionPercent,
    mostRecentAlbum,
  };
}
