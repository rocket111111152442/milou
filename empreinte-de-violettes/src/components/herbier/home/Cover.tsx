"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useScrollLock } from "@/components/motion/SmoothScroll";
import { useUI } from "@/store/ui";
import { EASE } from "../Elements";
import { Label } from "../Label";
import { Plate } from "../Plate";
import { Bloom } from "./Bloom";
import { IntroFilm } from "./IntroFilm";

type Mode = "full" | "quick";

/**
 * Couverture de l'accueil — et l'intro de 5 secondes : l'encre des gravures monte sur le papier,
 * l'étiquette noire se déplie depuis un filet, la dorure s'imprime lettre à lettre puis prend la lumière.
 * Rejouée en version courte au cours d'une même visite.
 */
export function Cover({ introEnabled, oncePerSession, coords, founded, tagline, cta }: { introEnabled: boolean; oncePerSession: boolean; coords: string; founded: string; tagline: string; cta: string }) {
  const introDone = useUI((s) => s.introDone);
  const setIntroDone = useUI((s) => s.setIntroDone);
  const [mode, setMode] = useState<Mode | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [film, setFilm] = useState(true);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    let seen = useUI.getState().introDone;
    try {
      seen = seen || (oncePerSession && !!sessionStorage.getItem("ev-intro"));
      sessionStorage.setItem("ev-intro", "1");
    } catch {}
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const m: Mode = introEnabled && !seen && !reduce ? "full" : "quick";
    setMode(m);
    const t = setTimeout(setIntroDone, m === "full" ? 4900 : 700);
    return () => clearTimeout(t);
  }, [introEnabled, oncePerSession, setIntroDone]);

  const playing = mode === "full" && !introDone && !skipped;
  useScrollLock(playing);

  const skip = () => {
    setSkipped(true);
    setFilm(false);
    setIntroDone();
  };

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const fernY = useTransform(scrollYProgress, [0, 1], [0, -160]);
  const violetY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const labelY = useTransform(scrollYProgress, [0, 1], [0, 110]);
  const labelScale = useTransform(scrollYProgress, [0, 1], [1, 0.93]);
  const fade = useTransform(scrollYProgress, [0, 0.45], [1, 0]);

  const full = mode === "full" && !skipped;
  const k = skipped ? "skip" : mode || "wait";
  // horaires de l'intro complète (secondes)
  // avec le film d'ouverture, la couverture se dévoile au moment où le papier se lève
  const base = full ? 3.9 : 0;
  const T = { fern: base, violet: base + 0.15, after: base + 0.35 };
  const dur = 1.5;

  return (
    <section ref={ref} className="relative h-[100svh] min-h-[600px] overflow-hidden" aria-label="Empreinte de Violettes">
      {full && film && <IntroFilm onDone={() => setFilm(false)} onSkip={skip} />}
      {mode && <Bloom progress={scrollYProgress} start={base} />}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-44 bg-gradient-to-t from-paper via-paper/75 to-transparent" aria-hidden />

      <motion.div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-5" style={{ y: labelY, scale: labelScale }}>
        {mode && (
          <motion.div key={`l-${k}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: base }}>
            <Label as="h1" size="lg" instant />
          </motion.div>
        )}
        {mode && (
          <motion.div
            key={`t-${k}`}
            className="mt-9 flex flex-col items-center text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: EASE, delay: skipped ? 0 : T.after }}
          >
            <p className="max-w-[34rem] text-balance font-text text-[1.08rem] italic leading-relaxed text-ink-soft sm:text-[1.18rem]">{tagline}</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              <Link href="/boutique" className="btn-line">
                {cta} <span className="arrow">→</span>
              </Link>
              <Link href="/atelier" className="ulink font-text text-[1rem] italic text-ink-soft">
                ou composer votre bouquet
              </Link>
            </div>
          </motion.div>
        )}
      </motion.div>

      {mode && (
        <motion.div className="pointer-events-none absolute inset-x-0 bottom-0 z-20" style={{ opacity: fade }}>
        <motion.div
          key={`i-${k}`}
          className="wrap grid grid-cols-[1fr_auto_1fr] items-end pb-6 sm:pb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: skipped ? 0 : T.after + 0.4 }}
        >
          <div className="col-start-2 flex flex-col items-center">
            <span className="sc text-[0.6rem] text-ink-muted">Défiler</span>
            <span className="relative mt-2 block h-10 w-px overflow-hidden bg-ink/15">
              <motion.span className="absolute inset-x-0 top-0 h-1/2 bg-ink" animate={{ y: ["-100%", "200%"] }} transition={{ duration: 2.2, repeat: Infinity, ease: [0.65, 0, 0.35, 1] }} />
            </span>
          </div>
          <div className="hidden text-right leading-snug sm:block">
            <p className="sc">Six-Fours-les-Plages · Var</p>
            <p className="folio tab mt-1 text-ink-muted">{coords}</p>
            <p className="folio text-ink-muted">{founded}</p>
          </div>
        </motion.div>
        </motion.div>
      )}

      <AnimatePresence>
      </AnimatePresence>
    </section>
  );
}
