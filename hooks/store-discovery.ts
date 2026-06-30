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

function rankStoreCandidate(tags: Record<string, string | undefined>): number {
  const shop = normalizeText(tags.shop);
  const name = normalizeText(tags.name);
  const description = normalizeText(tags.description);
  const combined = `${name} ${description} ${shop}`;

  const hasRecordOrVinyl = /\brecords?\b|\bvinyl\b/.test(combined);
  const hasMusic = /\bmusic\b/.test(combined);

  const isStrong = hasRecordOrVinyl;
  const isGood = shop === "music";
  const isWeak = (shop === "books" || shop === "second_hand") && (hasRecordOrVinyl || hasMusic);

  if (!isStrong && !isGood && !isWeak) {
    return -1;
  }

  let score = 0;

  if (isStrong) score += 100;
  if (isGood) score += 60;
  if (isWeak) score += 30;
  if (hasMusic) score += 10;

  return score;
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
      .map((element) => {
        const lat = element.lat ?? element.center?.lat;
        const lon = element.lon ?? element.center?.lon;

        if (typeof lat !== "number" || typeof lon !== "number") return null;

        const tags = element.tags ?? {};
        const name = tags.name?.trim();
        if (!name) return null;

        const score = rankStoreCandidate(tags);
        if (score < 0) return null;

        const normalizedKey = `${name.toLowerCase()}_${lat.toFixed(4)}_${lon.toFixed(4)}`;
        if (seen.has(normalizedKey)) return null;
        seen.add(normalizedKey);

        const distanceMiles = haversineDistanceMiles(latitude, longitude, lat, lon);

        return {
          id: `osm-${element.type}-${element.id}`,
          name,
          neighborhood: pickNeighborhood(tags),
          address: buildAddress(tags, lat, lon),
          rating: "—",
          distance: formatDistanceMiles(distanceMiles),
          hours: tags.opening_hours?.trim() || "Hours not listed",
          description: buildDescription(tags),
          _distanceMiles: distanceMiles,
          _score: score,
        };
      })
      .filter((store): store is RankedStore => !!store)
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

export async function discoverNearbyStores(fallbackStores: StoreItem[]): Promise<StoreDiscoveryResult> {
  try {
    console.log("[RecordQuest][stores] search radius miles:", metersToMiles(SEARCH_RADIUS_METERS).toFixed(1));

    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      console.log("[RecordQuest][stores] fallback reason: location permission denied");
      return {
        stores: fallbackStores,
        notice: "Showing sample stores (location permission denied)",
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

    const liveStores = result.stores;

    if (liveStores.length === 0) {
      console.log("[RecordQuest][stores] fallback reason: no qualifying nearby record stores");
      return {
        stores: fallbackStores,
        notice: "No nearby record stores found — showing sample stores.",
        usingFallback: true,
      };
    }

    return {
      stores: liveStores,
      notice: "Showing nearby stores",
      usingFallback: false,
    };
  } catch (error) {
    console.log("[RecordQuest][stores] fallback reason: location or Overpass request failed", error);
    return {
      stores: fallbackStores,
      notice: "Showing sample stores (could not load your location)",
      usingFallback: true,
    };
  }
}
