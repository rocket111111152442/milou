"use client";
import Image, { type ImageProps } from "next/image";
import { aeImageUrl, isAeImage } from "@/lib/catalog/images";

/**
 * Listing photos are resized by AlterEstate's CDN (one request per width in the srcset)
 * instead of being re-encoded by our server. Other images use Next's optimiser.
 */
export function AeImage(props: ImageProps & { ratio?: number }) {
  const { src, alt, ratio = 0.75, ...rest } = props;
  if (typeof src === "string" && isAeImage(src)) {
    return <Image {...rest} alt={alt} src={src} loader={({ width }) => aeImageUrl(src, width, Math.round(width * ratio)) ?? src} />;
  }
  return <Image {...rest} alt={alt} src={src} />;
}
