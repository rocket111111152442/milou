"use client";

import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PLATE_NAMES, type PlateName } from "@/lib/plates";
import { Plate } from "./Plate";

type Item = { plate: PlateName; top: number; side: "l" | "r" | "c"; x: number; w: number; rot: number; op: number; depth: number; dur: number; delay: number; flip: boolean };

// générateur pseudo-aléatoire stable (même disposition à chaque visite d'une page)
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)), (s >>>= 0) / 4294967296);
}
const hash = (t: string) => [...t].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

function layout(height: number, width: number, seed: string, startAt: number): Item[] {
  const r = rng(hash(seed));
  const mobile = width < 768;
  const step = mobile ? 380 : 290;
  const items: Item[] = [];
  let side: "l" | "r" = r() > 0.5 ? "l" : "r";
  for (let top = startAt; top < height - 200; top += step * (0.75 + r() * 0.5)) {
    const w = mobile ? 140 + r() * 70 : 200 + r() * 170;
    items.push({
      plate: PLATE_NAMES[Math.floor(r() * PLATE_NAMES.length)],
      top,
      side,
      // la gravure déborde de la marge : pleinement visible sur le bord, effacée vers le texte
      x: -(0.18 + r() * 0.3) * w,
      w,
      rot: (side === "l" ? -1 : 1) * (4 + r() * 14),
      op: mobile ? 0.28 + r() * 0.14 : 0.42 + r() * 0.3,
      depth: 40 + r() * 140,
      dur: 6 + r() * 6,
      delay: r() * 3,
      flip: side === "r",
    });
    // de temps en temps, une petite gravure de l'autre côté
    if (r() > (mobile ? 0.6 : 0.2)) {
      const w2 = 110 + r() * 90;
      items.push({ plate: PLATE_NAMES[Math.floor(r() * PLATE_NAMES.length)], top: top + step * 0.45, side: side === "l" ? "r" : "l", x: -(0.1 + r() * 0.25) * w2, w: w2, rot: (side === "l" ? 1 : -1) * (6 + r() * 16), op: 0.3 + r() * 0.2, depth: 20 + r() * 80, dur: 5 + r() * 5, delay: r() * 2, flip: side === "l" });
    }
    // et, plus pâle, une gravure qui flotte en plein papier, derrière le contenu
    if (r() > 0.55) {
      const w3 = mobile ? 120 + r() * 60 : 160 + r() * 140;
      items.push({ plate: PLATE_NAMES[Math.floor(r() * PLATE_NAMES.length)], top: top + step * (0.2 + r() * 0.5), side: "c", x: (0.15 + r() * 0.7) * width - w3 / 2, w: w3, rot: -20 + r() * 40, op: 0.1 + r() * 0.08, depth: 60 + r() * 160, dur: 8 + r() * 6, delay: r() * 3, flip: r() > 0.5 });
    }
    side = side === "l" ? "r" : "l";
  }
  return items;
}

/**
 * Herbier de fond : des gravures disséminées sur tout le papier de la page,
 * qui s'encrent à l'arrivée, se balancent doucement et glissent en parallaxe.
 */
export function Botanica() {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [items, setItems] = useState<Item[]>([]);
  const { scrollY } = useScroll();

  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const build = () => setItems(layout(el.scrollHeight, window.innerWidth, pathname, pathname === "/" ? window.innerHeight * 0.9 : 140));
    build();
    const ro = new ResizeObserver(() => build());
    ro.observe(el);
    return () => ro.disconnect();
  }, [pathname]);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {items.map((it, i) => (
        <Sprig key={`${pathname}-${i}`} it={it} scrollY={scrollY} />
      ))}
    </div>
  );
}

function Sprig({ it, scrollY }: { it: Item; scrollY: MotionValue<number> }) {
  const y = useTransform(scrollY, (v) => -((v - it.top) / 1000) * it.depth);
  return (
    <motion.div className="absolute text-plum will-change-transform" style={{ top: it.top, [it.side === "r" ? "right" : "left"]: it.x, width: it.w, y }}>
      <motion.div
        style={{ transformOrigin: "50% 100%" }}
        initial={{ rotate: it.rot }}
        animate={{ rotate: [it.rot - 3, it.rot + 3, it.rot - 3], y: [0, -14, 0] }}
        transition={{ duration: it.dur, delay: it.delay, repeat: Infinity, ease: "easeInOut" }}
      >
        <Plate name={it.plate} flip={it.flip} opacity={it.op} duration={2.4} />
      </motion.div>
    </motion.div>
  );
}
