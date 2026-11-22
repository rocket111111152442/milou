import type { CSSProperties } from "react";

/** Formes décoratives (inspirées du logo : ronds, gouttes, étoiles) */
export function Blob({ className, color = "var(--color-mustard)", style }: { className?: string; color?: string; style?: CSSProperties }) {
  return <div aria-hidden className={`pointer-events-none absolute animate-morph ${className ?? ""}`} style={{ background: color, ...style }} />;
}

export function Star({ className, color = "var(--color-mustard)" }: { className?: string; color?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className={`pointer-events-none absolute ${className ?? ""}`}>
      <path
        style={{ fill: color }}
        d="M50 4c4 22 9 31 21 36 9 3 17 5 25 10-8 5-16 7-25 10-12 5-17 14-21 36-4-22-9-31-21-36-9-3-17-5-25-10 8-5 16-7 25-10C41 35 46 26 50 4Z"
      />
    </svg>
  );
}

export function Squiggle({ className, color = "var(--color-tomato)" }: { className?: string; color?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 200 30" className={`pointer-events-none ${className ?? ""}`} fill="none">
      <path
        d="M3 20c14-14 24-14 34 0s22 14 32 0 22-14 32 0 22 14 32 0 22-14 32 0 18 10 30 0"
        style={{ stroke: color }}
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Petite chouette en SVG – clin d'œil au nom */
export function Owl({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 120 130" className={className}>
      <path d="M20 40 L28 8 L48 28 Q60 24 72 28 L92 8 L100 40 Q112 70 100 100 Q88 126 60 126 Q32 126 20 100 Q8 70 20 40Z" fill="#8db5af" />
      <ellipse cx="60" cy="92" rx="26" ry="28" fill="#fbdccf" />
      <path d="M42 84 q6 -5 12 0 M66 84 q6 -5 12 0 M42 98 q6 -5 12 0 M66 98 q6 -5 12 0 M54 110 q6 -5 12 0" stroke="#f09a86" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="42" cy="52" r="17" fill="#fff" />
      <circle cx="78" cy="52" r="17" fill="#fff" />
      <circle cx="44" cy="54" r="8" fill="#2b2a36" />
      <circle cx="76" cy="54" r="8" fill="#2b2a36" />
      <circle cx="47" cy="51" r="2.5" fill="#fff" />
      <circle cx="79" cy="51" r="2.5" fill="#fff" />
      <path d="M54 64 L60 76 L66 64 Z" fill="#edb23a" />
    </svg>
  );
}

export function Wave({ className, color = "var(--color-cream)", flip = false }: { className?: string; color?: string; flip?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      className={`block h-[50px] w-full sm:h-[80px] ${flip ? "rotate-180" : ""} ${className ?? ""}`}
    >
      <path style={{ fill: color }} d="M0 60C120 20 240 0 360 20s240 70 360 60 240-60 360-60 240 50 360 40v30H0Z" />
    </svg>
  );
}
