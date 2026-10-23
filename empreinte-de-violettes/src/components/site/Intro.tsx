"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useScrollLock } from "@/components/motion/SmoothScroll";
import { useUI } from "@/store/ui";

const EASE = [0.22, 1, 0.36, 1] as const;
const CURTAIN = [0.77, 0, 0.18, 1] as const;
const EXIT_AT = 3400; // durée minimale avant la sortie (≈ 5 s au total avec le rideau)

// ---------- géométrie (calculée une fois) ----------
const petal = (l: number, w: number) =>
  `M0,0C${w * 0.7},${-l * 0.1} ${w * 1.15},${-l * 0.92} 0,${-l}C${-w * 1.15},${-l * 0.92} ${-w * 0.7},${-l * 0.1} 0,0Z`;

const PETALS = [
  { a: -24, l: 74, w: 25 },
  { a: 24, l: 74, w: 25 },
  { a: -94, l: 62, w: 23 },
  { a: 94, l: 62, w: 23 },
  { a: 180, l: 70, w: 31 },
];

type Leaf = { x: number; y: number; a: number; l: number; i: number };

function frond(p0: [number, number], c: [number, number], p1: [number, number]) {
  const at = (t: number): [number, number] => [
    (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t ** 2 * p1[0],
    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t ** 2 * p1[1],
  ];
  const tan = (t: number) => {
    const dx = 2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]);
    const dy = 2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]);
    return Math.atan2(dy, dx);
  };
  const leaves: Leaf[] = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const t = 0.07 + (0.86 * i) / n;
    const [x, y] = at(t);
    const side = i % 2 ? 1 : -1;
    leaves.push({ x, y, a: ((tan(t) + side * 0.95) * 180) / Math.PI, l: 26 * (1 - t * 0.72), i });
  }
  // crosse finale
  const end = at(1);
  const ta = tan(1);
  let spiral = "";
  for (let k = 0; k <= 50; k++) {
    const th = (k / 50) * Math.PI * 4.2;
    const r = 11 * Math.exp(-0.24 * th);
    const lx = Math.cos(th) * r - 11;
    const ly = Math.sin(th) * r;
    const x = end[0] + lx * Math.cos(ta + Math.PI) - ly * Math.sin(ta + Math.PI);
    const y = end[1] + lx * Math.sin(ta + Math.PI) + ly * Math.cos(ta + Math.PI);
    spiral += (k ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
  }
  return { rachis: `M${p0[0]},${p0[1]}Q${c[0]},${c[1]} ${p1[0]},${p1[1]}`, leaves, spiral };
}

const LEFT = frond([300, 186], [180, 250], [72, 200]);
const RIGHT = frond([300, 186], [420, 250], [528, 200]);
const leafPath = (l: number) => `M0,0Q${l * 0.45},${-l * 0.3} ${l},0Q${l * 0.45},${l * 0.3} 0,0ZM0,0L${l * 0.82},0`;

const SPARKS = [
  [120, 70, 0.2],
  [480, 60, 0.6],
  [70, 140, 1.1],
  [540, 130, 0.9],
  [200, 30, 1.4],
  [410, 24, 0.4],
  [300, 250, 1.7],
];

function Sparkle({ x, y, d }: { x: number; y: number; d: number }) {
  return (
    <motion.path
      d={`M${x},${y - 6}Q${x + 0.8},${y - 0.8} ${x + 6},${y}Q${x + 0.8},${y + 0.8} ${x},${y + 6}Q${x - 0.8},${y + 0.8} ${x - 6},${y}Q${x - 0.8},${y - 0.8} ${x},${y - 6}Z`}
      fill="url(#ev-foil)"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: [0, 1, 0.3, 1, 0], scale: [0, 1, 0.7, 1, 0] }}
      transition={{ duration: 2.6, delay: 0.8 + d, ease: "easeInOut" }}
      style={{ originX: 0.5, originY: 0.5 }}
    />
  );
}

