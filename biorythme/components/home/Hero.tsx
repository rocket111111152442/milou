"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import Photo from "../Photo";

const WORD = "BIORYTHME".split("");

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1.05, 1.3]);
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "35%"]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section ref={ref} className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden pb-10 pt-32">
      <motion.div style={{ scale }} className="absolute inset-0">
        <Photo
          src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=2000&q=70"
          alt="Entraînement en salle"
          eager
          className="h-full w-full"
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/30" />
      <motion.div
        aria-hidden
        className="absolute -right-40 top-1/4 h-[40rem] w-[40rem] rounded-full bg-volt/25 blur-[140px]"
        animate={{ x: [0, -80, 0], y: [0, 60, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -left-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-blaze/20 blur-[140px]"
        animate={{ x: [0, 90, 0], y: [0, -40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div style={{ y, opacity: fade }} className="relative mx-auto w-full max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mb-6 inline-flex items-center gap-3 rounded-full border border-bone/20 bg-ink/40 px-4 py-2 text-xs uppercase tracking-[0.2em] backdrop-blur"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-pulse-dot rounded-full bg-volt" />
            <span className="relative h-2 w-2 rounded-full bg-volt" />
          </span>
          Six-Fours-les-Plages · Sanary-sur-Mer
        </motion.div>

        <h1 className="font-display text-[19vw] leading-[0.82] sm:text-[17vw] xl:text-[15.5rem]" aria-label="Biorythme">
          {WORD.map((ch, i) => (
            <span key={i} className="inline-block overflow-hidden align-bottom">
              <motion.span
                className={`inline-block ${i >= 3 ? "" : "text-volt"}`}
                initial={{ y: "105%" }}
                animate={{ y: 0 }}
                transition={{ duration: 1, delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              >
                {ch}
              </motion.span>
            </span>
          ))}
        </h1>

        <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="max-w-md text-lg text-bone/80"
          >
            Envie de vous dépenser ? De perdre vos kilos en trop ? Salles de sport à Six-Fours-les-Plages et
            Sanary-sur-Mer : fitness, musculation, cross training et cours collectifs. Réservez votre cours en ligne.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="flex flex-wrap gap-3"
          >
            <Link
              href="/planning"
              className="group relative overflow-hidden rounded-full bg-volt px-7 py-4 font-semibold text-ink"
            >
              <span className="relative z-10">Réserver un cours →</span>
              <span className="absolute inset-0 -translate-x-full bg-bone transition-transform duration-500 group-hover:translate-x-0" />
            </Link>
            <Link
              href="/clubs"
              className="rounded-full border border-bone/30 px-7 py-4 font-semibold backdrop-blur transition hover:border-bone hover:bg-bone/10"
            >
              Découvrir les clubs
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
