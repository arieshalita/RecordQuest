import { Platform } from "react-native";
import * as Location from "expo-location";
import type { StoreItem } from "./types";

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string | undefined>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type GooglePlacesLocation = {
  latitude?: number;
  longitude?: number;
};

type GooglePlaceDisplayName = {
  text?: string;
};

type GooglePlace = {
  id?: string;
  displayName?: GooglePlaceDisplayName;
  formattedAddress?: string;
  location?: GooglePlacesLocation;
  businessStatus?: string;
  types?: string[];
};

type GooglePlacesTextSearchResponse = {
  places?: GooglePlace[];
};

type StoreDiscoveryErrorKind =
  | "permission-denied"
  | "permission-timeout"
  | "location-disabled"
  | "location-unavailable"
  | "api-failure";

type RankedStore = StoreItem & {
  _distanceMiles: number;
  _score: number;
  _confidence: "high" | "medium" | "low";
};

type GoogleStoreRelevance = {
  tier: number;
  score: number;
};

type GoogleStoreSignals = {
  hasNameRecordSignal: boolean;
  hasTypeRecordSignal: boolean;
  hasNameMusicSignal: boolean;
  hasKnownMediaVinylSignal: boolean;
};

type RankedCuratedStore = StoreItem & {
  _distanceMiles: number;
  _rankingMiles: number;
};

type CuratedStoreSeed = {
  id: string;
  name: string;
  neighborhood: string;
  address: string;
  hours: string;
  description: string;
  storeCategory: "record-store" | "media-store" | "bookstore";
  latitude: number;
  longitude: number;
  locationConfidence: "verified" | "unverified";
  verificationNote?: string;
};

export type StoreDiscoveryResult = {
  stores: StoreItem[];
  notice: string;
  usingFallback: boolean;
};

class StoreDiscoveryError extends Error {
  kind: StoreDiscoveryErrorKind;

