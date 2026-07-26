export type GoogleStoreRelevanceInput = {
  name: string;
  address?: string;
  types?: string[];
  businessStatus?: string;
  matchedQueries?: string[];
  isCuratedMatch?: boolean;
};

export type GoogleStoreRelevanceDecision = {
  include: boolean;
  score: number;
  tier: "high" | "medium" | "low" | "excluded";
  reason: string;
  positives: string[];
  negatives: string[];
};

const RECORD_NAME_SIGNAL = /\brecords?\b|\bvinyl\b|\blp\b|record\s+shop|record\s+store|used\s+record/;
const MUSIC_NAME_SIGNAL = /\bmusic\b/;
const MUSIC_TYPE_SIGNAL = /record|vinyl|music/;

const HARD_NEGATIVE_TYPE_PATTERNS = [
  "musical_instrument",
  "music_school",
  "school",
  "recording_studio",
  "rehearsal_studio",
  "live_music_venue",
  "night_club",
  "bar",
  "museum",
  "radio_station",
  "electronics_repair",
] as const;

function normalizeTypes(types?: string[]): string[] {
  return (types ?? []).map((type) => type.trim().toLowerCase()).filter((type) => type.length > 0);
}

function hasAnyTypeFragment(types: string[], fragments: readonly string[]): boolean {
  return types.some((type) => fragments.some((fragment) => type.includes(fragment)));
}

function isRetailishType(types: string[]): boolean {
  return types.some((type) => type.includes("_store") || type === "store");
}

function getRecordLikeQuerySignal(matchedQueries: string[]): boolean {
  return matchedQueries.some((query) => /record|vinyl|lp/.test(query));
}

export function normalizeStoreName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,'`’]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeStoreAddress(address: string): string {
  return address
    .trim()
    .toLowerCase()
    .replace(/[.,'`’#]/g, "")
    .replace(/\s+/g, " ");
}

export function buildStoreDedupFallbackKey(name: string, address: string): string {
  const normalizedName = normalizeStoreName(name);
  const normalizedAddress = normalizeStoreAddress(address);
  return `${normalizedName}::${normalizedAddress}`;
}

export function scoreGoogleStoreRelevance(input: GoogleStoreRelevanceInput): GoogleStoreRelevanceDecision {
  const normalizedName = normalizeStoreName(input.name);
  const normalizedTypes = normalizeTypes(input.types);
  const normalizedBusinessStatus = (input.businessStatus ?? "").trim().toUpperCase();
  const normalizedQueries = (input.matchedQueries ?? []).map((query) => query.toLowerCase().trim());
  const positives: string[] = [];
  const negatives: string[] = [];

  if (normalizedBusinessStatus === "CLOSED_PERMANENTLY") {
    return {
      include: false,
      score: -999,
      tier: "excluded",
      reason: "permanently closed",
      positives,
      negatives: ["permanently closed"],
    };
  }

  const hasRecordNameSignal = RECORD_NAME_SIGNAL.test(normalizedName);
  const hasMusicNameSignal = MUSIC_NAME_SIGNAL.test(normalizedName);
  const hasTypeMusicSignal = normalizedTypes.some((type) => MUSIC_TYPE_SIGNAL.test(type));
  const hasRetailTypeSignal = isRetailishType(normalizedTypes);
  const hasHardNegativeTypeSignal = hasAnyTypeFragment(normalizedTypes, HARD_NEGATIVE_TYPE_PATTERNS);
  const hasBookstoreTypeSignal = normalizedTypes.some((type) => type.includes("book_store"));
  const hasRecordLikeQuerySignal = getRecordLikeQuerySignal(normalizedQueries);
  const hasCuratedMatchSignal = Boolean(input.isCuratedMatch);

  let score = 0;

  if (hasCuratedMatchSignal) {
    score += 90;
    positives.push("curated-match");
  }

  if (hasRecordNameSignal) {
    score += 70;
    positives.push("record-name-signal");
  }

  if (hasTypeMusicSignal) {
    score += 45;
    positives.push("type-music-signal");
  }

  if (hasMusicNameSignal) {
    score += 12;
    positives.push("music-name-signal");
  }

  if (hasRetailTypeSignal) {
    score += 15;
    positives.push("retail-type-signal");
  }

  if (hasRecordLikeQuerySignal) {
    score += 14;
    positives.push("record-query-signal");
  }

  if (hasBookstoreTypeSignal) {
    score += 6;
    positives.push("bookstore-type-signal");
  }

  if (normalizedBusinessStatus === "CLOSED_TEMPORARILY") {
    score -= 16;
    negatives.push("temporarily-closed");
  }

  if (hasHardNegativeTypeSignal) {
    score -= 95;
    negatives.push("hard-negative-type-signal");
  }

  const hasStrongPositiveSignals =
    hasCuratedMatchSignal || hasRecordNameSignal || hasTypeMusicSignal;

  if (hasHardNegativeTypeSignal && !hasStrongPositiveSignals) {
    return {
      include: false,
      score,
      tier: "excluded",
      reason: "excluded: hard negative type without strong record signals",
      positives,
      negatives,
    };
  }

  // Guardrail: keep precision high by requiring at least one strong positive signal.
  if (!hasStrongPositiveSignals && !(hasRetailTypeSignal && hasRecordLikeQuerySignal && hasMusicNameSignal)) {
    return {
      include: false,
      score,
      tier: "excluded",
      reason: "excluded: insufficient record-retail signals",
      positives,
      negatives,
    };
  }

  if (score < 35) {
    return {
      include: false,
      score,
      tier: "excluded",
      reason: "excluded: relevance score below threshold",
      positives,
      negatives,
    };
  }

  const tier: "high" | "medium" | "low" = score >= 90 ? "high" : score >= 60 ? "medium" : "low";

  return {
    include: true,
    score,
    tier,
    reason: `included: ${tier} confidence`,
    positives,
    negatives,
  };
}
