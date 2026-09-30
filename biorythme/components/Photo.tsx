"use client";

import { useState } from "react";

/** Image distante avec repli sur un dégradé si elle ne charge pas. */
export default function Photo({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-surface-2 via-surface to-ink ${className}`}>
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {failed && <div className="stripes absolute inset-0" />}
    </div>
  );
}
