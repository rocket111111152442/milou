"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { Petals } from "@/components/motion/Petals";
import { SplitText } from "@/components/motion/SplitText";
import { useUI } from "@/store/ui";
import { SmartImage } from "./SmartImage";

/** En-tête de page intérieure : titre dévoilé, fil d'Ariane, image en arche optionnelle. */
export function PageHero({
  eyebrow,
  title,
  accent,
  intro,
  image,
  crumbs = [],
  compact = false,
  children,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  intro?: string;
  image?: string;
  crumbs?: { href: string; label: string }[];
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const play = useUI((s) => s.introDone);
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const imgY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  return (
    <section ref={ref} className={`fern-night fern-drift relative overflow-hidden bg-noir ${compact ? "pb-16 pt-40" : "pb-24 pt-44 lg:pb-32"}`}>
      <div className="pointer-events-none absolute -left-32 top-0 h-[50vmax] w-[50vmax] rounded-full bg-aubergine-600/20 blur-[140px]" />
      <Petals count={12} />
      <div className={`relative mx-auto grid max-w-[1600px] items-end gap-12 px-6 sm:px-10 lg:px-16 ${image ? "lg:grid-cols-[1.3fr_0.7fr]" : ""}`}>
        <motion.div style={{ y }}>
          <motion.nav
            aria-label="Fil d'Ariane"
            className="flex flex-wrap items-center gap-2 text-[0.65rem] uppercase tracking-[0.2em] text-ivory/45"
            initial={{ opacity: 0 }}
            animate={play ? { opacity: 1 } : {}}
            transition={{ duration: 1 }}
          >
            <Link href="/" className="hover:text-ivory">
              Accueil
            </Link>
            {crumbs.map((c) => (
              <span key={c.href} className="flex items-center gap-2">
                <span className="text-gold">✦</span>
                <Link href={c.href} className="hover:text-ivory">
                  {c.label}
                </Link>
              </span>
            ))}
          </motion.nav>
          <motion.p
            className="eyebrow mt-8 flex items-center gap-4 text-gold"
            initial={{ opacity: 0, x: -20 }}
            animate={play ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            <span className="h-px w-10 bg-gold/60" />
            {eyebrow}
          </motion.p>
          <h1 className={`h-display mt-6 ${compact ? "text-[clamp(2.8rem,7vw,6.5rem)]" : "text-[clamp(3.2rem,8.5vw,8.5rem)]"}`}>
            <SplitText text={title} play={play} delay={0.2} />
            {accent && (
              <>
                {" "}
                <SplitText text={accent} play={play} delay={0.45} className="italic" wordClassName="pr-[0.08em]" innerClassName="text-foil" />
              </>
            )}
          </h1>
          {intro && (
            <motion.p
              className="mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-ivory/70"
              initial={{ opacity: 0, y: 20 }}
              animate={play ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.7 }}
            >
              {intro}
            </motion.p>
          )}
          {children && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={play ? { opacity: 1, y: 0 } : {}} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.85 }}>
              {children}
            </motion.div>
          )}
        </motion.div>
        {image && (
          <motion.div style={{ y: imgY }} className="relative mx-auto hidden aspect-[3/4] w-full max-w-sm lg:block">
            <motion.div
              className="absolute inset-0 overflow-hidden rounded-t-full border border-gold/40 p-2"
              initial={{ clipPath: "inset(100% 0% 0% 0%)" }}
              animate={play ? { clipPath: "inset(0% 0% 0% 0%)" } : {}}
              transition={{ duration: 1.5, ease: [0.77, 0, 0.18, 1], delay: 0.3 }}
            >
              <div className="relative h-full w-full overflow-hidden rounded-t-full">
                <motion.div className="absolute inset-0" initial={{ scale: 1.35 }} animate={play ? { scale: 1 } : {}} transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}>
                  <SmartImage src={image} alt="" fill priority sizes="380px" className="object-cover" />
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
