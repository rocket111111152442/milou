import { useId } from "react";
import { cn } from "../lib/cn";

/**
 * Symbole Watchly — PROVISOIRE.
 * Aucun fichier de logo officiel n'a été fourni : ce symbole vectoriel (onde de surveillance
 * en forme de « W » sur fond encre) est un placeholder à remplacer par le logo définitif.
 * Il reste lisible de 16 px (favicon) à 1024 px (icône d'application).
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const gid = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={`wg-${gid}`} x1="8" y1="0" x2="56" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00E5FF" />
          <stop offset="0.35" stopColor="#245BFF" />
          <stop offset="0.7" stopColor="#8028FF" />
          <stop offset="1" stopColor="#ED4DF5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#111118" />
      <path
        d="M13 23.5 L22.5 42 L32 27 L41.5 42 L51 23.5"
        fill="none"
        stroke={`url(#wg-${gid})`}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="51" cy="23.5" r="3.6" fill="#ED4DF5" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="font-display text-[19px] font-bold tracking-[-0.03em] text-ink">Watchly</span>
    </span>
  );
}
