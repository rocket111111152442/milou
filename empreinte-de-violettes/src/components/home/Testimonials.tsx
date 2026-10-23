"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionTitle } from "@/components/site/SectionTitle";
import type { Review } from "@/lib/types";

export function Testimonials({ reviews, rating, count }: { reviews: Review[]; rating: number; count: number }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const n = reviews.length;
  const go = (d: number) => {
    setDir(d);
    setI((v) => (v + d + n) % n);
  };
  useEffect(() => {
    if (paused || n < 2) return;
    const id = setInterval(() => go(1), 6500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, n]);
  if (!n) return null;
  const r = reviews[i];

  return (
    <section className="fern-paper relative overflow-hidden bg-ivory py-28 text-noir sm:py-36" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div className="mx-auto max-w-[1300px] px-6 sm:px-10 lg:px-16">
        <div className="flex flex-col items-center gap-6 text-center">
          <SectionTitle eyebrow="Ils nous ont fait confiance" title="Des mots" accent="qui fleurissent" align="center" tone="light" size="md" />
          <div className="flex items-center gap-3 rounded-full border border-noir/10 bg-white/60 px-5 py-2 text-sm backdrop-blur">
            <span className="flex">
              {Array.from({ length: 5 }).map((_, k) => (
                <Star key={k} className="h-4 w-4 fill-gold text-gold" />
              ))}
            </span>
            <span>
              <strong>{String(rating).replace(".", ",")}/5</strong> · {count} avis Google
            </span>
          </div>
        </div>

        <motion.div
          className="relative mt-16 min-h-[300px] cursor-grab active:cursor-grabbing sm:min-h-[260px]"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onDragEnd={(_, info) => {
            if (info.offset.x < -60) go(1);
            else if (info.offset.x > 60) go(-1);
          }}
          data-cursor="drag"
        >
          <span aria-hidden className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 font-display text-[12rem] leading-none text-aubergine-300/40">
            “
          </span>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.figure
              key={r.id}
              custom={dir}
              initial={{ opacity: 0, x: dir * 80, filter: "blur(8px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: dir * -80, filter: "blur(8px)" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative text-center"
            >
              <blockquote className="mx-auto max-w-4xl text-balance font-display text-[clamp(1.7rem,3.4vw,3.2rem)] font-light italic leading-[1.2] text-aubergine-900">{r.text}</blockquote>
              <figcaption className="mt-8 font-caps text-[0.65rem] uppercase tracking-[0.3em] text-noir/60">
                {r.author} <span className="mx-2 text-aubergine-500">✦</span> {r.source}
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </motion.div>

        <div className="mt-12 flex items-center justify-center gap-6">
          <button onClick={() => go(-1)} className="rounded-full border border-noir/15 p-3 transition hover:border-aubergine-600 hover:bg-aubergine-700 hover:text-ivory" aria-label="Avis précédent">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-2">
            {reviews.map((_, k) => (
              <button key={k} onClick={() => { setDir(k > i ? 1 : -1); setI(k); }} aria-label={`Avis ${k + 1}`} className="relative h-1.5 w-6 overflow-hidden rounded-full bg-noir/15">
                {k === i && <motion.span layoutId="rev-dot" className="absolute inset-0 rounded-full bg-aubergine-600" />}
              </button>
            ))}
          </div>
          <button onClick={() => go(1)} className="rounded-full border border-noir/15 p-3 transition hover:border-aubergine-600 hover:bg-aubergine-700 hover:text-ivory" aria-label="Avis suivant">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