  constructor(kind: StoreDiscoveryErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "StoreDiscoveryError";
  }
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const SEARCH_RADIUS_METERS = 32187;
const REQUEST_TIMEOUT_MS = 12000;
const LOCATION_TIMEOUT_MS = 9000;
const PERMISSION_TIMEOUT_MS = 12000;
const LAST_KNOWN_LOCATION_MAX_AGE_MS = 15 * 60 * 1000;
const LAST_KNOWN_LOCATION_REQUIRED_ACCURACY_METERS = 1500;
const MAX_RESULTS = 15;
const STORE_DEDUP_DISTANCE_MILES = 0.2;
const ENABLE_OSM_SUPPLEMENTAL_FOR_BETA = false;
const GOOGLE_PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_PLACES_TEXT_QUERIES = [
  "record store",
  "vinyl records",
  "music store vinyl",
];
const GOOGLE_PLACES_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.types";
const GOOGLE_PLACES_PAGE_SIZE = 14;
const GOOGLE_BETA_RADIUS_METERS = SEARCH_RADIUS_METERS;
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
const GOOGLE_CACHE_VERSION = "v2-multi-query";

const EXCLUDED_STORE_RULES = [
  {
    // Targeted beta exclusion for a confirmed false-positive non-vinyl result.
    normalizedName: "bky music",
    normalizedAddressFragment: "368 hillside ave needham ma",
  },
] as const;

const googlePlacesSessionCache = new Map<string, StoreItem[]>();

function logStoreDev(message: string, details?: unknown): void {
  if (!__DEV__) {
    return;
  }

  if (details === undefined) {
    console.log(message);
    return;
  }

  console.log(message, details);
}

function logStoreWarnDev(message: string, details?: unknown): void {
  if (!__DEV__) {
    return;
  }

  if (details === undefined) {
    console.warn(message);
    return;
  }

  console.warn(message, details);
}

const CURATED_BOSTON_STORES: CuratedStoreSeed[] = [
  {
    id: "newbury-comics-chestnut-hill",
    name: "Newbury Comics",
    neighborhood: "Chestnut Hill / Newton",
    address: "199 Boylston St, Chestnut Hill, MA 02467",
    hours: "Hours vary",
    description: "Chestnut Hill location with a reliable vinyl section for nearby Needham/Newton shoppers.",
    storeCategory: "media-store",
    latitude: 42.3222,
    longitude: -71.1779,
    locationConfidence: "unverified",
  },
  {
    id: "newbury-comics-natick",
    name: "Newbury Comics",
    neighborhood: "Natick Mall",
    address: "1245 Worcester St, Natick, MA 01760",
    hours: "Hours vary",
    description: "Natick location with broad mainstream and catalog vinyl selections.",
    storeCategory: "media-store",
    latitude: 42.3016,
    longitude: -71.3531,
    locationConfidence: "unverified",
  },
  {
    id: "newbury-comics-newbury",
    name: "Newbury Comics",
    neighborhood: "Back Bay / Boston",
    address: "348 Newbury Street, Boston, MA 02115",
    hours: "Hours vary",
    description: "Long-running Boston music and pop-culture shop with a strong vinyl section.",
    storeCategory: "media-store",
    latitude: 42.3495,
    longitude: -71.0865,
    locationConfidence: "unverified",
  },
  {
    id: "in-your-ear-allston",
    name: "In Your Ear Records",
    neighborhood: "Allston",
    address: "957 Commonwealth Ave, Boston, MA 02215",
    hours: "Hours vary",
    description: "Classic Boston used record store with deep crates across many genres.",
    storeCategory: "record-store",
    latitude: 42.3502,
    longitude: -71.1172,
    locationConfidence: "unverified",
  },
  {
    id: "stereo-jacks-ball-square",
    name: "Stereo Jack's",
    neighborhood: "Ball Square",
    address: "744 Broadway, Somerville, MA 02144",
    hours: "Hours vary",
    description: "Neighborhood vinyl spot with curated used and new records.",
    storeCategory: "record-store",
    latitude: 42.4017,
    longitude: -71.1108,
    locationConfidence: "unverified",
  },
  {
    id: "deep-thoughts-jp",
    name: "Deep Thoughts JP",
    neighborhood: "Jamaica Plain",
    address: "31A South St, Jamaica Plain, MA 02130",
    hours: "Hours vary",
    description: "JP shop focused on eclectic used vinyl and local discoveries.",
    storeCategory: "record-store",
    latitude: 42.3154,
    longitude: -71.1148,
    locationConfidence: "unverified",
  },
  {
    id: "village-vinyl-coolidge",
    name: "Village Vinyl & Hi-Fi",
    neighborhood: "Coolidge Corner",
    address: "307 Harvard Street, Brookline, MA 02446",
    hours: "Hours vary",
    description: "Brookline record and hi-fi destination with a broad vinyl selection.",
    storeCategory: "record-store",
    latitude: 42.34289,
    longitude: -71.12173,
    locationConfidence: "unverified",
    verificationNote: "Coordinates should be manually verified before enabling exact directions.",
  },
  {
    id: "barnes-and-noble-natick",
    name: "Barnes & Noble",
    neighborhood: "Sherwood Plaza / Natick",
    address: "1324 Worcester Street #1334, Natick, MA 01760",
    hours: "Hours vary",
    description: "Bookstore/media location with vinyl carried in select media sections.",
    storeCategory: "bookstore",
    latitude: 42.2959,
    longitude: -71.3821,
    locationConfidence: "unverified",
    verificationNote: "Vinyl availability confirmed for beta; coordinates should be manually verified before exact directions.",
  },
  {
    id: "barnes-and-noble-dedham",
    name: "Barnes & Noble",
    neighborhood: "Legacy Place / Dedham",
    address: "246 Legacy Place, Dedham, MA 02026",
    hours: "Hours vary",
    description: "Bookstore/media location with vinyl availability needing verification before priority use.",
    storeCategory: "bookstore",
    latitude: 42.2253,
    longitude: -71.1871,
    locationConfidence: "unverified",
    verificationNote: "Needs vinyl availability verification before being treated like a reliable music stop.",
  },
  {
    id: "wanna-hear-it-watertown",
    name: "Wanna Hear It Records",
    neighborhood: "Watertown Square",
    address: "117 Church St, Watertown, MA 02472",
    hours: "Hours vary",
    description: "Independent shop with punk, hardcore, and collectible records.",
    storeCategory: "record-store",
    latitude: 42.3708,
    longitude: -71.1829,
    locationConfidence: "unverified",
  },
  {
    id: "nuggets-kenmore",
    name: "Nuggets Record Shop",
    neighborhood: "Kenmore / Fenway",
    address: "486 Commonwealth Ave, Boston, MA 02215",
    hours: "Hours vary",
    description: "Beloved local record store with a strong used selection.",
    storeCategory: "record-store",
    latitude: 42.3494,
    longitude: -71.0989,
    locationConfidence: "unverified",
  },
  // TODO(beta): Add Needham/Wellesley independent record shop once fully verified name/address/coordinates are confirmed.
];

function metersToMiles(meters: number): number {
  return meters * 0.000621371;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = earthRadiusKm * c;
  return distanceKm * 0.621371;
}

function formatDistanceMiles(distanceMiles: number): string {
  if (!Number.isFinite(distanceMiles)) return "-";
  if (distanceMiles < 0.1) return "0.1 mi";
  return `${distanceMiles.toFixed(1)} mi`;
}

function normalizeStoreDedupKey(name: string, address: string): string {
  const normalizedName = name.trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedAddress = address.trim().toLowerCase().replace(/\s+/g, " ");
  return `${normalizedName}::${normalizedAddress}`;
}

function normalizeStoreName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,'’`]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeStoreAddress(address: string): string {
  return address
    .trim()
    .toLowerCase()
    .replace(/[.,'’`#]/g, "")
    .replace(/\s+/g, " ");
}

function shouldExcludeStoreCandidate(name: string, address: string): boolean {
  const normalizedName = normalizeStoreName(name);
  const normalizedAddress = normalizeStoreAddress(address);

  for (const rule of EXCLUDED_STORE_RULES) {
    if (
      normalizedName === rule.normalizedName &&
      normalizedAddress.includes(rule.normalizedAddressFragment)
    ) {
      return true;
    }
  }

  return false;
}

function hasValidCoordinates(store: Pick<CuratedStoreSeed, "latitude" | "longitude">): boolean {
  return Number.isFinite(store.latitude) && Number.isFinite(store.longitude);
}

function hasVerifiedCoordinates(store: Pick<CuratedStoreSeed, "latitude" | "longitude" | "locationConfidence">): boolean {
  return store.locationConfidence === "verified" && hasValidCoordinates(store);
}

function getStorePriorityPenalty(store: Pick<CuratedStoreSeed, "storeCategory">): number {
  switch (store.storeCategory) {
    case "record-store":
      return 0;
    case "media-store":
      return 0.22;
    case "bookstore":
      return 0.35;
    default:
      return 0.22;
  }
}

function getGoogleCacheKey(latitude: number, longitude: number): string {
  // Round to keep cache stable for small GPS drift while staying location-specific.
  return `${GOOGLE_CACHE_VERSION}:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
}

function getGoogleStoreSignalBonus(place: Pick<GooglePlace, "displayName" | "types">): number {
  const name = (place.displayName?.text ?? "").toLowerCase();
  const types = (place.types ?? []).map((type) => type.toLowerCase());

  let bonus = 0;

  if (/record|vinyl|lp/.test(name)) {
    bonus += 0.24;
  }

  if (types.some((type) => /record|music/.test(type))) {
    bonus += 0.14;
  }

  if (name.includes("newbury comics")) {
    bonus += 0.08;
  }

  return Math.min(0.34, bonus);
}

function getGoogleStoreSignals(place: Pick<GooglePlace, "displayName" | "types">): GoogleStoreSignals {
  const name = (place.displayName?.text ?? "").toLowerCase();
  const types = (place.types ?? []).map((type) => type.toLowerCase());

  return {
    hasNameRecordSignal: /record|vinyl|lp/.test(name),
    hasTypeRecordSignal: types.some((type) => /record|music/.test(type)),
    hasNameMusicSignal: /music/.test(name),
    hasKnownMediaVinylSignal: name.includes("newbury comics"),
  };
}

function getGoogleStoreRelevance(place: Pick<GooglePlace, "displayName" | "types">): GoogleStoreRelevance {
  const signals = getGoogleStoreSignals(place);
  const category = getGoogleStoreCategory(place);

  if (category === "record-store" && signals.hasNameRecordSignal) {
    return { tier: 4, score: 460 };
  }

  if (category === "record-store" && signals.hasTypeRecordSignal) {
    return { tier: 3, score: 360 };
  }

  if (category === "record-store" && signals.hasNameMusicSignal) {
    return { tier: 2, score: 300 };
  }

  if (category === "media-store" && (signals.hasNameRecordSignal || signals.hasTypeRecordSignal || signals.hasKnownMediaVinylSignal)) {
    return { tier: 1, score: 200 };
  }

  return { tier: 0, score: 0 };
}

function clampLatitude(latitude: number): number {
  return Math.max(-90, Math.min(90, latitude));
}

function clampLongitude(longitude: number): number {
  let normalized = longitude;

  while (normalized < -180) {
    normalized += 360;
  }

  while (normalized > 180) {
    normalized -= 360;
  }

  return normalized;
}

function buildGoogleLocationRestriction(latitude: number, longitude: number, radiusMeters: number) {
  const latitudeDelta = radiusMeters / 111320;
  const safeCosine = Math.max(0.2, Math.cos(toRadians(latitude)));
  const longitudeDelta = radiusMeters / (111320 * safeCosine);

  return {
    rectangle: {
      low: {
        latitude: clampLatitude(latitude - latitudeDelta),
        longitude: clampLongitude(longitude - longitudeDelta),
      },
      high: {
        latitude: clampLatitude(latitude + latitudeDelta),
        longitude: clampLongitude(longitude + longitudeDelta),
      },
    },
  };
}

function getGoogleStoreCategory(place: Pick<GooglePlace, "displayName" | "types">): "record-store" | "media-store" | "bookstore" {
  const name = (place.displayName?.text ?? "").toLowerCase();
  const types = (place.types ?? []).map((type) => type.toLowerCase());

  const isBookstore = types.includes("book_store") || name.includes("barnes & noble");
  if (isBookstore) {
    return "bookstore";
  }

  const isMediaStore =
    name.includes("newbury comics") ||
    types.includes("comic_book_store") ||
    types.includes("movie_rental") ||
    types.includes("electronics_store");

  if (isMediaStore) {
    return "media-store";
  }

  return "record-store";
}

function hasGoogleMusicSignal(place: Pick<GooglePlace, "displayName" | "formattedAddress" | "types">): boolean {
  const name = (place.displayName?.text ?? "").toLowerCase();
  const types = (place.types ?? []).map((type) => type.toLowerCase());
  const signals = getGoogleStoreSignals(place);
  const category = getGoogleStoreCategory(place);

  if (category === "record-store") {
    return signals.hasNameRecordSignal || signals.hasTypeRecordSignal || signals.hasNameMusicSignal;
  }

  if (category === "media-store") {
    return signals.hasNameRecordSignal || signals.hasTypeRecordSignal || signals.hasKnownMediaVinylSignal;
  }

  return false;
}

function shouldKeepGooglePlace(place: Pick<GooglePlace, "displayName" | "formattedAddress" | "types" | "businessStatus">): boolean {
  const businessStatus = (place.businessStatus ?? "").toUpperCase();
  if (businessStatus === "CLOSED_PERMANENTLY") {
    return false;
  }

  return hasGoogleMusicSignal(place);
}

function getGoogleBusinessSummary(businessStatus?: string): string {
  if (!businessStatus) return "Google Places result";

  switch (businessStatus.toUpperCase()) {
    case "OPERATIONAL":
      return "Google Places: operating";
    case "CLOSED_TEMPORARILY":
      return "Google Places: temporarily closed";
    case "CLOSED_PERMANENTLY":
      return "Google Places: permanently closed";
    default:
      return "Google Places result";
  }
}

function mapGooglePlacesToStores(
  places: GooglePlace[],
  latitude: number,
  longitude: number
): StoreItem[] {
  const candidates: Array<
    StoreItem & {
      _placeId: string;
      _normalizedName: string;
      _distanceMiles: number;
      _relevanceTier: number;
      _relevanceScore: number;
    }
  > = [];

  for (const place of places) {
    const placeId = place.id?.trim();
    const name = place.displayName?.text?.trim();
    const address = place.formattedAddress?.trim();
    const lat = place.location?.latitude;
    const lon = place.location?.longitude;

    if (!placeId || !name || !address) continue;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    if (!shouldKeepGooglePlace(place)) continue;

    if (shouldExcludeStoreCandidate(name, address)) {
      logStoreDev("[RecordQuest][stores] excluded targeted false-positive result", {
        name,
        address,
        placeId,
      });
      continue;
    }

    const category = getGoogleStoreCategory(place);
    const distanceMiles = haversineDistanceMiles(latitude, longitude, lat, lon);
    const relevance = getGoogleStoreRelevance(place);

    if (relevance.tier <= 0) {
      continue;
    }

    candidates.push({
      id: `google-${placeId}`,
      name,
      neighborhood: "Nearby",
      address,
      rating: "—",
      distance: formatDistanceMiles(distanceMiles),
      hours: "Google Places",
      description: getGoogleBusinessSummary(place.businessStatus),
      storeCategory: category,
      latitude: lat,
      longitude: lon,
      source: "google",
      locationConfidence: "verified",
      _placeId: placeId,
      _normalizedName: normalizeStoreName(name),
      _distanceMiles: distanceMiles,
      _relevanceTier: relevance.tier,
      _relevanceScore: relevance.score,
    });
  }

  const sortedCandidates = candidates
    .sort((a, b) => {
      if (a._distanceMiles !== b._distanceMiles) return a._distanceMiles - b._distanceMiles;
      if (a._relevanceTier !== b._relevanceTier) return b._relevanceTier - a._relevanceTier;
      if (a._relevanceScore !== b._relevanceScore) return b._relevanceScore - a._relevanceScore;
      if (a._normalizedName !== b._normalizedName) {
        return a._normalizedName.localeCompare(b._normalizedName);
      }

      return a._placeId.localeCompare(b._placeId);
    })

  logStoreDev(
    "[RecordQuest][stores] ranked google results",
    sortedCandidates.map((candidate, index) => ({
      order: index + 1,
      name: candidate.name,
      distanceMiles: Number(candidate._distanceMiles.toFixed(2)),
      relevanceTier: candidate._relevanceTier,
      relevanceScore: candidate._relevanceScore,
      placeId: candidate._placeId,
    }))
  );

  return sortedCandidates
    .slice(0, MAX_RESULTS)
    .map(({ _placeId, _normalizedName, _distanceMiles, _relevanceTier, _relevanceScore, ...store }) => store);
}

async function fetchGooglePlacesNearby(latitude: number, longitude: number): Promise<StoreItem[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    return [];
  }

  const cacheKey = getGoogleCacheKey(latitude, longitude);
  const cached = googlePlacesSessionCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const queryResults = await Promise.allSettled(
    GOOGLE_PLACES_TEXT_QUERIES.map(async (textQuery) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
          },
          body: JSON.stringify({
            textQuery,
            pageSize: GOOGLE_PLACES_PAGE_SIZE,
            locationRestriction: buildGoogleLocationRestriction(latitude, longitude, GOOGLE_BETA_RADIUS_METERS),
            rankPreference: "DISTANCE",
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Google Places request failed with status ${response.status} for query \"${textQuery}\"`);
        }

