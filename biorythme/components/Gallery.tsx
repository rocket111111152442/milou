"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import Photo from "./Photo";
import { PHOTOS, photo, type PhotoKey } from "@/lib/photos";

const KEYS = Object.keys(PHOTOS) as PhotoKey[];

export default function Gallery() {
  const [open, setOpen] = useState<number | null>(null);
  const move = useCallback((d: number) => setOpen((o) => (o === null ? o : (o + d + KEYS.length) % KEYS.length)), []);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, move]);

  return (
    <>
      <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
        {KEYS.map((k, i) => (
          <motion.button
            key={k}
            onClick={() => setOpen(i)}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.7, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="group relative mb-3 block w-full overflow-hidden rounded-3xl border border-line"
            aria-label={`Agrandir : ${PHOTOS[k].alt}`}
          >
            <Photo
              {...photo(k)}
              className={`${i % 3 === 1 ? "aspect-[3/4]" : "aspect-[4/3]"} w-full transition-transform duration-700 group-hover:scale-105`}
            />
            <span className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-ink to-transparent p-4 text-left text-sm transition-transform duration-500 group-hover:translate-y-0">
              {PHOTOS[k].alt}
            </span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {open !== null && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/95 p-4 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
          >
            <motion.div
              key={open}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="relative h-[80vh] w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Photo {...photo(KEYS[open])} eager className="h-full w-full rounded-2xl [&_img]:object-contain" />
              <p className="mt-3 text-center text-sm text-muted">
                {PHOTOS[KEYS[open]].alt} · {open + 1}/{KEYS.length}
              </p>
            </motion.div>
            <button onClick={(e) => { e.stopPropagation(); move(-1); }} className="absolute left-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-line bg-ink/70 text-xl" aria-label="Photo précédente">←</button>
            <button onClick={(e) => { e.stopPropagation(); move(1); }} className="absolute right-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-line bg-ink/70 text-xl" aria-label="Photo suivante">→</button>
            <button onClick={() => setOpen(null)} className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full border border-line bg-ink/70" aria-label="Fermer">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