function Letters({ text, delay, className, onDone }: { text: string; delay: number; className?: string; onDone?: () => void }) {
  const chars = text.split("");
  return (
    <span className={className} aria-hidden>
      {chars.map((c, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.1em] align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "120%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            transition={{ duration: 0.9, ease: EASE, delay: delay + i * 0.035 }}
            onAnimationComplete={i === chars.length - 1 ? onDone : undefined}
          >
            {c === " " ? " " : c}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Introduction en motion design (5 s) : la violette se dessine, les fougères se déroulent, le nom apparaît en feuille d'or. */
export function Intro({ enabled, oncePerSession }: { enabled: boolean; oncePerSession: boolean }) {
  const setIntroDone = useUI((s) => s.setIntroDone);
  const [phase, setPhase] = useState<"idle" | "play" | "exit" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [nameDone, setNameDone] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useScrollLock(phase === "play");

  useEffect(() => {
    const seen = document.documentElement.dataset.intro === "seen";
    if (!enabled || (oncePerSession && seen)) {
      setPhase("done");
      setIntroDone();
      return;
    }
    try {
      sessionStorage.setItem("ev-intro", "1");
    } catch {}
    setPhase("play");
    const exitAt = reduced ? 900 : EXIT_AT;
    // la sortie attend à la fois la durée minimale et la fin réelle du nom (appareils lents)
    const t1 = setTimeout(() => setMinElapsed(true), exitAt);
    const fallback = setTimeout(() => setNameDone(true), 7000);
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / exitAt);
      setProgress(Math.round(p * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      clearTimeout(t1);
      clearTimeout(fallback);
      cancelAnimationFrame(raf);
    };
  }, [enabled, oncePerSession, reduced, setIntroDone]);

  useEffect(() => {
    if (phase !== "play" || !minElapsed || !(nameDone || reduced)) return;
    const hold = setTimeout(() => {
      setPhase("exit");
      setIntroDone();
    }, reduced ? 0 : 300);
    const end = setTimeout(() => setPhase("done"), reduced ? 600 : 1500);
    return () => {
      clearTimeout(hold);
      clearTimeout(end);
    };
  }, [phase, minElapsed, nameDone, reduced, setIntroDone]);

  const skip = () => {
    setPhase("exit");
    setIntroDone();
    setTimeout(() => setPhase("done"), 1100);
  };

  if (!enabled || phase === "done") return null;

  return (
    <div id="ev-intro" className="fixed inset-0 z-[150]" role="presentation">
      {/* rideau violet (arrière) */}
      <motion.div
        className="absolute inset-0 bg-aubergine-700"
        initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
        animate={phase === "exit" ? { clipPath: "inset(0% 0% 100% 0%)" } : {}}
        transition={{ duration: 1, ease: CURTAIN, delay: 0.14 }}
      />
      {/* scène principale */}
      <motion.div
        className="fern-night absolute inset-0 overflow-hidden bg-noir"
        initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
        animate={phase === "exit" ? { clipPath: "inset(0% 0% 100% 0%)" } : {}}
        transition={{ duration: 1, ease: CURTAIN }}
      >
        <motion.div
          className="absolute left-1/2 top-1/2 h-[90vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(110,79,140,0.45) 0%, rgba(58,35,80,0.18) 40%, transparent 70%)" }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 3, ease: EASE }}
        />

        <motion.div
          className="relative flex h-full flex-col items-center justify-center px-6"
          animate={phase === "exit" ? { y: -60, opacity: 0, filter: "blur(6px)", scale: 1.04 } : {}}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <svg viewBox="0 0 600 270" className="w-[min(620px,92vw)] overflow-visible" aria-hidden>
            <defs>
              <linearGradient id="ev-foil" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#8E6A2E" />
                <stop offset="0.3" stopColor="#F3E4BB" />
                <stop offset="0.55" stopColor="#B8913F" />
                <stop offset="0.8" stopColor="#EEDCAE" />
                <stop offset="1" stopColor="#9B7634" />
              </linearGradient>
              <radialGradient id="ev-petal" cx="0.5" cy="0.9" r="0.9">
                <stop offset="0" stopColor="#6E4F8C" />
                <stop offset="1" stopColor="#26152F" />
              </radialGradient>
            </defs>

            {/* fougères */}
            {[LEFT, RIGHT].map((f, k) => (
              <g key={k}>
                <motion.path
                  d={f.rachis}
                  fill="none"
                  stroke="url(#ev-foil)"
                  strokeWidth={1.2}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, ease: EASE, delay: 0.55 }}
                />
                {f.leaves.map((l) => (
                  <g key={l.i} transform={`translate(${l.x.toFixed(1)},${l.y.toFixed(1)}) rotate(${l.a.toFixed(1)})`}>
                    <motion.path
                      d={leafPath(l.l)}
                      fill="rgba(110,79,140,0.18)"
                      stroke="url(#ev-foil)"
                      strokeWidth={0.8}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      style={{ originX: 0, originY: 0.5 }}
                      transition={{ duration: 0.7, ease: EASE, delay: 0.75 + l.i * 0.055 }}
                    />
                  </g>
                ))}
                <motion.path
                  d={f.spiral}
                  fill="none"
                  stroke="url(#ev-foil)"
                  strokeWidth={1}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1, ease: EASE, delay: 1.7 }}
                />
              </g>
            ))}

            {/* tige */}
            <motion.path
              d="M300,190 C298,170 302,150 300,128"
              stroke="url(#ev-foil)"
              strokeWidth={1.2}
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
            />

            {/* violette */}
            <g transform="translate(300,112)">
              {PETALS.map((p, i) => (
                <g key={i} transform={`rotate(${p.a})`}>
                  <motion.path
                    d={petal(p.l, p.w)}
                    fill="url(#ev-petal)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.2, delay: 1.45 + i * 0.08 }}
                  />
                  <motion.path
                    d={petal(p.l, p.w)}
                    fill="none"
                    stroke="url(#ev-foil)"
                    strokeWidth={1.3}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.3, ease: EASE, delay: 0.35 + i * 0.13 }}
                  />
                </g>
              ))}
              {[-2, -1, 0, 1, 2].map((s) => (
                <motion.path
                  key={s}
                  d={`M${s * 4},10 L${s * 7},${36 - Math.abs(s) * 6}`}
                  stroke="url(#ev-foil)"
                  strokeWidth={0.8}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 1.9 + (s + 2) * 0.06 }}
                />
              ))}
              <motion.circle
                r={6.5}
                fill="url(#ev-foil)"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.4, 1] }}
                transition={{ duration: 0.8, delay: 1.6, ease: EASE }}
              />
            </g>

            {SPARKS.map(([x, y, d], i) => (
              <Sparkle key={i} x={x} y={y} d={d} />
            ))}
          </svg>

          <div className="mt-2 flex flex-col items-center text-center">
            <motion.span
              className="font-caps text-[0.7rem] uppercase text-gold-light/80"
              initial={{ opacity: 0, letterSpacing: "1.4em" }}
              animate={{ opacity: 1, letterSpacing: "0.6em" }}
              transition={{ duration: 1.6, ease: EASE, delay: 1.45 }}
            >
              Maison
            </motion.span>
            <h1 className="text-foil mt-3 font-caps text-[clamp(1.5rem,4.6vw,3.2rem)] uppercase leading-none tracking-[0.12em]">
              <Letters text="Empreinte de Violettes" delay={1.75} onDone={() => setNameDone(true)} />
            </h1>
            <motion.span
              className="mt-5 block h-px w-40 bg-gradient-to-r from-transparent via-gold to-transparent"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.1, ease: EASE, delay: 2.5 }}
            />
            <motion.span
              className="mt-4 font-caps text-[0.62rem] uppercase tracking-[0.5em] text-aubergine-300"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: EASE, delay: 2.75 }}
            >
              Artisane fleuriste · Six-Fours-les-Plages
            </motion.span>
          </div>
        </motion.div>

        {/* compteur & passer */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6 sm:p-10">
          <div className="flex items-center gap-4">
            <span className="font-display text-4xl tabular-nums text-ivory/80 sm:text-5xl">{String(progress).padStart(3, "0")}</span>
            <span className="relative h-px w-24 overflow-hidden bg-ivory/15 sm:w-40">
              <span className="absolute inset-y-0 left-0 bg-gold" style={{ width: `${progress}%` }} />
            </span>
          </div>
          <button
            onClick={skip}
            className="font-caps text-[0.6rem] uppercase tracking-[0.3em] text-ivory/60 transition hover:text-gold"
          >
            Passer l&apos;intro
          </button>
        </div>
      </motion.div>
    </div>
  );
}
