import Link from "next/link";

// Monogramme « PP » dans un losange, repris de l'enseigne de la boutique.
export function Monogram({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M32 3 L61 32 L32 61 L3 32 Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M32 9 L55 32 L32 55 L9 32 Z" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      <text
        x="32"
        y="39.5"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontStyle="italic"
        fontWeight="600"
        fontSize="20"
        letterSpacing="-1"
        fill="currentColor"
      >
        PP
      </text>
    </svg>
  );
}

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Le Pétrin de Pépiole — accueil"
      className={`group flex items-center gap-3 ${light ? "text-creme" : "text-cafe"}`}
    >
      <Monogram className="h-11 w-11 shrink-0 transition-transform duration-700 ease-[var(--ease-pain)] group-hover:rotate-[90deg]" />
      {!compact && (
        <span className="flex flex-col whitespace-nowrap leading-none">
          <span className="hidden font-script text-[1.05rem] text-caramel sm:block">Artisan Boulanger</span>
          <span className="font-display text-lg font-semibold tracking-tight sm:text-xl">Le Pétrin de Pépiole</span>
        </span>
      )}
    </Link>
  );
}