        const payload = (await response.json()) as GooglePlacesTextSearchResponse;
        return payload.places ?? [];
      } finally {
        clearTimeout(timeoutId);
      }
    })
  );

  const successfulResults = queryResults.filter(
    (result): result is PromiseFulfilledResult<GooglePlace[]> => result.status === "fulfilled"
  );

  if (successfulResults.length === 0) {
    throw new StoreDiscoveryError("api-failure", "All Google Places queries failed.");
  }

  for (const result of queryResults) {
    if (result.status === "rejected") {
      logStoreWarnDev("[RecordQuest][stores] Google Places query failed", result.reason);
    }
  }

  const dedupedByPlaceId = new Map<string, GooglePlace>();
  for (const result of successfulResults) {
    for (const place of result.value) {
      const placeId = place.id?.trim();
      if (!placeId) {
        continue;
      }

      if (!dedupedByPlaceId.has(placeId)) {
        dedupedByPlaceId.set(placeId, place);
      }
    }
  }

  const stores = mapGooglePlacesToStores(Array.from(dedupedByPlaceId.values()), latitude, longitude);
  if (stores.length > 0) {
    googlePlacesSessionCache.set(cacheKey, stores);
  }
  return stores;
}

function getCuratedSourceOfTruth(): CuratedStoreSeed[] {
  const byBranch = new Map<string, CuratedStoreSeed>();

  for (const store of CURATED_BOSTON_STORES) {
    if (shouldExcludeStoreCandidate(store.name, store.address)) {
      continue;
    }

    const key = normalizeStoreDedupKey(store.name, store.address);
    if (!key) continue;

    const existing = byBranch.get(key);
    if (!existing) {
      byBranch.set(key, store);
      continue;
    }

    const existingHasCoordinates = hasValidCoordinates(existing);
    const nextHasCoordinates = hasValidCoordinates(store);
    const existingVerified = hasVerifiedCoordinates(existing);
    const nextVerified = hasVerifiedCoordinates(store);

    if (nextVerified && !existingVerified) {
      byBranch.set(key, store);
      continue;
    }

    if (existingVerified && !nextVerified) {
      continue;
    }

    if (!existingHasCoordinates && nextHasCoordinates) {
      byBranch.set(key, store);
      continue;
    }

    if (nextHasCoordinates && existingHasCoordinates) {
      // Prefer the newer canonical entry if both are valid.
      byBranch.set(key, store);
    }
  }

  return Array.from(byBranch.values());
}

