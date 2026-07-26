type CollectorFormatBadge =
  | "LP"
  | `${number}×LP`
  | "EP"
  | "Single"
  | "7\""
  | "10\""
  | "12\""
  | "Compilation"
  | "Live"
  | "Soundtrack"
  | "Box Set";

export type RecordFormatBadgeInput = {
  explicitFormat?: string | null;
  mediaFormat?: string | null;
  mediaCount?: number | null;
  releasePrimaryType?: string | null;
  releaseSecondaryTypes?: string[] | null;
  title?: string | null;
  legacyGenre?: string | null;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function parseLpCount(value: string): number | null {
  const compact = value.replace(/\s+/g, "");
  const directMatch = compact.match(/^(\d+)(x|×)?lp$/);

  if (directMatch) {
    const parsed = Number.parseInt(directMatch[1] ?? "", 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
  }

  const countedMatch = value.match(/(\d+)\s*(x|×)\s*lp/);
  if (countedMatch) {
    const parsed = Number.parseInt(countedMatch[1] ?? "", 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
  }

  return null;
}

function inferInchBadge(value: string): "7\"" | "10\"" | "12\"" | null {
  if (/\b7\s*(inch|in|\")\b/.test(value) || /\b7\"/.test(value)) {
    return "7\"";
  }

  if (/\b10\s*(inch|in|\")\b/.test(value) || /\b10\"/.test(value)) {
    return "10\"";
  }

  if (/\b12\s*(inch|in|\")\b/.test(value) || /\b12\"/.test(value)) {
    return "12\"";
  }

  return null;
}

function formatLpByCount(count: number | null | undefined): CollectorFormatBadge {
  if (typeof count === "number" && Number.isFinite(count) && count >= 2) {
    return `${count}×LP`;
  }

  return "LP";
}

function isExplicitBoxSet(value: string): boolean {
  return value.includes("box set") || value.includes("boxset");
}

function mapFormatValue(value: string): CollectorFormatBadge | null {
  if (!value) {
    return null;
  }

  if (isExplicitBoxSet(value)) {
    return "Box Set";
  }

  if (value === "ep") {
    return "EP";
  }

  if (value === "single") {
    return "Single";
  }

  if (value === "compilation") {
    return "Compilation";
  }

  if (value === "live") {
    return "Live";
  }

  if (value === "soundtrack" || value === "ost") {
    return "Soundtrack";
  }

  const inchBadge = inferInchBadge(value);
  if (inchBadge) {
    return inchBadge;
  }

  const lpCount = parseLpCount(value);
  if (lpCount !== null) {
    return formatLpByCount(lpCount);
  }

  if (value === "album" || value === "lp" || value === "vinyl") {
    return "LP";
  }

  return null;
}

function mapFromMediaFormat(mediaFormat: string, mediaCount?: number | null): CollectorFormatBadge | null {
  if (!mediaFormat) {
    return null;
  }

  const inchBadge = inferInchBadge(mediaFormat);
  if (inchBadge) {
    return inchBadge;
  }

  if (mediaFormat.includes("single")) {
    return "Single";
  }

  if (mediaFormat.includes("vinyl") || mediaFormat.includes("lp")) {
    return formatLpByCount(mediaCount);
  }

  return null;
}

function mapFromReleaseTypes(
  primaryType: string,
  secondaryTypes: string[]
): CollectorFormatBadge | null {
  if (secondaryTypes.includes("compilation")) {
    return "Compilation";
  }

  if (secondaryTypes.includes("live")) {
    return "Live";
  }

  if (secondaryTypes.includes("soundtrack")) {
    return "Soundtrack";
  }

  if (primaryType === "ep") {
    return "EP";
  }

  if (primaryType === "single") {
    return "Single";
  }

  if (primaryType === "album") {
    return "LP";
  }

  return null;
}

export function deriveRecordFormatBadge(input: RecordFormatBadgeInput): CollectorFormatBadge | null {
  const explicitFormat = normalizeText(input.explicitFormat);
  const mediaFormat = normalizeText(input.mediaFormat);
  const primaryType = normalizeText(input.releasePrimaryType);
  const secondaryTypes = (input.releaseSecondaryTypes ?? [])
    .map((value) => normalizeText(value))
    .filter((value) => value.length > 0);
  const title = normalizeText(input.title);
  const legacyGenre = normalizeText(input.legacyGenre);

  const explicitMapped = mapFormatValue(explicitFormat);
  if (explicitMapped) {
    return explicitMapped;
  }

  const mediaMapped = mapFromMediaFormat(mediaFormat, input.mediaCount);
  if (mediaMapped) {
    return mediaMapped;
  }

  const releaseTypeMapped = mapFromReleaseTypes(primaryType, secondaryTypes);
  if (releaseTypeMapped) {
    return releaseTypeMapped;
  }

  if (
    isExplicitBoxSet(title) ||
    isExplicitBoxSet(legacyGenre) ||
    secondaryTypes.includes("box set")
  ) {
    return "Box Set";
  }

  const legacyMapped = mapFormatValue(legacyGenre);
  if (legacyMapped && legacyMapped !== "LP") {
    return legacyMapped;
  }

  return null;
}
