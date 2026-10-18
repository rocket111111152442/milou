"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef, useState } from "react";
import { FlourParticles } from "@/components/ui/FlourParticles";
import { RotatingBadge } from "@/components/ui/RotatingBadge";
import { Magnetic, SplitLetters } from "@/components/ui/motion";
import { OpenStatusCycle } from "@/components/ui/OpenStatus";
import { introDelay } from "@/components/Preloader";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  // Laisse le temps à l'écran d'ouverture de se retirer
  const [D] = useState(introDelay);
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.05, 1.35]);
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const titleY = useTransform(scrollYProgress, [0, 1], ["0%", "-55%"]);
  const fade = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const cardY = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);

  return (
    <section ref={ref} className="grain relative flex min-h-[100svh] items-end overflow-hidden bg-torref text-creme">
      <motion.div className="absolute inset-0" style={{ scale: imgScale, y: imgY }}>
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.25, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 2.4, delay: D - 0.6, ease }}
        >
          <Image
            src="/images/hero-croissants.jpg"
            alt="Croissants dorés saupoudrés de farine"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[70%_center]"
          />
        </motion.div>
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-t from-torref via-torref/55 to-torref/20" />
      <div className="absolute inset-0 bg-gradient-to-r from-torref/80 via-torref/25 to-transparent" />
      <FlourParticles className="z-[2]" />

      <motion.div style={{ y: titleY, opacity: fade }} className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-16 pt-36 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: D + 0.1, duration: 0.8 }}
          className="mb-6 flex flex-wrap items-center gap-3"
        >
          <OpenStatusCycle tone="dark" />
          <span className="rounded-full border border-creme/20 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-creme/80 backdrop-blur-md">
            Sanary · Six-Fours · 7j/7
          </span>
        </motion.div>

        <motion.p
          className="font-script text-4xl text-dore sm:text-5xl"
          initial={{ clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          transition={{ delay: D, duration: 1.4, ease: "easeInOut" }}
        >
          Artisan Boulanger
        </motion.p>
        <h1 className="mt-2 font-display text-[clamp(3.2rem,11vw,9.5rem)] font-medium leading-[0.88] tracking-[-0.035em]">
          <SplitLetters text="Le Pétrin" delay={D + 0.15} className="block" />
          <SplitLetters text="de Pépiole" delay={D + 0.45} className="block italic text-mie" />
        </h1>

        <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <motion.p
            className="max-w-md text-lg leading-relaxed text-creme/80"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: D + 0.9, duration: 0.9, ease }}
          >
            Ici, le pain est pétri, façonné et cuit sur place, chaque jour. Baguettes de tradition, levain,
            viennoiseries et pâtisseries — à Sanary près de la gare, et à Six-Fours chez Maison Sernesi.
          </motion.p>

          <motion.div
            className="flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: D + 1.05, duration: 0.9, ease }}
          >
            <Magnetic>
              <Link
                href="/carte"
                className="group inline-flex h-14 items-center gap-3 rounded-full bg-dore pl-7 pr-2 font-semibold text-torref transition hover:bg-creme"
              >
                Commander en ligne
                <span className="grid h-10 w-10 place-items-center rounded-full bg-torref text-dore transition-transform duration-500 group-hover:rotate-[-45deg]">
                  →
                </span>
              </Link>
            </Magnetic>
            <Magnetic>
              <Link
                href="/#boutiques"
                className="inline-flex h-14 items-center rounded-full border border-creme/30 px-7 font-semibold text-creme backdrop-blur-sm transition hover:bg-creme/10"
              >
                Nos boutiques
              </Link>
            </Magnetic>
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        style={{ y: cardY }}
        className="absolute right-6 top-28 z-10 hidden h-40 w-40 text-creme/90 md:block lg:right-16 lg:top-36 lg:h-48 lg:w-48"
        initial={{ opacity: 0, scale: 0.6, rotate: -40 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: D + 0.8, duration: 1.2, ease }}
      >
        <RotatingBadge />
      </motion.div>

      <motion.div
        className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-creme/60 sm:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: D + 1.6 }}
      >
        Défiler
        <span className="relative h-10 w-[1.5px] overflow-hidden bg-creme/20">
          <motion.span
            className="absolute inset-x-0 top-0 h-1/2 bg-dore"
            animate={{ y: ["-100%", "200%"] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          />
        </span>
      </motion.div>
    </section>
  );
}