function isLikelySameStore(first: StoreItem, second: StoreItem): boolean {
  const firstName = normalizeStoreName(first.name);
  const secondName = normalizeStoreName(second.name);

  if (!firstName || !secondName || firstName !== secondName) {
    return false;
  }

  if (
    typeof first.latitude === "number" &&
    typeof first.longitude === "number" &&
    typeof second.latitude === "number" &&
    typeof second.longitude === "number"
  ) {
    const distanceMiles = haversineDistanceMiles(
      first.latitude,
      first.longitude,
      second.latitude,
      second.longitude
    );

    return distanceMiles <= STORE_DEDUP_DISTANCE_MILES;
  }

  return normalizeStoreDedupKey(first.name, first.address) === normalizeStoreDedupKey(second.name, second.address);
}

function mergeCuratedWithSupplemental(curated: StoreItem[], supplemental: StoreItem[]): StoreItem[] {
  const merged: StoreItem[] = [];

  for (const store of curated) {
    if (merged.some((existing) => isLikelySameStore(existing, store))) {
      continue;
    }

    merged.push(store);
  }

  for (const store of supplemental) {
    if (merged.some((existing) => isLikelySameStore(existing, store))) {
      logStoreDev("[RecordQuest][stores] rejected result:", {
        name: store.name,
        reason: "duplicate of curated or previous result",
      });
      continue;
    }

    merged.push(store);
  }

  return merged.slice(0, MAX_RESULTS);
}

