import { useId } from "react";
import { cn } from "../lib/cn";

/**
 * Graphiques SVG légers, sans dépendance. Les valeurs nulles sont rendues comme
 * « donnée indisponible » (jamais interpolées ni inventées).
 */

export function Sparkline({
  values,
  className,
  label,
}: {
  values: Array<number | null>;
  className?: string;
  label: string;
}) {
  const gid = useId().replace(/:/g, "");
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) {
    return (
      <div className={cn("grid h-12 place-items-center text-xs text-muted-fg", className)}>Donnée indisponible</div>
    );
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const w = 120;
  const h = 40;
  const step = w / (values.length - 1);
  const segments: string[] = [];
  let current = "";
  values.forEach((v, i) => {
    if (v === null) {
      if (current) segments.push(current);
      current = "";
      return;
    }
    const x = i * step;
    const y = h - 4 - ((v - min) / span) * (h - 8);
    current += `${current ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
  });
  if (current) segments.push(current);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-12 w-full", className)} role="img" aria-label={label} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${gid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#00E5FF" />
          <stop offset="0.4" stopColor="#245BFF" />
          <stop offset="0.75" stopColor="#8028FF" />
          <stop offset="1" stopColor="#ED4DF5" />
        </linearGradient>
      </defs>
      {segments.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={`url(#sg-${gid})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export interface UptimeBarDay {
  day: string;
  uptime: number | null;
  failures?: number;
}

/** Bandeau de disponibilité journalière (style « status page »). */
export function UptimeBars({ days, className }: { days: UptimeBarDay[]; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex h-9 items-stretch gap-[3px]" role="list" aria-label="Disponibilité par jour">
        {days.map((d) => {
          const tone =
            d.uptime === null
              ? "bg-surface-strong"
              : d.uptime >= 0.999
                ? "bg-success"
                : d.uptime >= 0.98
                  ? "bg-warning"
                  : "bg-danger";
          const text =
            d.uptime === null
              ? `${d.day} : donnée indisponible`
              : `${d.day} : ${(d.uptime * 100).toFixed(2).replace(".", ",")} % de disponibilité`;
          return (
            <div key={d.day} role="listitem" title={text} aria-label={text} className={cn("flex-1 rounded-[3px] transition-opacity hover:opacity-70", tone)} />
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-muted-fg">
        <span>{days[0]?.day ?? ""}</span>
        <span>{days.at(-1)?.day ?? ""}</span>
      </div>
    </div>
  );
}

export interface SeriesPoint {
  t: string;
  v: number | null;
}

/** Courbe temporelle simple (temps de réponse, prix). */
export function LineChart({
  points,
  unit,
  label,
  className,
  height = 160,
  formatValue = (v: number) => `${Math.round(v)}${unit}`,
}: {
  points: SeriesPoint[];
  unit: string;
  label: string;
  className?: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const gid = useId().replace(/:/g, "");
  const nums = points.map((p) => p.v).filter((v): v is number => v !== null);
  if (nums.length < 2) {
    return (
      <div
        className={cn("grid place-items-center rounded-lg border border-dashed border-line text-sm text-muted-fg", className)}
        style={{ height }}
      >
        Donnée indisponible
      </div>
    );
  }
  const w = 600;
  const h = height;
  const pad = { l: 44, r: 8, t: 10, b: 22 };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || Math.max(1, max * 0.1);
  const lo = Math.max(0, min - span * 0.1);
  const hi = max + span * 0.1;
  const x = (i: number) => pad.l + (i / Math.max(1, points.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b);
  let d = "";
  let pen = false;
  points.forEach((p, i) => {
    if (p.v === null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)} `;
    pen = true;
  });
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <figure className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} role="img" aria-label={label} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`lg-${gid}`} x1="0" x2="1">
            <stop offset="0" stopColor="#00E5FF" />
            <stop offset="0.4" stopColor="#245BFF" />
            <stop offset="0.75" stopColor="#8028FF" />
            <stop offset="1" stopColor="#ED4DF5" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="#E7E8EF" strokeDasharray="3 4" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6B6B79">
              {formatValue(t)}
            </text>
          </g>
        ))}
        <path d={d} fill="none" stroke={`url(#lg-${gid})`} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
