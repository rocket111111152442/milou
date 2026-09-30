"use client";

import { useState } from "react";

/** Image avec une source de secours, puis un motif si rien ne charge. */
export default function Photo({
  src,
  fallback,
  alt,
  className = "",
  eager = false,
}: {
  src: string;
  fallback?: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-surface-2 via-surface to-ink ${className}`}>
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          onError={() => (fallback && current !== fallback ? setCurrent(fallback) : setFailed(true))}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {failed && <div className="stripes absolute inset-0" />}
    </div>
  );
}
