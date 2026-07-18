import { RecordItem, CollectionAnalytics } from "../hooks/types";

const FALLBACK_ALBUM_ART_URL = "https://upload.wikimedia.org/wikipedia/commons/3/3c/No-album-art.png";

type RankedCount = { label: string; count: number };

function normalizeTextValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

function normalizeKey(value: string | undefined): string {
  return normalizeTextValue(value).toLowerCase().replace(/\s+/g, " ");
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

function parsePriceValue(value: unknown): number | null {
  if (!value) return null;

  const source = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const normalized = source.replace(/[^0-9.-]/g, "").trim();
  if (!normalized) return null;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function topThreeFromMap(map: Map<string, { label: string; count: number }>): RankedCount[] {
  return [...map.values()]
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    })
    .slice(0, 3)
    .map((entry) => ({ label: entry.label, count: entry.count }));
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function getCollectorProfileLabel(totalRecords: number): CollectionAnalytics["collectorProfileLabel"] {
  if (totalRecords >= 200) return "Vinyl Vault";
  if (totalRecords >= 100) return "Archivist";
  if (totalRecords >= 40) return "Collector";
  if (totalRecords >= 10) return "Crate Digger";
  return "Starter";
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function monthsBetweenInclusive(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}

function addMonths(base: Date, months: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + months, 1);
}

export function calculateCollectionAnalytics(
  records: RecordItem[],
  wishlist: RecordItem[],
  storeCheckIns: Record<string, number>,
  activity: string[]
): CollectionAnalytics {
  const totalRecords = records.length;

  const artistCounts = new Map<string, { label: string; count: number }>();
  const genreCounts = new Map<string, { label: string; count: number }>();
  const decadeCounts = new Map<string, { label: string; count: number }>();
  const yearCounts = new Map<number, number>();

  const priceEntries: Array<{ record: RecordItem; price: number }> = [];
  const ratingsByArtist = new Map<string, { label: string; count: number; total: number }>();
  const ratingDistributionMap = new Map<number, number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
  ]);

  let validYearCount = 0;
  let yearTotal = 0;
  let ratedRecordsCount = 0;
  let ratingTotal = 0;

  for (const record of records) {
    const artistLabel = normalizeTextValue(record.artist);
    const artistKey = normalizeKey(record.artist);
    if (artistKey && artistLabel) {
      const current = artistCounts.get(artistKey);
      artistCounts.set(artistKey, {
        label: current?.label ?? artistLabel,
        count: (current?.count ?? 0) + 1,
      });
    }

    const genreLabel = normalizeTextValue(record.genre);
    const genreKey = normalizeKey(record.genre);
    if (genreKey && genreLabel) {
      const current = genreCounts.get(genreKey);
      genreCounts.set(genreKey, {
        label: current?.label ?? genreLabel,
        count: (current?.count ?? 0) + 1,
      });
    }

    const parsedYear = Number.parseInt(record.year, 10);
    if (Number.isFinite(parsedYear) && parsedYear > 0) {
      validYearCount += 1;
      yearTotal += parsedYear;
      yearCounts.set(parsedYear, (yearCounts.get(parsedYear) ?? 0) + 1);

      const decadeLabel = getDecadeLabel(parsedYear);
      const decadeKey = decadeLabel.toLowerCase();
      const currentDecade = decadeCounts.get(decadeKey);
      decadeCounts.set(decadeKey, {
        label: currentDecade?.label ?? decadeLabel,
        count: (currentDecade?.count ?? 0) + 1,
      });
    }

    const rating = typeof record.rating === "number" && record.rating > 0 ? record.rating : null;
    if (rating !== null) {
      ratedRecordsCount += 1;
      ratingTotal += rating;

      const rounded = Math.max(1, Math.min(5, Math.round(rating)));
      ratingDistributionMap.set(rounded, (ratingDistributionMap.get(rounded) ?? 0) + 1);

      if (artistKey && artistLabel) {
        const currentRatingArtist = ratingsByArtist.get(artistKey);
        ratingsByArtist.set(artistKey, {
          label: currentRatingArtist?.label ?? artistLabel,
          count: (currentRatingArtist?.count ?? 0) + 1,
          total: (currentRatingArtist?.total ?? 0) + rating,
        });
      }
    }

    const parsedPrice = parsePriceValue((record as Record<string, unknown>).price);
    if (parsedPrice !== null) {
      priceEntries.push({ record, price: parsedPrice });
    }

  }

  const uniqueArtists = new Set(artistCounts.keys());
  const uniqueGenres = new Set(genreCounts.keys());
  const topArtists = topThreeFromMap(artistCounts);
  const topGenres = topThreeFromMap(genreCounts);

  const decadeDistribution = [...decadeCounts.values()]
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    })
    .slice(0, 3)
    .map((entry) => ({
      label: entry.label,
      count: entry.count,
      percent: totalRecords > 0 ? Math.round((entry.count / totalRecords) * 100) : 0,
    }));

  const yearsWithoutUnknown = [...yearCounts.keys()];
  const averageYear = validYearCount >= 2 ? Math.round(yearTotal / validYearCount) : 0;

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

  const mostCollectedArtist: { artist: string; count: number } | null =
    topArtists.length > 0
      ? { artist: topArtists[0].label, count: topArtists[0].count }
      : null;

  const favoriteGenre: { genre: string; count: number } | null =
    topGenres.length > 0
      ? { genre: topGenres[0].label, count: topGenres[0].count }
      : null;

  const favoriteDecade: { decade: string; count: number } | null =
    decadeDistribution.length > 0
      ? { decade: decadeDistribution[0].label, count: decadeDistribution[0].count }
      : null;

  const highestRatedArtist = [...ratingsByArtist.values()]
    .filter((entry) => entry.count >= 2)
    .map((entry) => ({
      artist: entry.label,
      averageRating: roundToOne(entry.total / entry.count),
      count: entry.count,
    }))
    .sort((a, b) => {
      if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
      if (b.count !== a.count) return b.count - a.count;
      return a.artist.localeCompare(b.artist);
    })[0] ?? null;

  // Store information
  const albumsWithStory = records.filter((r) => r.notes?.trim()).length;

  const averageRating =
    ratedRecordsCount > 0
      ? roundToOne(ratingTotal / ratedRecordsCount)
      : 0;

  const highestRatedRecord = ratedRecordsCount > 0
    ? records.reduce<RecordItem | null>((best, record) => {
        const rating = typeof record.rating === "number" && record.rating > 0 ? record.rating : null;
        if (rating === null) return best;
        const bestRating = typeof best?.rating === "number" ? best.rating : -1;
        return rating > bestRating ? record : best;
      }, null)
    : null;

  const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => {
    const count = ratingDistributionMap.get(rating) ?? 0;
    return {
      rating,
      count,
      percent: ratedRecordsCount > 0 ? Math.round((count / ratedRecordsCount) * 100) : 0,
    };
  });

  const sortedPrices = [...priceEntries].sort((a, b) => a.price - b.price);
  const totalSpent = roundToOne(sortedPrices.reduce((sum, entry) => sum + entry.price, 0));
  const averagePurchasePrice = sortedPrices.length > 0 ? roundToOne(totalSpent / sortedPrices.length) : 0;
  const medianPurchasePrice =
    sortedPrices.length === 0
      ? 0
      : sortedPrices.length % 2 === 1
        ? sortedPrices[Math.floor(sortedPrices.length / 2)].price
        : roundToOne(
            (sortedPrices[sortedPrices.length / 2 - 1].price + sortedPrices[sortedPrices.length / 2].price) / 2
          );

  const highestPricedRecord = sortedPrices.length > 0
    ? {
        album: sortedPrices[sortedPrices.length - 1].record.album,
        artist: sortedPrices[sortedPrices.length - 1].record.artist,
        price: sortedPrices[sortedPrices.length - 1].price,
      }
    : null;

  const lowestPricedRecord = sortedPrices.length > 0
    ? {
        album: sortedPrices[0].record.album,
        artist: sortedPrices[0].record.artist,
        price: sortedPrices[0].price,
      }
    : null;

  const bestBargainRecord = priceEntries
    .map(({ record, price }) => {
      const rating = typeof record.rating === "number" && record.rating > 0 ? record.rating : null;
      if (!rating || price <= 0) {
        return null;
      }

      return {
        album: record.album,
        artist: record.artist,
        price,
        rating,
        score: rating / price,
      };
    })
    .filter((entry): entry is { album: string; artist: string; price: number; rating: number; score: number } => !!entry)
    .sort((a, b) => b.score - a.score)[0] ?? null;

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
    const key = getMonthKey(addedAt);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostActiveCollectingMonth: { label: string; count: number } | null =
    Object.entries(addedMonthCounts).length > 0
      ? Object.entries(addedMonthCounts).reduce<{ label: string; count: number } | null>((best, [key, count]) => {
          const label = getMonthLabel(key);

          if (!best || count > best.count) {
            return { label, count };
          }

          return best;
        }, null)
      : null;

  const nowMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const collectionGrowthLastMonths = Array.from({ length: 6 }, (_, index) => {
    const monthDate = addMonths(nowMonth, index - 5);
    const key = getMonthKey(monthDate);
    return {
      label: getMonthLabel(key),
      count: addedMonthCounts[key] ?? 0,
    };
  });

  const sortedMonthKeys = Object.keys(addedMonthCounts).sort((a, b) => {
    const [yearA, monthA] = a.split("-").map(Number);
    const [yearB, monthB] = b.split("-").map(Number);
    return yearA === yearB ? monthA - monthB : yearA - yearB;
  });

  let longestMonthlyCollectingStreak: number | null = null;
  if (sortedMonthKeys.length > 0) {
    let best = 1;
    let current = 1;

    for (let i = 1; i < sortedMonthKeys.length; i += 1) {
      const [prevYear, prevMonth] = sortedMonthKeys[i - 1].split("-").map(Number);
      const [nextYear, nextMonth] = sortedMonthKeys[i].split("-").map(Number);
      const prev = new Date(prevYear, prevMonth - 1, 1);
      const expected = addMonths(prev, 1);

      if (expected.getFullYear() === nextYear && expected.getMonth() + 1 === nextMonth) {
        current += 1;
        best = Math.max(best, current);
      } else {
        current = 1;
      }
    }

    longestMonthlyCollectingStreak = best;
  }

  const averageRecordsAddedPerMonth = recordsWithAddedAt.length >= 3 && sortedMonthKeys.length > 0
    ? (() => {
        const [firstYear, firstMonth] = sortedMonthKeys[0].split("-").map(Number);
        const [lastYear, lastMonth] = sortedMonthKeys[sortedMonthKeys.length - 1].split("-").map(Number);
        const first = new Date(firstYear, firstMonth - 1, 1);
        const last = new Date(lastYear, lastMonth - 1, 1);
        const span = monthsBetweenInclusive(first, last);
        if (span <= 0) return null;
        return roundToOne(recordsWithAddedAt.length / span);
      })()
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
    totalRecords,
    totalArtists: uniqueArtists.size,
    totalGenres: uniqueGenres.size,
    averageYear,
    oldestAlbum,
    newestAlbum,
    mostCollectedArtist,
    favoriteGenre,
    favoriteDecade,
    topArtists,
    decadeDistribution,
    highestRatedArtist,
    albumsWithStory,
    averageRating,
    ratedRecordsCount,
    ratingDistribution,
    highestRatedRecord,
    totalSpent,
    averagePurchasePrice,
    medianPurchasePrice,
    highestPricedRecord,
    lowestPricedRecord,
    bestBargainRecord: bestBargainRecord
      ? {
          album: bestBargainRecord.album,
          artist: bestBargainRecord.artist,
          price: bestBargainRecord.price,
          rating: bestBargainRecord.rating,
        }
      : null,
    recordsAddedThisMonth,
    recordsAddedThisYear,
    collectionGrowthLastMonths,
    averageRecordsAddedPerMonth,
    longestMonthlyCollectingStreak,
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
    collectorProfileLabel: getCollectorProfileLabel(totalRecords),
  };
}
