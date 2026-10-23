"use client";

import { AnimatePresence, motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { useMemo } from "react";

export type StemKind =
  | "rose"
  | "pivoine"
  | "pom"
  | "anemone"
  | "dahlia"
  | "renoncule"
  | "tulipe"
  | "lavande"
  | "muflier"
  | "eucalyptus"
  | "fougere"
  | "olivier"
  | "graminee";

export interface Stem {
  id: string; // unique par tige
  kind: StemKind;
  color: string;
}

const FOLIAGE: StemKind[] = ["eucalyptus", "fougere", "olivier", "graminee"];
const SPIKES: StemKind[] = ["lavande", "muflier"];

export function kindFromName(name: string, fallback: "fleur" | "feuillage" = "fleur"): StemKind {
  const n = name.toLowerCase();
  if (n.includes("pivoine")) return "pivoine";
  if (n.includes("rose")) return "rose";
  if (n.includes("renoncule") || n.includes("lisianthus")) return "renoncule";
  if (n.includes("anémone") || n.includes("anemone")) return "anemone";
  if (n.includes("dahlia")) return "dahlia";
  if (n.includes("tulipe")) return "tulipe";
  if (n.includes("lavande")) return "lavande";
  if (n.includes("muflier")) return "muflier";
  if (n.includes("eucalyptus")) return "eucalyptus";
  if (n.includes("fougère") || n.includes("fougere")) return "fougere";
  if (n.includes("olivier")) return "olivier";
  if (n.includes("gramin")) return "graminee";
  if (n.includes("matricaire") || n.includes("marguerite")) return "pom";
  return fallback === "feuillage" ? "olivier" : "pom";
}

function shade(hex: string, amt: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt < 0) {
    r = Math.round(r * (1 + amt));
    g = Math.round(g * (1 + amt));
    b = Math.round(b * (1 + amt));
  } else {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  }
  return `rgb(${r},${g},${b})`;
}

const SIZE: Record<StemKind, number> = {
  rose: 30,
  pivoine: 38,
  pom: 18,
  anemone: 27,
  dahlia: 31,
  renoncule: 24,
  tulipe: 22,
  lavande: 26,
  muflier: 30,
  eucalyptus: 42,
  fougere: 50,
  olivier: 40,
  graminee: 44,
};

function Petals({ n, r, rx, ry, off, fill, stroke, rot = 0 }: { n: number; r: number; rx: number; ry: number; off: number; fill: string; stroke: string; rot?: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <ellipse key={i} cx={0} cy={-off * r} rx={rx * r} ry={ry * r} fill={fill} stroke={stroke} strokeWidth={0.6} transform={`rotate(${rot + (i * 360) / n})`} />
      ))}
    </>
  );
}

