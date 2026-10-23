"use client";

import Image, { type ImageProps } from "next/image";

/** next/image adapté : Unsplash redimensionné par son CDN, Vercel Blob optimisé, data-URL et domaines inconnus servis tels quels. */
export function SmartImage({ src, alt, ...props }: Omit<ImageProps, "src" | "loader"> & { src: string }) {
  if (!src) return <div className="absolute inset-0 bg-aubergine-800" />;
  const isUnsplash = src.startsWith("https://images.unsplash.com/");
  if (isUnsplash) {
    const base = src.split("?")[0];
    return (
      <Image
        src={base}
        alt={alt}
        loader={({ width, quality }) => `${base}?w=${width}&q=${quality || 72}&auto=format&fit=crop`}
        {...props}
      />
    );
  }
  const optimizable = src.startsWith("/") || src.includes(".public.blob.vercel-storage.com");
  return <Image src={src} alt={alt} unoptimized={!optimizable} {...props} />;
}
