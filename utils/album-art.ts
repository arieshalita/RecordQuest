const FALLBACK_ALBUM_ART_URL = "https://upload.wikimedia.org/wikipedia/commons/3/3c/No-album-art.png";
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export type CoverArtArchiveLegacyKind = "release" | "release-group";

export type CoverArtArchiveLegacyMatch = {
  kind: CoverArtArchiveLegacyKind;
  mbid: string;
  normalizedUrl: string;
};

export type CoverArtArchiveArtworkIdentity = {
  kind: CoverArtArchiveLegacyKind;
  mbid: string;
  imageId: string | null;
  normalizedUrl: string;
};

type AlbumArtSizeHint = "thumb" | "detail";

export function normalizeAlbumArtUrl(rawUrl: string): string {
  const withProtocol = rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl;
  const upgradedToHttps = withProtocol.startsWith("http://") ? `https://${withProtocol.slice("http://".length)}` : withProtocol;

  try {
    const parsed = new URL(upgradedToHttps);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.href;
  } catch {
    return "";
  }
}

export function isPlaceholderAlbumArtUrl(rawUrl: string | null | undefined): boolean {
  const trimmed = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!trimmed) {
    return false;
  }

  const normalized = normalizeAlbumArtUrl(trimmed);
  if (!normalized) {
    return false;
  }

  return normalized === FALLBACK_ALBUM_ART_URL;
}

export function normalizeAlbumArtUrlOrNull(rawUrl: string | null | undefined): string | null {
  const trimmed = typeof rawUrl === "string" ? rawUrl.trim() : "";

  if (!trimmed) {
    return null;
  }

  const normalized = normalizeAlbumArtUrl(trimmed);
  if (!normalized) {
    return null;
  }

  if (isPlaceholderAlbumArtUrl(normalized)) {
    return null;
  }

  return normalized;
}

export function isValidAlbumArtUrl(rawUrl: string | null | undefined): boolean {
  return normalizeAlbumArtUrlOrNull(rawUrl) !== null;
}

export function resolveAlbumArtUrl(rawUrl: string | null | undefined, hint: AlbumArtSizeHint = "thumb"): string {
  const normalized = normalizeAlbumArtUrlOrNull(rawUrl);
  if (!normalized) {
    return FALLBACK_ALBUM_ART_URL;
  }

  return normalized;
}

export function getFallbackAlbumArtUrl(): string {
  return FALLBACK_ALBUM_ART_URL;
}

function readCoverArtArchiveKindFromPath(pathname: string): CoverArtArchiveLegacyKind | null {
  if (pathname.startsWith("/release-group/")) {
    return "release-group";
  }

  if (pathname.startsWith("/release/")) {
    return "release";
  }

  return null;
}

function extractMbidFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  const candidate = segments[1]?.trim() ?? "";
  if (!UUID_PATTERN.test(candidate)) {
    return null;
  }

  return candidate.toLowerCase();
}

function normalizeCandidateId(rawValue: string): string {
  return rawValue.trim().toLowerCase();
}

function extractImageIdFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 3) {
    return null;
  }

  const rawImageSegment = segments[2] ?? "";
  const frontMatch = rawImageSegment.match(/^front(?:-(250|500))?$/i);
  if (frontMatch) {
    return "front";
  }

  const sizedSuffixMatch = rawImageSegment.match(/^(.+)-(250|500)\.[a-z0-9]+$/i);
  if (sizedSuffixMatch?.[1]) {
    return normalizeCandidateId(sizedSuffixMatch[1]);
  }

  const genericFileMatch = rawImageSegment.match(/^(.+)\.[a-z0-9]+$/i);
  if (genericFileMatch?.[1]) {
    return normalizeCandidateId(genericFileMatch[1]);
  }

  return normalizeCandidateId(rawImageSegment || "");
}

function isLegacyConstructedPath(pathname: string): boolean {
  return (
    pathname.includes("/front-250") ||
    pathname.includes("/front-500") ||
    /\/[^/]+-250\.[a-z0-9]+$/i.test(pathname) ||
    /\/[^/]+-500\.[a-z0-9]+$/i.test(pathname)
  );
}

export function matchLegacyConstructedCoverArtArchiveUrl(
  rawUrl: string | null | undefined
): CoverArtArchiveLegacyMatch | null {
  const normalized = normalizeAlbumArtUrlOrNull(rawUrl);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith("coverartarchive.org")) {
      return null;
    }

    const kind = readCoverArtArchiveKindFromPath(parsed.pathname);
    if (!kind) {
      return null;
    }

    const mbid = extractMbidFromPath(parsed.pathname);
    if (!mbid) {
      return null;
    }

    if (!isLegacyConstructedPath(parsed.pathname)) {
      return null;
    }

    return {
      kind,
      mbid,
      normalizedUrl: normalized,
    };
  } catch {
    return null;
  }
}

export function parseCoverArtArchiveArtworkIdentity(
  rawUrl: string | null | undefined
): CoverArtArchiveArtworkIdentity | null {
  const normalized = normalizeAlbumArtUrlOrNull(rawUrl);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith("coverartarchive.org")) {
      return null;
    }

    const kind = readCoverArtArchiveKindFromPath(parsed.pathname);
    if (!kind) {
      return null;
    }

    const mbid = extractMbidFromPath(parsed.pathname);
    if (!mbid) {
      return null;
    }

    const imageId = extractImageIdFromPath(parsed.pathname);

    return {
      kind,
      mbid,
      imageId,
      normalizedUrl: normalized,
    };
  } catch {
    return null;
  }
}

export function isEquivalentCoverArtArchiveImage(
  left: CoverArtArchiveArtworkIdentity | null,
  right: CoverArtArchiveArtworkIdentity | null
): boolean {
  if (!left || !right) {
    return false;
  }

  if (left.kind !== right.kind || left.mbid !== right.mbid) {
    return false;
  }

  if (!left.imageId || !right.imageId) {
    return false;
  }

  return left.imageId === right.imageId;
}
