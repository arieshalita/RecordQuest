import React, { useEffect, useState } from "react";
import { Image, type ImageProps, type ImageStyle, type StyleProp } from "react-native";
import { getFallbackAlbumArtUrl, resolveAlbumArtUrl } from "../utils/album-art";

type AlbumArtProps = Omit<ImageProps, "source" | "style" | "onError"> & {
  uri?: string | null;
  hint?: "thumb" | "detail";
  style?: StyleProp<ImageStyle>;
  fallbackUri?: string;
  onError?: ImageProps["onError"];
};

export function AlbumArt({ uri, hint = "thumb", fallbackUri, onError, ...imageProps }: AlbumArtProps) {
  const resolvedUri = resolveAlbumArtUrl(uri, hint);
  const fallback = resolveAlbumArtUrl(fallbackUri ?? getFallbackAlbumArtUrl(), hint);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [resolvedUri, fallback]);

  const sourceUri = hasError ? fallback : resolvedUri;

  return (
    <Image
      {...imageProps}
      source={{ uri: sourceUri }}
      onError={(event) => {
        if (!hasError && sourceUri !== fallback) {
          setHasError(true);
        }

        onError?.(event);
      }}
    />
  );
}