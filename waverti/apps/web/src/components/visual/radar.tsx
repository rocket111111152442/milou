import { cn } from "@waverti/ui";

/**
 * Radar Waverti : visuel décoratif (aria-hidden). Des pages « surveillées » sont des points ; le faisceau passe, le point s'illumine et
 * une alerte d'exemple apparaît. Pur CSS : aucune image, aucune donnée réelle. Les exemples sont étiquetés comme tels par la page qui l'affiche.
 * Angles en degrés depuis le haut, sens horaire ; le délai de chaque point suit le passage du faisceau (cycle de 6 s).
 */
const BLIPS: Array<{ r: number; a: number; label?: string; side: "l" | "r" }> = [
  { r: 36, a: 28, label: "Prix sous 100 €", side: "r" },
  { r: 22, a: 112, label: "De nouveau en stock", side: "r" },
  { r: 41, a: 205, label: "Billetterie ouverte", side: "l" },
  { r: 28, a: 290, label: "Nouvelle annonce", side: "l" },
  { r: 14, a: 160, side: "r" },
  { r: 44, a: 335, side: "l" },
  { r: 8, a: 250, side: "l" },
];

export function Radar({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative mx-auto aspect-square w-full max-w-[520px] select-none", className)}>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(36,91,255,0.28),rgba(13,12,43,0)_68%)]" />
      {[0, 14, 28, 42].map((inset) => (
        <div key={inset} className="absolute rounded-full border border-white/15" style={{ inset: `${inset}%` }} />
      ))}
      <div className="absolute inset-0 rounded-full border border-white/10" />
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/[0.07]" />
      <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/[0.07]" />
      <div
        className="anim-sweep absolute inset-0 rounded-full"
        style={{ background: "conic-gradient(from 0deg, rgba(0,229,255,0) 0deg, rgba(0,229,255,0) 250deg, rgba(0,229,255,0.38) 360deg)" }}
      />
      <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_24px_6px_rgba(0,229,255,0.65)]" />
      {BLIPS.map((b, i) => {
        const rad = (b.a * Math.PI) / 180;
        const x = 50 + b.r * Math.sin(rad);
        const y = 50 - b.r * Math.cos(rad);
        const delay = `${((b.a / 360) * 6).toFixed(2)}s`;
        return (
          <div key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
            <span className="absolute -left-1.5 -top-1.5 size-3 rounded-full bg-cyan shadow-[0_0_14px_3px_rgba(0,229,255,0.7)]" />
            <span className="anim-blip absolute -left-1.5 -top-1.5 size-3 rounded-full border border-cyan" style={{ animationDelay: delay }} />
            {b.label ? (
              <span
                className={cn(
                  "anim-chip absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[11px] font-medium text-white backdrop-blur",
                  b.side === "r" ? "left-4" : "right-4",
                )}
                style={{ animationDelay: delay, opacity: 0 }}
              >
                {b.label}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
