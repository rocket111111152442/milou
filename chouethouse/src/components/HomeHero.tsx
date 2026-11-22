"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Blob, Star, Owl } from "./decor";

const ease = [0.22, 1, 0.36, 1] as const;

export function HomeHero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -220]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const rot = useTransform(scrollYProgress, [0, 1], [0, 25]);

  return (
    <section ref={ref} className="relative overflow-hidden bg-shell pt-32 pb-20 sm:pt-40 lg:min-h-[100svh] lg:pb-28">
      <div className="paper absolute inset-0" />
      <Blob className="-top-32 -right-32 h-[28rem] w-[28rem] opacity-60" color="var(--color-peach)" />
      <Blob className="bottom-0 -left-40 h-96 w-96 opacity-50" color="var(--color-mint)" />
      <motion.div style={{ rotate: rot }} className="absolute top-32 left-[46%] hidden lg:block">
        <Star className="relative h-14 w-14" color="var(--color-mustard)" />
      </motion.div>

      <div className="container-x relative grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
            className="eyebrow"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sage-deep" />
            </span>
            Coffee shop · La Seyne-sur-Mer
          </motion.p>

          <h1 className="mt-6 text-[3.1rem] leading-[0.98] font-semibold sm:text-7xl lg:text-[5.4rem]">
            {["Un lieu", "gourmand", "& familial"].map((line, i) => (
              <span key={line} className="block overflow-hidden pb-1">
                <motion.span
                  className={`block ${i === 1 ? "text-tomato" : i === 2 ? "text-sage-deep" : ""}`}
                  initial={{ y: "105%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, ease, delay: 0.1 + i * 0.12 }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.5 }}
            className="mt-6 max-w-xl text-lg text-ink-soft sm:text-xl"
          >
            Brunchs, cookies maison et petite restauration de saison pour les parents ; ateliers d&apos;éveil, anniversaires et stages pour les enfants.
            <span className="font-script text-2xl text-ink"> Un véritable cocon, aux portes de Toulon.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.65 }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Link href="/ateliers-enfants" className="btn-primary">
              Voir les ateliers
            </Link>
            <Link href="/restaurant-brunch" className="btn-ghost">
              La carte & le brunch
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.8 }}
            className="mt-10 flex flex-wrap items-center gap-6"
          >
            <div className="flex items-center gap-3">
              <div className="flex text-mustard" aria-hidden>
                {"★★★★★".split("").map((s, i) => (
                  <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1 + i * 0.08, type: "spring" }} className="text-2xl">
                    {s}
                  </motion.span>
                ))}
              </div>
              <p className="leading-tight">
                <strong className="font-display text-xl">4,9/5</strong>
                <span className="block text-sm text-ink-soft">136 avis Google</span>
              </p>
            </div>
            <p className="rounded-full bg-white/70 px-4 py-2 text-sm font-bold ring-1 ring-ink/5">🕘 Lun. – Sam. · 9 h – 18 h</p>
          </motion.div>
        </div>

        {/* Collage photos */}
        <div className="relative mx-auto h-[440px] w-full max-w-[560px] sm:h-[560px]">
          <motion.div style={{ y: y1 }} className="absolute top-0 left-[6%] w-[58%]">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, rotate: -4 }}
              transition={{ duration: 1, ease, delay: 0.2 }}
              className="relative aspect-[3/4] overflow-hidden rounded-[2.5rem] shadow-2xl ring-8 ring-white"
            >
              <Image src="/images/table-brunch.webp" alt="Table de brunch chez Chouet'House" fill priority sizes="(min-width:1024px) 320px, 60vw" className="object-cover" />
            </motion.div>
          </motion.div>
          <motion.div style={{ y: y2 }} className="absolute top-[18%] right-0 w-[46%]">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: 12 }}
              animate={{ opacity: 1, scale: 1, rotate: 5 }}
              transition={{ duration: 1, ease, delay: 0.4 }}
              className="relative aspect-[3/4] overflow-hidden rounded-[2.5rem] shadow-2xl ring-8 ring-white"
            >
              <Image src="/images/smoothies.webp" alt="Smoothie fraise et milkshake" fill priority sizes="(min-width:1024px) 260px, 45vw" className="object-cover" />
            </motion.div>
          </motion.div>
          <motion.div style={{ y: y3 }} className="absolute bottom-0 left-0 w-[52%]">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0, rotate: 3 }}
              transition={{ duration: 1, ease, delay: 0.6 }}
              className="relative aspect-square overflow-hidden rounded-full shadow-2xl ring-8 ring-white"
            >
              <Image src="/images/pancakes.webp" alt="Pancakes maison aux fruits" fill sizes="(min-width:1024px) 280px, 50vw" className="object-cover" />
            </motion.div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", delay: 1.1 }}
            className="absolute right-[6%] bottom-[4%] w-28 animate-float sm:w-32"
          >
            <Owl className="h-auto w-full drop-shadow-xl" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.2, duration: 0.7 }}
            className="absolute top-[4%] right-[4%] animate-wiggle rounded-2xl bg-mustard px-4 py-2 font-script text-2xl font-bold shadow-lg"
          >
            Cookies maison !
          </motion.div>
        </div>
      </div>
    </section>
  );
}
