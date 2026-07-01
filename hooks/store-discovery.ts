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

type RankedStore = StoreItem & {
  _distanceMiles: number;
  _score: number;
  _confidence: "high" | "medium" | "low";
};

type CuratedStoreSeed = {
  id: string;
  name: string;
  neighborhood: string;
  address: string;
  hours: string;
  description: string;
  latitude: number;
  longitude: number;
};

export type StoreDiscoveryResult = {
  stores: StoreItem[];
  notice: string;
  usingFallback: boolean;
};

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const SEARCH_RADIUS_METERS = 48280;
const REQUEST_TIMEOUT_MS = 12000;
const MAX_RESULTS = 15;

const CURATED_BOSTON_STORES: CuratedStoreSeed[] = [
  {
    id: "newbury-comics-newbury",
    name: "Newbury Comics",
    neighborhood: "Back Bay",
    address: "332 Newbury St, Boston, MA 02115",
    hours: "Hours vary",
    description: "Long-running Boston music and pop-culture shop with a strong vinyl section.",
    latitude: 42.3496,
    longitude: -71.0875,
  },
  {
    id: "armageddon-harvard-square",
    name: "Armageddon Shop",
    neighborhood: "Harvard Square",
    address: "22 Eliot St, Cambridge, MA 02138",
    hours: "Hours vary",
    description: "Independent record shop known for punk, metal, indie, and underground titles.",
    latitude: 42.3724,
    longitude: -71.1211,
  },
  {
    id: "in-your-ear-allston",
    name: "In Your Ear Records",
    neighborhood: "Allston",
    address: "957 Commonwealth Ave, Boston, MA 02215",
    hours: "Hours vary",
    description: "Classic Boston used record store with deep crates across many genres.",
    latitude: 42.3502,
    longitude: -71.1172,
  },
  {
    id: "stereo-jacks-ball-square",
    name: "Stereo Jack's",
    neighborhood: "Ball Square",
    address: "744 Broadway, Somerville, MA 02144",
    hours: "Hours vary",
    description: "Neighborhood vinyl spot with curated used and new records.",
    latitude: 42.4017,
    longitude: -71.1108,
  },
  {
    id: "deep-thoughts-jp",
    name: "Deep Thoughts JP",
    neighborhood: "Jamaica Plain",
    address: "31A South St, Jamaica Plain, MA 02130",
    hours: "Hours vary",
    description: "JP shop focused on eclectic used vinyl and local discoveries.",
    latitude: 42.3154,
    longitude: -71.1148,
  },
  {
    id: "village-vinyl-coolidge",
    name: "Village Vinyl & Hi-Fi",
    neighborhood: "Coolidge Corner",
    address: "434 Harvard St, Brookline, MA 02446",
    hours: "Hours vary",
    description: "Brookline record and hi-fi destination with a broad vinyl selection.",
    latitude: 42.3427,
    longitude: -71.1222,
  },
  {
    id: "wanna-hear-it-watertown",
    name: "Wanna Hear It Records",
    neighborhood: "Watertown Square",
    address: "117 Church St, Watertown, MA 02472",
    hours: "Hours vary",
    description: "Independent shop with punk, hardcore, and collectible records.",
    latitude: 42.3708,
    longitude: -71.1829,
  },
  {
    id: "nuggets-kenmore",
    name: "Nuggets Record Shop",
    neighborhood: "Kenmore / Fenway",
    address: "486 Commonwealth Ave, Boston, MA 02215",
    hours: "Hours vary",
    description: "Beloved local record store with a strong used selection.",
    latitude: 42.3494,
    longitude: -71.0989,
  },
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

function mergeCuratedWithSupplemental(curated: StoreItem[], supplemental: StoreItem[]): StoreItem[] {
  const seen = new Set<string>();

  const merged: StoreItem[] = [];

  for (const store of curated) {
    const key = normalizeStoreDedupKey(store.name, store.address);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(store);
  }

  for (const store of supplemental) {
    const key = normalizeStoreDedupKey(store.name, store.address);
    if (seen.has(key)) {
      console.log("[RecordQuest][stores] rejected result:", {
        name: store.name,
        reason: "duplicate of curated or previous result",
      });
      continue;
    }
    seen.add(key);
    merged.push(store);
  }

  return merged.slice(0, MAX_RESULTS);
}

function buildCuratedFallbackStores(latitude?: number, longitude?: number): StoreItem[] {
  const hasLocation = typeof latitude === "number" && typeof longitude === "number";

  const mapped = CURATED_BOSTON_STORES.map((store) => {
    const distanceMiles = hasLocation
      ? haversineDistanceMiles(latitude, longitude, store.latitude, store.longitude)
      : Number.NaN;

    return {
      id: store.id,
      name: store.name,
      neighborhood: store.neighborhood,
      address: store.address,
      rating: "—",
      distance: hasLocation ? formatDistanceMiles(distanceMiles) : "Boston area",
      hours: store.hours,
      description: store.description,
      _distanceMiles: distanceMiles,
    };
  });

  return mapped
    .sort((a, b) => {
      if (!Number.isFinite(a._distanceMiles) || !Number.isFinite(b._distanceMiles)) return 0;
      return a._distanceMiles - b._distanceMiles;
    })
    .map(({ _distanceMiles, ...store }) => store);
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
  nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})["shop"="books"];
  nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})["name"~"records|record|vinyl|music",i];
  nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})["description"~"records|vinyl",i];
);
out center tags;
`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OVERPASS_ENDPOINT, {
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

    const payload = (await response.json()) as OverpassResponse;
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
    clearTimeout(timeout);
  }
}

export async function discoverNearbyStores(): Promise<StoreDiscoveryResult> {
  const fallbackStores = getCuratedFallbackStores();

  try {
    console.log("[RecordQuest][stores] search radius miles:", metersToMiles(SEARCH_RADIUS_METERS).toFixed(1));

    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      console.log("[RecordQuest][stores] fallback reason: location permission denied");
      return {
        stores: fallbackStores,
        notice: "Showing recommended record stores near you.",
        usingFallback: true,
      };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Platform.OS === "android" ? Location.Accuracy.Balanced : Location.Accuracy.High,
    });

    const latitude = location.coords.latitude;
    const longitude = location.coords.longitude;
    console.log("[RecordQuest][stores] user coordinates:", { latitude, longitude });

    const result = await fetchNearbyFromOverpass(latitude, longitude);
    console.log("[RecordQuest][stores] raw Overpass result count:", result.rawCount);
    console.log("[RecordQuest][stores] filtered store count:", result.filteredCount);

    const curatedStores = buildCuratedFallbackStores(latitude, longitude);
    const mergedStores = mergeCuratedWithSupplemental(curatedStores, result.stores);

    return {
      stores: mergedStores,
      notice: "Showing recommended record stores near you.",
      usingFallback: result.stores.length === 0,
    };
  } catch (error) {
    console.log("[RecordQuest][stores] fallback reason: location or Overpass request failed", error);
    return {
      stores: fallbackStores,
      notice: "Showing recommended record stores near you.",
      usingFallback: true,
    };
  }
}
