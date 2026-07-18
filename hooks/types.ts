// Shared types for RecordQuest

export type RecordItem = {
  id: number;
  album: string;
  artist: string;
  added_at?: string;
  year: string;
  genre: string;
  cover: string;
  purchasedAt?: string;
  purchaseDate?: string;
  condition?: string;
  price?: string;
  notes?: string;
  favoriteTrack?: string;
  rating?: number;
};

export type StoreItem = {
  id: string;
  name: string;
  neighborhood: string;
  address: string;
  hours: string;
  rating: string;
  distance: string;
  description: string;
  storeCategory?: "record-store" | "media-store" | "bookstore";
  verificationNote?: string;
  latitude?: number;
  longitude?: number;
  source?: "curated" | "osm" | "google";
  locationConfidence?: "verified" | "unverified";
};

export type AchievementBadge = {
  id: string;
  emoji: string;
  label: string;
  requirement: string;
  current: number;
  target: number;
  unlocked: boolean;
  earned_at?: string | null;
};

export type AchievementCategory = {
  title: string;
  badges: AchievementBadge[];
};

export type AlbumSearchResult = {
  id: string;
  album: string;
  artist: string;
  year: string;
  cover: string;
  genre: string;
  format?: "album" | "ep" | "single";
};

export type CollectionAnalytics = {
  totalRecords: number;
  totalArtists: number;
  totalGenres: number;
  averageYear: number;
  oldestAlbum: RecordItem | null;
  newestAlbum: RecordItem | null;
  mostCollectedArtist: { artist: string; count: number } | null;
  favoriteGenre: { genre: string; count: number } | null;
  favoriteDecade: { decade: string; count: number } | null;
  topArtists: Array<{ label: string; count: number }>;
  decadeDistribution: Array<{ label: string; count: number; percent: number }>;
  highestRatedArtist: { artist: string; averageRating: number; count: number } | null;
  albumsWithStory: number;
  averageRating: number;
  ratedRecordsCount: number;
  ratingDistribution: Array<{ rating: number; count: number; percent: number }>;
  highestRatedRecord: RecordItem | null;
  totalSpent: number;
  averagePurchasePrice: number;
  medianPurchasePrice: number;
  highestPricedRecord: { album: string; artist: string; price: number } | null;
  lowestPricedRecord: { album: string; artist: string; price: number } | null;
  bestBargainRecord: { album: string; artist: string; price: number; rating: number } | null;
  recordsAddedThisMonth: number;
  recordsAddedThisYear: number;
  collectionGrowthLastMonths: Array<{ label: string; count: number }>;
  averageRecordsAddedPerMonth: number | null;
  longestMonthlyCollectingStreak: number | null;
  mostActiveCollectingMonth: { label: string; count: number } | null;
  mostRecentAddition: RecordItem | null;
  firstRecordedAddition: RecordItem | null;
  wishlistAddedThisMonth: number;
  mostRecentWishlistAddition: RecordItem | null;
  storesVisited: number;
  totalCheckIns: number;
  favoriteStore: { id: string; name: string; count: number } | null;
  wishlistCount: number;
  wishlistCompletionPercent: number;
  mostRecentAlbum: RecordItem | null;
  collectorProfileLabel: "Starter" | "Crate Digger" | "Collector" | "Archivist" | "Vinyl Vault";
};
