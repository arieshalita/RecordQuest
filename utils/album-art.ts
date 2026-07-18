const FALLBACK_ALBUM_ART_URL = "https://upload.wikimedia.org/wikipedia/commons/3/3c/No-album-art.png";

type AlbumArtSizeHint = "thumb" | "detail";

function appendDimension(url: string, hint: AlbumArtSizeHint): string {
  if (url.includes("coverartarchive.org") && !url.includes("-250")) {
    if (hint === "thumb") {
      return `${url}-250`;
    }
  }

  return url;
}

export function resolveAlbumArtUrl(rawUrl: string | null | undefined, hint: AlbumArtSizeHint = "thumb"): string {
  const trimmed = typeof rawUrl === "string" ? rawUrl.trim() : "";

  if (!trimmed) {
    return FALLBACK_ALBUM_ART_URL;
  }

  return appendDimension(trimmed, hint);
}

export function getFallbackAlbumArtUrl(): string {
  return FALLBACK_ALBUM_ART_URL;
}
