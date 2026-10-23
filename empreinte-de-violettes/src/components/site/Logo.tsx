import { cn } from "@/lib/cn";

/** Violette stylisée (cinq pétales) — monogramme de la Maison. */
export function VioletMark({ className, strokeWidth = 1.4 }: { className?: string; strokeWidth?: number }) {
  const petal = (l: number, w: number) => `M0,0C${w * 0.7},${-l * 0.1} ${w * 1.15},${-l * 0.92} 0,${-l}C${-w * 1.15},${-l * 0.92} ${-w * 0.7},${-l * 0.1} 0,0Z`;
  return (
    <svg viewBox="-50 -50 100 100" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round">
      <g transform="translate(0,6)">
        <path d={petal(40, 13.5)} transform="rotate(-24)" />
        <path d={petal(40, 13.5)} transform="rotate(24)" />
        <path d={petal(34, 12.5)} transform="rotate(-94)" />
        <path d={petal(34, 12.5)} transform="rotate(94)" />
        <path d={petal(38, 17)} transform="rotate(180)" />
        <circle r="3.4" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <VioletMark className="h-9 w-9 shrink-0 text-gold" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-caps text-[0.5rem] uppercase tracking-[0.55em] text-gold/90">Maison</span>
          <span className="mt-1 font-caps text-[0.82rem] uppercase tracking-[0.2em] sm:text-[0.9rem]">Empreinte de Violettes</span>
        </span>
      )}
    </span>
  );
}
