import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Napperon de dentelle en papier, dessiné en SVG : bord festonné, couronnes de jours
 * (trous découpés), pétales ajourés et rosace centrale. La couleur suit `color`.
 */
export function Doily({ className, scallops = 36, color = "#fffaf0", style }: { className?: string; scallops?: number; color?: string; style?: React.CSSProperties }) {
  const id = useId().replace(/:/g, "");
  const R = 100;
  // bord festonné : r(θ) = R − a·(1 − |sin(nθ/2)|)
  const edge = (radius: number, depth: number, n: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 720; i++) {
      const t = (i / 720) * Math.PI * 2;
      const r = radius - depth * (1 - Math.abs(Math.sin((n * t) / 2)));
      pts.push(`${(r * Math.cos(t)).toFixed(2)},${(r * Math.sin(t)).toFixed(2)}`);
    }
    return `M${pts.join("L")}Z`;
  };
  const ring = (radius: number, count: number, size: number, offset = 0) =>
    Array.from({ length: count }, (_, i) => {
      const t = ((i + offset) / count) * Math.PI * 2;
      return <circle key={`${radius}-${i}`} cx={radius * Math.cos(t)} cy={radius * Math.sin(t)} r={size} />;
    });
  const petals = (radius: number, count: number, len: number, w: number) =>
    Array.from({ length: count }, (_, i) => (
      <ellipse key={`p${radius}-${i}`} cx={0} cy={-radius} rx={w} ry={len} transform={`rotate(${(i / count) * 360})`} />
    ));
  return (
    <svg viewBox="-102 -102 204 204" className={cn("block", className)} style={style} aria-hidden>
      <defs>
        <mask id={`m${id}`}>
          <path d={edge(R, 6, scallops)} fill="#fff" />
          <g fill="#000">
            {ring(R - 9, scallops, 1.9, 0.5)}
            {ring(R - 16, scallops, 1.1)}
            {petals(R - 30, 24, 7.5, 2.2)}
            {ring(R - 42, 36, 1.4, 0.5)}
            {ring(R - 48, 18, 2.6)}
            {petals(R - 62, 16, 6, 2)}
            {ring(R - 74, 16, 1.3, 0.5)}
            {petals(R - 86, 8, 5, 2.4)}
            <circle r={3} />
          </g>
          <g fill="none" stroke="#000" strokeWidth={0.7}>
            <path d={edge(R - 21, 2.5, scallops)} />
            <circle r={R - 55} />
            <path d={edge(R - 68, 2, 16)} />
          </g>
        </mask>
      </defs>
      <rect x={-102} y={-102} width={204} height={204} fill={color} mask={`url(#m${id})`} />
    </svg>
  );
}