function buildCuratedFallbackStores(latitude?: number, longitude?: number): StoreItem[] {
  const hasLocation = typeof latitude === "number" && typeof longitude === "number";
  const curatedSource = getCuratedSourceOfTruth();

  const mapped = curatedSource.map((store) => {
    const useDistance = hasLocation && hasValidCoordinates(store);
    const distanceMiles = useDistance
      ? haversineDistanceMiles(latitude, longitude, store.latitude, store.longitude)
      : Number.NaN;
    const rankingMiles = Number.isFinite(distanceMiles)
      ? distanceMiles + getStorePriorityPenalty(store)
      : Number.NaN;

    return {
      id: store.id,
      name: store.name,
      neighborhood: store.neighborhood,
      address: store.address,
      rating: "—",
      distance: useDistance
        ? formatDistanceMiles(distanceMiles)
        : hasLocation
          ? "Curated beta"
          : "Boston area",
      hours: store.hours,
      description: store.description,
      storeCategory: store.storeCategory,
      verificationNote: store.verificationNote,
      latitude: store.latitude,
      longitude: store.longitude,
      source: "curated" as const,
      locationConfidence: store.locationConfidence,
      _distanceMiles: distanceMiles,
      _rankingMiles: rankingMiles,
    } satisfies RankedCuratedStore;
  });

  return mapped
    .sort((a, b) => {
      const aHasDistance = Number.isFinite(a._rankingMiles);
      const bHasDistance = Number.isFinite(b._rankingMiles);

      if (aHasDistance && bHasDistance) {
        if (a._rankingMiles !== b._rankingMiles) {
          return a._rankingMiles - b._rankingMiles;
        }

        if (a._distanceMiles !== b._distanceMiles) {
          return a._distanceMiles - b._distanceMiles;
        }
      }

      if (aHasDistance && !bHasDistance) return -1;
      if (!aHasDistance && bHasDistance) return 1;

      return 0;
    })
    .map(({ _distanceMiles, _rankingMiles, ...store }) => store);
}

