"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { EASE, RunningHead, roman, Words } from "../Elements";

type Letter = { id: string; author: string; text: string; source: string };

/** Les avis, présentés comme des lettres posées l'une sur l'autre. */
export function Lettres({ reviews, rating, count, numeral = "VII" }: { reviews: Letter[]; rating: number; count: number; numeral?: string }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const n = reviews.length;
  const go = (d: number) => {
    setDir(d);
    setI((x) => (x + d + n) % n);
  };
  useEffect(() => {
    if (paused || n < 2) return;
    const t = setTimeout(() => go(1), 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, paused, n]);
  if (!n) return null;
  const r = reviews[i];

  return (
    <section className="h-paper-deep overflow-hidden py-24 sm:py-32">
      <div className="wrap">
        <RunningHead left="Lettres reçues" right={numeral} />
        <div className="mt-14 grid items-center gap-16 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <h2 className="h-section">
              <Words text="Ce que l'on" /> <em><Words text="nous écrit" delay={0.1} /></em>
            </h2>
            <p className="mt-8 font-display text-[3.2rem] leading-none">
              {rating.toLocaleString("fr-FR")}
              <span className="font-text text-[1.1rem] italic text-ink-muted"> / 5</span>
            </p>
            <p className="mt-2 font-text text-[1rem] italic text-ink-muted">sur {count} avis Google, et autant de mariages racontés.</p>
            <div className="mt-10 flex items-center gap-6 font-text text-[1rem]">
              <button onClick={() => go(-1)} className="ulink" aria-label="Lettre précédente">
                ← précédente
              </button>
              <span className="tab text-[0.9rem] text-ink-muted" aria-live="polite">
                {roman(i + 1)} / {roman(n)}
              </span>
              <button onClick={() => go(1)} className="ulink" aria-label="Lettre suivante">
                suivante →
              </button>
            </div>
          </div>

          <div className="relative lg:col-span-7 lg:col-start-6" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <div className="relative mx-auto min-h-[340px] max-w-[640px] sm:min-h-[380px]">
              <div className="sheet absolute inset-0 translate-x-3 translate-y-3 rotate-[2.2deg] opacity-70" aria-hidden />
              <div className="sheet absolute inset-0 -translate-x-2 translate-y-1.5 -rotate-[1.4deg] opacity-85" aria-hidden />
              <AnimatePresence initial={false} custom={dir} mode="popLayout">
                <motion.figure
                  key={r.id}
                  custom={dir}
                  className="sheet absolute inset-0 flex flex-col justify-between p-8 sm:p-12"
                  initial={{ opacity: 0, y: 24, rotate: dir * 1.2 }}
                  animate={{ opacity: 1, y: 0, rotate: -0.4 }}
                  exit={{ opacity: 0, x: dir * -80, y: -30, rotate: dir * -6, transition: { duration: 0.6, ease: EASE } }}
                  transition={{ duration: 0.9, ease: EASE }}
                >
                  <p className="folio text-ink-muted">
                    Lettre {roman(i + 1)} · {r.source}
                  </p>
                  <blockquote className="my-8 font-display text-[clamp(1.5rem,2.8vw,2.3rem)] italic leading-[1.22]">« {r.text} »</blockquote>
                  <figcaption className="flex items-baseline font-text text-[1rem]">
                    <span className="leader !ml-0" />
                    <span className="italic">{r.author}</span>
                  </figcaption>
                </motion.figure>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