/** Dessin d'une tige (centrée en 0,0). */
function Flower({ kind, color, r, angle }: { kind: StemKind; color: string; r: number; angle: number }) {
  const dark = shade(color, -0.35);
  const darker = shade(color, -0.55);
  const light = shade(color, 0.35);
  const line = "rgba(14,9,18,0.28)";
  switch (kind) {
    case "rose":
    case "pivoine": {
      const big = kind === "pivoine";
      return (
        <g>
          <Petals n={big ? 8 : 6} r={r} rx={0.5} ry={0.58} off={0.48} fill={color} stroke={line} />
          <Petals n={big ? 7 : 5} r={r} rx={0.42} ry={0.46} off={0.3} fill={light} stroke={line} rot={30} />
          <Petals n={5} r={r} rx={0.3} ry={0.32} off={0.14} fill={color} stroke={line} rot={12} />
          <circle r={r * 0.2} fill={dark} />
          <path d={`M0,${-r * 0.12} a${r * 0.12},${r * 0.12} 0 1,1 -${r * 0.1},${r * 0.14} a${r * 0.07},${r * 0.07} 0 1,1 ${r * 0.08},-${r * 0.08}`} fill="none" stroke={darker} strokeWidth={0.9} />
        </g>
      );
    }
    case "renoncule":
      return (
        <g>
          {[1, 0.82, 0.64, 0.46, 0.28].map((k, i) => (
            <circle key={i} r={r * k} fill={i % 2 ? light : color} stroke={line} strokeWidth={0.6} />
          ))}
          <circle r={r * 0.12} fill={darker} />
        </g>
      );
    case "anemone":
      return (
        <g>
          <Petals n={6} r={r} rx={0.46} ry={0.54} off={0.45} fill={color} stroke={line} />
          <circle r={r * 0.3} fill="#1A1020" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <circle key={i} cx={Math.cos(a) * r * 0.36} cy={Math.sin(a) * r * 0.36} r={1.3} fill="#2A1735" />;
          })}
        </g>
      );
    case "dahlia":
      return (
        <g>
          <Petals n={14} r={r} rx={0.17} ry={0.5} off={0.52} fill={color} stroke={line} />
          <Petals n={12} r={r} rx={0.15} ry={0.36} off={0.36} fill={light} stroke={line} rot={15} />
          <Petals n={8} r={r} rx={0.12} ry={0.22} off={0.2} fill={color} stroke={line} rot={8} />
          <circle r={r * 0.12} fill={dark} />
        </g>
      );
    case "tulipe":
      return (
        <g transform={`rotate(${angle + 90})`}>
          <path d={`M0,${r * 0.6} C${-r * 0.9},${r * 0.4} ${-r * 0.7},${-r * 0.7} ${-r * 0.25},${-r * 0.8} L0,${-r * 0.4} L${r * 0.25},${-r * 0.8} C${r * 0.7},${-r * 0.7} ${r * 0.9},${r * 0.4} 0,${r * 0.6}Z`} fill={color} stroke={line} strokeWidth={0.6} />
          <path d={`M0,${r * 0.6} C${-r * 0.3},${r * 0.2} ${-r * 0.2},${-r * 0.5} 0,${-r * 0.75} C${r * 0.2},${-r * 0.5} ${r * 0.3},${r * 0.2} 0,${r * 0.6}Z`} fill={light} opacity={0.8} />
        </g>
      );
    case "pom":
      return (
        <g>
          <Petals n={14} r={r} rx={0.15} ry={0.48} off={0.5} fill={color} stroke={line} />
          <circle r={r * 0.3} fill="#E9C46A" />
          <circle r={r * 0.3} fill="none" stroke="#C99A2E" strokeWidth={0.6} />
        </g>
      );
    case "lavande":
    case "muflier": {
      const n = kind === "lavande" ? 9 : 6;
      return (
        <g transform={`rotate(${angle + 90})`}>
          <path d={`M0,${r} L0,${-r * 1.4}`} stroke="#5E7A55" strokeWidth={1} />
          {Array.from({ length: n }).map((_, i) => {
            const y = r * 0.6 - (i * r * 2) / n;
            const s = kind === "lavande" ? 0.13 : 0.22;
            return (
              <g key={i}>
                <ellipse cx={-r * 0.1} cy={y} rx={r * s} ry={r * s * 1.4} fill={i % 2 ? color : dark} transform={`rotate(-25 ${-r * 0.1} ${y})`} />
                <ellipse cx={r * 0.1} cy={y - r * 0.08} rx={r * s} ry={r * s * 1.4} fill={i % 2 ? light : color} transform={`rotate(25 ${r * 0.1} ${y - r * 0.08})`} />
              </g>
            );
          })}
        </g>
      );
    }
    case "eucalyptus":
    case "olivier":
    case "fougere":
    case "graminee": {
      const leaves = kind === "fougere" ? 12 : kind === "graminee" ? 0 : 7;
      return (
        <g transform={`rotate(${angle + 90})`}>
          <path d={`M0,${r * 0.6} Q${r * 0.12},0 0,${-r}`} stroke={kind === "graminee" ? "#B89A6A" : "#4E6B45"} strokeWidth={1.1} fill="none" />
          {kind === "graminee" &&
            [-0.35, 0, 0.35].map((o, i) => (
              <g key={i} transform={`rotate(${o * 40})`}>
                <path d={`M0,${r * 0.4} Q${r * 0.1},${-r * 0.2} 0,${-r * 0.9}`} stroke="#C9AE7E" strokeWidth={0.8} fill="none" />
                <ellipse cx={0} cy={-r * 0.95} rx={r * 0.07} ry={r * 0.2} fill={color} />
              </g>
            ))}
          {Array.from({ length: leaves }).map((_, i) => {
            const t = i / leaves;
            const y = r * 0.45 - t * r * 1.35;
            const side = i % 2 ? 1 : -1;
            if (kind === "eucalyptus")
              return <circle key={i} cx={side * r * 0.16} cy={y} r={r * (0.17 - t * 0.05)} fill={i % 3 ? color : shade(color, -0.15)} stroke={line} strokeWidth={0.5} />;
            const len = kind === "fougere" ? r * (0.38 - t * 0.25) : r * 0.32;
            const w = kind === "fougere" ? len * 0.28 : len * 0.22;
            return (
              <path
                key={i}
                d={`M0,${y} q${side * len * 0.5},${-w} ${side * len},${-len * 0.25} q${-side * len * 0.5},${w * 1.4} ${-side * len},${len * 0.25}Z`}
                fill={kind === "fougere" ? (i % 2 ? color : shade(color, 0.15)) : color}
                stroke={line}
                strokeWidth={0.4}
              />
            );
          })}
        </g>
      );
    }
  }
}

