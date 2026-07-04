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
  totalArtists: number;
  totalGenres: number;
  averageYear: number;
  oldestAlbum: RecordItem | null;
  newestAlbum: RecordItem | null;
  mostCollectedArtist: { artist: string; count: number } | null;
  favoriteGenre: { genre: string; count: number } | null;
  albumsWithStore: number;
  albumsWithStory: number;
  averageRating: number;
  storesVisited: number;
  totalCheckIns: number;
  favoriteStore: { id: string; name: string; count: number } | null;
  wishlistCount: number;
  wishlistCompletionPercent: number;
  mostRecentAlbum: RecordItem | null;
};
