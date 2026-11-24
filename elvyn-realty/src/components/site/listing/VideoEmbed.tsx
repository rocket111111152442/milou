"use client";
import { useState } from "react";
import { IconPlay } from "../Icons";

/** Click-to-load YouTube player (no third-party load until the visitor asks for it). */
export function VideoEmbed({ id, url, title, label }: { id: string | null; url: string; title: string; label: string }) {
  const [play, setPlay] = useState(false);
  if (!id) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn-outline"><IconPlay size={18} /> {label}</a>
    );
  }
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-navy-900">
      {play ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button type="button" onClick={() => setPlay(true)} className="group absolute inset-0 flex items-center justify-center" aria-label={`${label}: ${title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80" />
          <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white shadow-lift transition-transform group-hover:scale-105">
            <IconPlay size={34} />
          </span>
        </button>
      )}
    </div>
  );
}
