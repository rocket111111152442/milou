"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { SectionTitle } from "@/components/site/SectionTitle";
import { SmartImage } from "@/components/site/SmartImage";
import { StarGlyph } from "@/components/site/Social";
import { euro } from "@/lib/format";
import type { CardProduct } from "@/components/site/ProductCard";

// Constellation imaginaire de la Maison (coordonnées en %)
const POINTS = [
  [12, 62],
  [24, 38],
  [38, 52],
  [50, 24],
  [62, 46],
  [74, 30],
  [86, 58],
  [66, 76],
  [44, 80],
];
const LINKS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [4, 7],
  [7, 8],
  [8, 2],
];

function seeded(n: number) {
  let a = 7;
  return Array.from({ length: n }, () => {
    a = (a * 9301 + 49297) % 233280;
    const x = a / 233280;
    a = (a * 9301 + 49297) % 233280;
    const y = a / 233280;
    a = (a * 9301 + 49297) % 233280;
    return { x: x * 100, y: y * 100, s: 0.5 + (a / 233280) * 1.6, d: (a / 233280) * 4 };
  });
}

export function Constellation({ products }: { products: CardProduct[] }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "center 0.5"] });
  const draw = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const bgY = useTransform(scrollYProgress, [0, 1], ["-8%", "0%"]);
  const stars = useMemo(() => seeded(90), []);
  const items = products.filter((p) => p.star).slice(0, POINTS.length);
  const [active, setActive] = useState(0);
  const current = items[active];

  return (
    <section ref={ref} className="relative overflow-hidden bg-ink py-28 sm:py-36">
      <motion.div className="absolute inset-0 opacity-50" style={{ y: bgY }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(110,79,140,0.45),transparent_60%),radial-gradient(ellipse_at_80%_80%,rgba(58,35,80,0.6),transparent_60%)]" />
        {stars.map((s, i) => (
          <span
            key={i}
            className="absolute animate-twinkle rounded-full bg-ivory"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s` }}
          />
        ))}
      </motion.div>

      <div className="relative mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-16">
        <SectionTitle eyebrow="La collection Constellations" title="Chaque bouquet porte" accent="le nom d'une étoile" align="center" />
        <p className="mx-auto mt-6 max-w-xl text-center text-ivory/60">Andromeda, Orion, Polaris… Survolez le ciel de la Maison et laissez une étoile vous guider vers votre bouquet.</p>

        <div className="mt-16 grid items-center gap-12 lg:grid-cols-[1.5fr_1fr]">
          <div className="relative aspect-[16/10] w-full">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
              {LINKS.map(([a, b], i) =>
                items[a] && items[b] ? (
                  <motion.line
                    key={i}
                    x1={POINTS[a][0]}
                    y1={POINTS[a][1]}
                    x2={POINTS[b][0]}
                    y2={POINTS[b][1]}
                    stroke="url(#cst)"
                    strokeWidth={0.18}
                    vectorEffect="non-scaling-stroke"
                    style={{ pathLength: draw }}
                  />
                ) : null,
              )}
              <defs>
                <linearGradient id="cst" x1="0" x2="1">
                  <stop offset="0" stopColor="#C6A15B" stopOpacity="0.9" />
                  <stop offset="1" stopColor="#B9A2CF" stopOpacity="0.6" />
                </linearGradient>
              </defs>
            </svg>
            {items.map((p, i) => (
              <button
                key={p.id}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${POINTS[i][0]}%`, top: `${POINTS[i][1]}%` }}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                aria-label={`${p.name} — ${p.star}`}
                data-cursor="link"
              >
                <motion.span
                  className="relative flex h-10 w-10 items-center justify-center"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.3 + i * 0.08 }}
                >
                  <span className={`absolute inset-0 rounded-full bg-gold/30 blur-md transition ${active === i ? "scale-150 opacity-100" : "scale-75 opacity-0"}`} />
                  <StarGlyph className={`relative transition duration-500 ${active === i ? "h-7 w-7 text-gold-light" : "h-4 w-4 text-ivory/80 group-hover:text-gold"}`} />
                </motion.span>
                <span
                  className={`pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap font-caps text-[0.55rem] uppercase tracking-[0.25em] transition ${active === i ? "text-gold-light" : "text-ivory/45"}`}
                >
                  {p.name}
                </span>
              </button>
            ))}
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <AnimatePresence mode="wait">
              {current && (
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 30, rotate: -2 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  exit={{ opacity: 0, y: -20, rotate: 2 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link href={`/boutique/${current.slug}`} className="group block" data-cursor="view">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-t-full border border-gold/30 p-2">
                      <div className="relative h-full w-full overflow-hidden rounded-t-full">
                        <SmartImage src={current.images[0]} alt={current.name} fill sizes="380px" className="object-cover transition duration-[1.4s] group-hover:scale-110" />
                      </div>
                    </div>
                    <p className="mt-5 flex items-center gap-2 font-caps text-[0.6rem] uppercase tracking-[0.3em] text-gold">
                      <StarGlyph className="h-2.5 w-2.5" /> {current.star}
                    </p>
                    <div className="mt-2 flex items-baseline justify-between">
                      <h3 className="font-display text-4xl">{current.name}</h3>
                      <span className="font-display text-2xl">dès {euro(current.variants[0]?.price ?? current.price, { compact: true })}</span>
                    </div>
                    <p className="mt-1 text-sm text-ivory/55">{current.subtitle}</p>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