export function getCuratedFallbackStores(): StoreItem[] {
  return buildCuratedFallbackStores();
}

function pickNeighborhood(tags: Record<string, string | undefined>): string {
  return (
    tags["addr:neighbourhood"] ??
    tags["addr:suburb"] ??
    tags["addr:district"] ??
    tags["addr:city"] ??
    tags["is_in"] ??
    "Nearby"
  );
}

function buildAddress(tags: Record<string, string | undefined>, lat: number, lon: number): string {
  const full = tags["addr:full"];
  if (full && full.trim()) return full.trim();

  const number = tags["addr:housenumber"]?.trim() ?? "";
  const street = tags["addr:street"]?.trim() ?? "";
  const city = tags["addr:city"]?.trim() ?? tags["addr:town"]?.trim() ?? tags["addr:village"]?.trim() ?? "";
  const state = tags["addr:state"]?.trim() ?? "";

  const line1 = [number, street].filter(Boolean).join(" ").trim();
  const line2 = [city, state].filter(Boolean).join(", ").trim();

  if (line1 || line2) {
    return [line1, line2].filter(Boolean).join(", ");
  }

  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

function buildDescription(tags: Record<string, string | undefined>): string {
  if (tags.description && tags.description.trim()) {
    return tags.description.trim();
  }

  const nameHint = tags["shop"] ?? tags["amenity"] ?? "record shop";

  if (nameHint === "music") {
    return "Local music store with vinyl and audio selections.";
  }

  if (nameHint === "second_hand") {
    return "Second-hand shop that may include used records and music finds.";
  }

  return "Independent record and music shop discovered from nearby map data.";
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").toLowerCase();
}

function getTagText(tags: Record<string, string | undefined>): string {
  return Object.entries(tags)
    .map(([key, value]) => `${key}:${value ?? ""}`)
    .join(" ")
    .toLowerCase();
}

function classifyStoreCandidate(
  tags: Record<string, string | undefined>
): { score: number; confidence: "high" | "medium" | "low"; rejectReason?: string } {
  const shop = normalizeText(tags.shop);
  const name = normalizeText(tags.name);
  const description = normalizeText(tags.description);
  const amenity = normalizeText(tags.amenity);
  const tourism = normalizeText(tags.tourism);
  const leisure = normalizeText(tags.leisure);
  const office = normalizeText(tags.office);
  const craft = normalizeText(tags.craft);
  const tagText = getTagText(tags);

  const nameHasRecordSignals = /\brecords?\b|\bvinyl\b|\blp\b|record\s+shop|record\s+store/.test(name);
  const descHasRecordSignals = /\brecords?\b|\bvinyl\b|\blp\b|record\s+shop|record\s+store/.test(description);
  const tagHasRecordSignals = /\brecords?\b|\bvinyl\b|\blp\b|record\s+shop|record\s+store/.test(tagText);

  const hasRecordSignals = nameHasRecordSignals || descHasRecordSignals || tagHasRecordSignals;

  const isExplicitlyIrrelevant =
    /\blibrary\b|\bchurch\b|\bcathedral\b|\bmosque\b|\bsynagogue\b|\bschool\b|\bmusic\s*school\b|\binstrument\b|\bconcert\b|\bvenue\b/.test(
      `${name} ${description} ${tagText}`
    ) ||
    amenity === "library" ||
    amenity === "place_of_worship" ||
    amenity === "school" ||
    amenity === "music_school" ||
    shop === "musical_instrument" ||
    tourism === "attraction" ||
    leisure === "music_venue" ||
    office === "religion" ||
    craft === "musical_instrument";

  if (isExplicitlyIrrelevant) {
    return {
      score: -1,
      confidence: "low",
      rejectReason: "irrelevant category (library/church/school/instrument/venue)",
    };
  }

  if (shop === "books" && !hasRecordSignals) {
    return {
      score: -1,
      confidence: "low",
      rejectReason: "generic bookstore without record/vinyl signals",
    };
  }

  if (shop === "second_hand" && !hasRecordSignals) {
    return {
      score: -1,
      confidence: "low",
      rejectReason: "generic second-hand shop without record/vinyl signals",
    };
  }

  if (shop === "music" && !hasRecordSignals) {
    return {
      score: -1,
      confidence: "low",
      rejectReason: "generic music store without record/vinyl signals",
    };
  }

  if (nameHasRecordSignals) {
    return { score: 120, confidence: "high" };
  }

  if (descHasRecordSignals || tagHasRecordSignals) {
    return { score: 80, confidence: "medium" };
  }

  return {
    score: -1,
    confidence: "low",
    rejectReason: "no record/vinyl confidence signal",
  };
}

async function fetchNearbyFromOverpass(
  latitude: number,
  longitude: number
): Promise<{ stores: StoreItem[]; rawCount: number; filteredCount: number }> {
  const query = `
[out:json][timeout:25];
(
  nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})["shop"="music"];
  nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})["shop"="second_hand"];
  nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})["name"~"records|record|vinyl|lp|wax",i];
  nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})["description"~"records|vinyl",i];
);
out center tags;
`;

  let payload: OverpassResponse | null = null;
  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Overpass request failed with status ${response.status}`);
      }

      payload = (await response.json()) as OverpassResponse;
      break;
    } catch (error) {
      lastError = error;
      logStoreWarnDev("[RecordQuest][stores] Overpass endpoint failed:", { endpoint, error });
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!payload) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Overpass request failed for all endpoints.");
  }

  try {
    const elements = payload.elements ?? [];
    const rawCount = elements.length;

    const seen = new Set<string>();
    const mapped = elements
      .map((element): RankedStore | null => {
        const lat = element.lat ?? element.center?.lat;
        const lon = element.lon ?? element.center?.lon;

        if (typeof lat !== "number" || typeof lon !== "number") return null;

        const tags = element.tags ?? {};
        const name = tags.name?.trim();
        if (!name) {
          logStoreDev("[RecordQuest][stores] rejected result:", {
            elementId: `${element.type}-${element.id}`,
            reason: "missing name",
          });
          return null;
        }

        const classification = classifyStoreCandidate(tags);
        if (classification.score < 0) {
          logStoreDev("[RecordQuest][stores] rejected result:", {
            name,
            elementId: `${element.type}-${element.id}`,
            reason: classification.rejectReason ?? "low confidence",
            shop: tags.shop ?? null,
            amenity: tags.amenity ?? null,
          });
          return null;
        }

        if (classification.confidence !== "high") {
          logStoreDev("[RecordQuest][stores] rejected result:", {
            name,
            elementId: `${element.type}-${element.id}`,
            reason: "not high confidence",
            confidence: classification.confidence,
          });
          return null;
        }

        const normalizedKey = `${name.toLowerCase()}_${lat.toFixed(4)}_${lon.toFixed(4)}`;
        if (seen.has(normalizedKey)) {
          logStoreDev("[RecordQuest][stores] rejected result:", {
            name,
            elementId: `${element.type}-${element.id}`,
            reason: "duplicate",
          });
          return null;
        }
        seen.add(normalizedKey);

        const distanceMiles = haversineDistanceMiles(latitude, longitude, lat, lon);
        const address = buildAddress(tags, lat, lon);
        const hasUsableAddressOrCoordinates = address.trim().length > 0 || (Number.isFinite(lat) && Number.isFinite(lon));

        if (!hasUsableAddressOrCoordinates) {
          logStoreDev("[RecordQuest][stores] rejected result:", {
            name,
            elementId: `${element.type}-${element.id}`,
            reason: "missing usable address/coordinates",
          });
          return null;
        }

        return {
          id: `osm-${element.type}-${element.id}`,
          name,
          neighborhood: pickNeighborhood(tags),
          address,
          rating: "—",
          distance: formatDistanceMiles(distanceMiles),
          hours: tags.opening_hours?.trim() || "Hours not listed",
          description: buildDescription(tags),
          latitude: lat,
          longitude: lon,
          source: "osm" as const,
          _distanceMiles: distanceMiles,
          _score: classification.score,
          _confidence: "high",
        };
      })
      .filter((store): store is RankedStore => store !== null)
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        return a._distanceMiles - b._distanceMiles;
      });

    const filteredCount = mapped.length;
    const stores = mapped
      .slice(0, MAX_RESULTS)
      .map(({ _distanceMiles, _score, ...store }) => store);

    return { stores, rawCount, filteredCount };
  } finally {
    // no-op: endpoint-specific timeouts are cleared inside loop
  }
}

async function getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new StoreDiscoveryError("location-disabled", "Location services are disabled.");
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const location = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Platform.OS === "android" ? Location.Accuracy.Balanced : Location.Accuracy.High,
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Timed out while requesting current location."));
        }, LOCATION_TIMEOUT_MS);
      }),
    ]);

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    const lastKnownLocation = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_LOCATION_MAX_AGE_MS,
      requiredAccuracy: LAST_KNOWN_LOCATION_REQUIRED_ACCURACY_METERS,
    });

    if (lastKnownLocation) {
      logStoreDev("[RecordQuest][stores] using last known location fallback");
      return {
        latitude: lastKnownLocation.coords.latitude,
        longitude: lastKnownLocation.coords.longitude,
      };
    }

    throw new StoreDiscoveryError("location-unavailable", error instanceof Error ? error.message : "Location unavailable.");
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function requestForegroundLocationPermission(): Promise<Location.LocationPermissionResponse> {
  const existingPermission = await Location.getForegroundPermissionsAsync();
  if (existingPermission.granted || !existingPermission.canAskAgain) {
    return existingPermission;
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      Location.requestForegroundPermissionsAsync(),
      new Promise<Location.LocationPermissionResponse>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new StoreDiscoveryError("permission-timeout", "Timed out while requesting location permission."));
        }, PERMISSION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function discoverNearbyStores(options?: { forceRefresh?: boolean }): Promise<StoreDiscoveryResult> {
  const fallbackStores = getCuratedFallbackStores();

  try {
    logStoreDev("[RecordQuest][stores] search radius miles:", metersToMiles(SEARCH_RADIUS_METERS).toFixed(1));

    if (!GOOGLE_PLACES_API_KEY) {
      return {
        stores: fallbackStores,
        notice: "Showing curated beta stores. Set Google Maps API key to enable live results.",
        usingFallback: true,
      };
    }

    const permission = await requestForegroundLocationPermission();

    if (!permission.granted) {
      return {
        stores: fallbackStores,
        notice: permission.canAskAgain
          ? "Location access is required for live nearby stores. Showing curated beta stores instead."
          : "Location access is off. Enable it in Settings for live nearby stores.",
        usingFallback: true,
      };
    }

    const { latitude, longitude } = await getCurrentLocation();
    logStoreDev("[RecordQuest][stores] user coordinates:", { latitude, longitude });

    if (options?.forceRefresh) {
      googlePlacesSessionCache.delete(getGoogleCacheKey(latitude, longitude));
    }

    const googleStores = await fetchGooglePlacesNearby(latitude, longitude);

    if (!googleStores.length) {
      return {
        stores: buildCuratedFallbackStores(latitude, longitude),
        notice: "No nearby record stores matched the live search right now. Showing curated beta stores instead.",
        usingFallback: true,
      };
    }

    return {
      stores: googleStores,
      notice: "Showing Google Places results.",
      usingFallback: false,
    };
  } catch (error) {
    logStoreWarnDev("[RecordQuest][stores] discovery failed", error);

    if (error instanceof StoreDiscoveryError) {
      if (error.kind === "permission-timeout") {
        return {
          stores: fallbackStores,
          notice: "Location permission is taking longer than expected. Showing curated beta stores for now.",
          usingFallback: true,
        };
      }

      if (error.kind === "location-disabled") {
        return {
          stores: fallbackStores,
          notice: "Location services are off. Showing curated beta stores instead.",
          usingFallback: true,
        };
      }

      if (error.kind === "location-unavailable") {
        return {
          stores: fallbackStores,
          notice: "Your location is temporarily unavailable. Showing curated beta stores instead.",
          usingFallback: true,
        };
      }
    }

    return {
      stores: fallbackStores,
      notice: "Live store search is temporarily unavailable. Showing curated beta stores instead.",
      usingFallback: true,
    };
  }
}
