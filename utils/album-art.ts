const FALLBACK_ALBUM_ART_URL = "https://upload.wikimedia.org/wikipedia/commons/3/3c/No-album-art.png";

type AlbumArtSizeHint = "thumb" | "detail";

function normalizeAlbumArtUrl(rawUrl: string): string {
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

export function resolveAlbumArtUrl(rawUrl: string | null | undefined, hint: AlbumArtSizeHint = "thumb"): string {
  const trimmed = typeof rawUrl === "string" ? rawUrl.trim() : "";

  if (!trimmed) {
    return FALLBACK_ALBUM_ART_URL;
  }

  const normalized = normalizeAlbumArtUrl(trimmed);
  if (!normalized) {
    return FALLBACK_ALBUM_ART_URL;
  }

  return normalized;
}

export function getFallbackAlbumArtUrl(): string {
  return FALLBACK_ALBUM_ART_URL;
}
