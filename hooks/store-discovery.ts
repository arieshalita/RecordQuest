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

type RankedStore = StoreItem & {
  _distanceMiles: number;
  _score: number;
  _confidence: "high" | "medium" | "low";
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

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const SEARCH_RADIUS_METERS = 32187;
const REQUEST_TIMEOUT_MS = 12000;
const LOCATION_TIMEOUT_MS = 9000;
const MAX_RESULTS = 15;
const STORE_DEDUP_DISTANCE_MILES = 0.2;
const ENABLE_OSM_SUPPLEMENTAL_FOR_BETA = false;
const GOOGLE_PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_PLACES_TEXT_QUERY = "record store vinyl music store";
const GOOGLE_PLACES_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.types";
const GOOGLE_PLACES_PAGE_SIZE = 15;
const GOOGLE_BETA_RADIUS_METERS = SEARCH_RADIUS_METERS;
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

const googlePlacesSessionCache = new Map<string, StoreItem[]>();

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
  return `${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
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
  const address = (place.formattedAddress ?? "").toLowerCase();
  const types = (place.types ?? []).map((type) => type.toLowerCase());
  const typeBlob = types.join(" ");

  const textSignal = /record|vinyl|music|newbury|barnes\s*&\s*noble/.test(`${name} ${address}`);
  const typeSignal = /record|music|book_store|comic_book_store/.test(typeBlob);

  return textSignal || typeSignal;
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
      _distanceMiles: number;
      _rankingMiles: number;
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

    const category = getGoogleStoreCategory(place);
    const distanceMiles = haversineDistanceMiles(latitude, longitude, lat, lon);
    const rankingMiles = distanceMiles + getStorePriorityPenalty({ storeCategory: category });

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
      _distanceMiles: distanceMiles,
      _rankingMiles: rankingMiles,
    });
  }

  return candidates
    .sort((a, b) => {
      if (a._rankingMiles !== b._rankingMiles) return a._rankingMiles - b._rankingMiles;
      return a._distanceMiles - b._distanceMiles;
    })
    .slice(0, MAX_RESULTS)
    .map(({ _distanceMiles, _rankingMiles, ...store }) => store);
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
        textQuery: GOOGLE_PLACES_TEXT_QUERY,
        pageSize: GOOGLE_PLACES_PAGE_SIZE,
        locationBias: {
          circle: {
            center: {
              latitude,
              longitude,
            },
            radius: GOOGLE_BETA_RADIUS_METERS,
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Google Places request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as GooglePlacesTextSearchResponse;
    const stores = mapGooglePlacesToStores(payload.places ?? [], latitude, longitude);
    googlePlacesSessionCache.set(cacheKey, stores);
    return stores;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getCuratedSourceOfTruth(): CuratedStoreSeed[] {
  const byBranch = new Map<string, CuratedStoreSeed>();

  for (const store of CURATED_BOSTON_STORES) {
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
      console.log("[RecordQuest][stores] rejected result:", {
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
      console.warn("[RecordQuest][stores] Overpass endpoint failed:", endpoint, error);
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
          console.log("[RecordQuest][stores] rejected result:", {
            elementId: `${element.type}-${element.id}`,
            reason: "missing name",
          });
          return null;
        }

        const classification = classifyStoreCandidate(tags);
        if (classification.score < 0) {
          console.log("[RecordQuest][stores] rejected result:", {
            name,
            elementId: `${element.type}-${element.id}`,
            reason: classification.rejectReason ?? "low confidence",
            shop: tags.shop ?? null,
            amenity: tags.amenity ?? null,
          });
          return null;
        }

        if (classification.confidence !== "high") {
          console.log("[RecordQuest][stores] rejected result:", {
            name,
            elementId: `${element.type}-${element.id}`,
            reason: "not high confidence",
            confidence: classification.confidence,
          });
          return null;
        }

        const normalizedKey = `${name.toLowerCase()}_${lat.toFixed(4)}_${lon.toFixed(4)}`;
        if (seen.has(normalizedKey)) {
          console.log("[RecordQuest][stores] rejected result:", {
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
          console.log("[RecordQuest][stores] rejected result:", {
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
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function discoverNearbyStores(): Promise<StoreDiscoveryResult> {
  const fallbackStores = getCuratedFallbackStores();
  let userLocation: { latitude: number; longitude: number } | null = null;

  try {
    console.log("[RecordQuest][stores] search radius miles:", metersToMiles(SEARCH_RADIUS_METERS).toFixed(1));

    if (!GOOGLE_PLACES_API_KEY) {
      console.log("[RecordQuest][stores] fallback reason: missing Google Places API key");
      return {
        stores: fallbackStores,
        notice: "Showing curated beta stores. Set Google Maps API key to enable live results.",
        usingFallback: true,
      };
    }

    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      console.log("[RecordQuest][stores] fallback reason: location permission denied");
      return {
        stores: fallbackStores,
        notice: "Showing curated beta stores. Enable location for nearby Google Places results.",
        usingFallback: true,
      };
    }

    userLocation = await getCurrentLocation();
    const { latitude, longitude } = userLocation;
    console.log("[RecordQuest][stores] user coordinates:", { latitude, longitude });

    const googleStores = await fetchGooglePlacesNearby(latitude, longitude);

    if (!googleStores.length) {
      return {
        stores: buildCuratedFallbackStores(latitude, longitude),
        notice: "Showing curated beta stores right now.",
        usingFallback: true,
      };
    }

    return {
      stores: googleStores,
      notice: "Showing Google Places results.",
      usingFallback: false,
    };
  } catch (error) {
    console.log("[RecordQuest][stores] fallback reason: Google Places request failed", error);
    return {
      stores: fallbackStores,
      notice: "Showing curated beta stores right now.",
      usingFallback: true,
    };
  }
}