/** Positionne les tiges en dôme (spirale dorée), feuillages en périphérie. */
function layout(stems: Stem[]) {
  const foliage = stems.filter((s) => FOLIAGE.includes(s.kind));
  const spikes = stems.filter((s) => SPIKES.includes(s.kind));
  const blooms = stems.filter((s) => !FOLIAGE.includes(s.kind) && !SPIKES.includes(s.kind));
  const cx = 200;
  const cy = 188;
  const out: { stem: Stem; x: number; y: number; r: number; angle: number; z: number }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spread = blooms.length > 14 ? 17 : 20;
  blooms.forEach((s, i) => {
    const rr = spread * Math.sqrt(i + 0.6);
    const a = i * golden - Math.PI / 2;
    const x = cx + Math.cos(a) * rr * 1.18;
    const y = cy + Math.sin(a) * rr * 0.86;
    out.push({ stem: s, x, y, r: SIZE[s.kind] * 1.22, angle: (Math.atan2(y - cy, x - cx) * 180) / Math.PI, z: 10 + (y - cy) / 10 });
  });
  const ring = [...spikes, ...foliage];
  const outer = Math.max(70, spread * Math.sqrt(blooms.length + 1) * 1.05);
  ring.forEach((s, i) => {
    // éventail sur l'arc supérieur (de -170° à -10°) puis côtés
    const t = ring.length === 1 ? 0.5 : i / (ring.length - 1);
    const a = (-168 + t * 156) * (Math.PI / 180) + (i % 2 ? 0.08 : -0.08);
    const rr = outer + (FOLIAGE.includes(s.kind) ? 18 : 8);
    const x = cx + Math.cos(a) * rr * 1.1;
    const y = cy + Math.sin(a) * rr * 0.9 + 14;
    out.push({ stem: s, x, y, r: SIZE[s.kind] * 1.2, angle: (a * 180) / Math.PI, z: FOLIAGE.includes(s.kind) ? 0 : 5 });
  });
  return out.sort((a, b) => a.z - b.z);
}

function Wrap({ color, isVase }: { color: string; isVase: boolean }) {
  if (isVase)
    return (
      <g>
        <path d="M140,300 C110,340 112,420 150,446 L250,446 C288,420 290,340 260,300 Q200,286 140,300Z" fill="rgba(220,230,232,0.22)" stroke="rgba(246,241,234,0.55)" strokeWidth={1.4} />
        <path d="M150,320 C136,350 138,400 160,430" stroke="rgba(255,255,255,0.5)" strokeWidth={3} fill="none" strokeLinecap="round" />
        <path d="M120,392 Q200,408 280,392" stroke="rgba(110,160,180,0.35)" strokeWidth={1} fill="none" />
      </g>
    );
  const back = shade(color, -0.25);
  const fold = shade(color, -0.12);
  const front = color;
  return (
    <g>
      <path d="M116,270 L200,452 L284,270 Q200,306 116,270Z" fill={front} />
      <path d="M116,270 L200,452 L168,290Z" fill={fold} />
      <path d="M284,270 L200,452 L240,292Z" fill={back} opacity={0.6} />
      <path d="M150,346 Q200,366 250,346" stroke="#C6A15B" strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d="M200,354 q-24,-22 -40,-6 q16,18 40,6 q24,-22 40,-6 q-16,18 -40,6" fill="#C6A15B" />
      <path d="M200,356 q-10,26 -26,46 M200,356 q12,26 24,48" stroke="#C6A15B" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </g>
  );
}

function BackPaper({ color, isVase }: { color: string; isVase: boolean }) {
  if (isVase) return null;
  return <path d="M88,232 Q120,196 160,214 L200,452 L240,214 Q280,196 312,232 L284,270 Q200,306 116,270Z" fill={shade(color, -0.3)} />;
}

