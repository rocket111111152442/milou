"use client";
import Image, { type ImageProps } from "next/image";
import { aeImageUrl, isAeImage } from "@/lib/catalog/images";

/**
 * Listing photos are resized by AlterEstate's CDN (one request per width in the srcset)
 * instead of being re-encoded by our server. Other images use Next's optimiser.
 */
export function AeImage(props: ImageProps & { ratio?: number; maxWidth?: number }) {
  const { src, alt, ratio = 0.75, maxWidth = 1600, ...rest } = props;
  if (typeof src === "string" && isAeImage(src)) {
    // Never fetch more pixels than the slot can show (phones ask for 3x their width otherwise).
    const loader = ({ width }: { width: number }) => {
      const w = Math.min(width, maxWidth);
      return aeImageUrl(src, w, Math.round(w * ratio)) ?? src;
    };
    return <Image {...rest} alt={alt} src={src} loader={loader} />;
  }
  return <Image {...rest} alt={alt} src={src} />;
}