function StaticBloom({ item }: { item: ReturnType<typeof layout>[number] }) {
  return (
    <motion.g
      initial={{ scale: 0, rotate: -50, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 160, damping: 13 }}
      style={{ x: item.x, y: item.y }}
    >
      <Flower kind={item.stem.kind} color={item.stem.color} r={item.r} angle={item.angle} />
    </motion.g>
  );
}

function ScrollBloom({ item, i, total, progress }: { item: ReturnType<typeof layout>[number]; i: number; total: number; progress: MotionValue<number> }) {
  const start = 0.05 + (i / Math.max(1, total)) * 0.55;
  const scale = useTransform(progress, [start, start + 0.14], [0, 1]);
  const rotate = useTransform(progress, [start, start + 0.2], [-60, 0]);
  return (
    <motion.g style={{ x: item.x, y: item.y, scale, rotate }}>
      <Flower kind={item.stem.kind} color={item.stem.color} r={item.r} angle={item.angle} />
    </motion.g>
  );
}

/** Bouquet illustré : utilisé par l'atelier (ajout en direct) et l'accueil (éclosion au défilement). */
export function BouquetArt({
  stems,
  wrapColor = "#C9A27A",
  isVase = false,
  progress,
  className,
}: {
  stems: Stem[];
  wrapColor?: string;
  isVase?: boolean;
  progress?: MotionValue<number>;
  className?: string;
}) {
  const items = useMemo(() => layout(stems), [stems]);
  const fallback = useMotionValue(1);
  const wrapY = useTransform(progress ?? fallback, [0.55, 0.9], [60, 0]);
  return (
    <svg viewBox="0 0 400 470" className={className} aria-hidden>
      <BackPaper color={wrapColor} isVase={isVase} />
      <g opacity={0.9}>
        {items.map((it) => (
          <motion.line
            key={`s-${it.stem.id}`}
            x1={it.x}
            y1={it.y}
            x2={200 + (it.x - 200) * 0.12}
            y2={isVase ? 430 : 300}
            stroke="#4E6B45"
            strokeWidth={1.4}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6 }}
          />
        ))}
      </g>
      {progress ? (
        items.map((it, i) => <ScrollBloom key={it.stem.id} item={it} i={i} total={items.length} progress={progress} />)
      ) : (
        <AnimatePresence>
          {items.map((it) => (
            <StaticBloom key={it.stem.id} item={it} />
          ))}
        </AnimatePresence>
      )}
      {progress ? (
        <motion.g style={{ y: wrapY }}>
          <Wrap color={wrapColor} isVase={isVase} />
        </motion.g>
      ) : (
        <motion.g key={`${wrapColor}-${isVase}`} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <Wrap color={wrapColor} isVase={isVase} />
        </motion.g>
      )}
    </svg>
  );
}

export const TEASER_STEMS: Stem[] = [
  { id: "t1", kind: "pivoine", color: "#E7A1B0" },
  { id: "t2", kind: "rose", color: "#7A2340" },
  { id: "t3", kind: "anemone", color: "#F6F1EA" },
  { id: "t4", kind: "renoncule", color: "#F2A07B" },
  { id: "t5", kind: "rose", color: "#F4DCE0" },
  { id: "t6", kind: "dahlia", color: "#C4407C" },
  { id: "t7", kind: "pom", color: "#FFFFFF" },
  { id: "t8", kind: "renoncule", color: "#B9A2CF" },
  { id: "t9", kind: "rose", color: "#E7A1B0" },
  { id: "t10", kind: "anemone", color: "#E9D7F0" },
  { id: "t11", kind: "pom", color: "#FFFFFF" },
  { id: "t12", kind: "tulipe", color: "#E86A92" },
  { id: "t13", kind: "lavande", color: "#8C6BB1" },
  { id: "t14", kind: "lavande", color: "#8C6BB1" },
  { id: "t15", kind: "eucalyptus", color: "#9DB0A0" },
  { id: "t16", kind: "fougere", color: "#3E6B35" },
  { id: "t17", kind: "muflier", color: "#F2D0A9" },
  { id: "t18", kind: "fougere", color: "#3E6B35" },
  { id: "t19", kind: "eucalyptus", color: "#9DB0A0" },
  { id: "t20", kind: "graminee", color: "#D8B98E" },
  { id: "t21", kind: "olivier", color: "#8A9A7B" },
];
