"use client";

import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Car, Star, Truck } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Magnetic } from "@/components/motion/Reveal";
import { Petals } from "@/components/motion/Petals";
import { SplitText } from "@/components/motion/SplitText";
import { VioletMark } from "@/components/site/Logo";
import { SmartImage } from "@/components/site/SmartImage";
import type { Content, Settings } from "@/lib/types";
import { useUI } from "@/store/ui";

const EASE = [0.22, 1, 0.36, 1] as const;

function RotatingBadge() {
  const text = "Artisane fleuriste ✦ Fleurs locales ✦ Six-Fours ✦ ";
  return (
    <div className="relative h-28 w-28 sm:h-32 sm:w-32">
      <svg viewBox="0 0 100 100" className="absolute inset-0 animate-spin-slow" aria-hidden>
        <defs>
          <path id="badge-circle" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
        </defs>
        <text className="fill-ivory font-caps text-[8.2px] uppercase tracking-[0.18em]">
          <textPath href="#badge-circle">{text}</textPath>
        </text>
      </svg>
      <div className="absolute inset-[26%] flex items-center justify-center rounded-full bg-aubergine-700/80 backdrop-blur">
        <VioletMark className="h-9 w-9 text-gold" />
      </div>
    </div>
  );
}

export function Hero({ content, settings }: { content: Content; settings: Settings }) {
  const play = useUI((s) => s.introDone);
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const titleY = useTransform(scrollYProgress, [0, 1], [0, 260]);
  const fade = useTransform(scrollYProgress, [0, 0.65], [1, 0]);
  const a1 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const a2 = useTransform(scrollYProgress, [0, 1], [0, -260]);
  const a3 = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const scaleMain = useTransform(scrollYProgress, [0, 1], [1, 1.12]);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });
  const m1x = useTransform(sx, (v) => v * 18);
  const m1y = useTransform(sy, (v) => v * 14);
  const m2x = useTransform(sx, (v) => v * -30);
  const m2y = useTransform(sy, (v) => v * -24);
  const m3x = useTransform(sx, (v) => v * 40);
  const m3y = useTransform(sy, (v) => v * 30);
  const y1 = useTransform([a1, m1y], ([a, b]: number[]) => a + b);
  const y2 = useTransform([a2, m2y], ([a, b]: number[]) => a + b);
  const y3 = useTransform([a3, m3y], ([a, b]: number[]) => a + b);

  const [img1, img2, img3] = [content.hero.images[0], content.hero.images[1] || content.hero.images[0], content.hero.images[2] || content.hero.images[0]];

  return (
    <section
      ref={ref}
      className="fern-night fern-drift relative min-h-[100svh] overflow-hidden bg-noir"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        mx.set(e.clientX / window.innerWidth - 0.5);
        my.set(e.clientY / window.innerHeight - 0.5);
      }}
    >
      <div className="pointer-events-none absolute -left-40 top-1/4 h-[60vmax] w-[60vmax] rounded-full bg-aubergine-600/25 blur-[140px]" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-[40vmax] w-[40vmax] rounded-full bg-gold/10 blur-[160px]" />
      {content.hero.videoUrl && (
        <video className="absolute inset-0 h-full w-full object-cover opacity-30" src={content.hero.videoUrl} autoPlay muted loop playsInline aria-hidden />
      )}
      <Petals count={26} />

      <div className="relative mx-auto grid min-h-[100svh] max-w-[1600px] grid-cols-1 items-center gap-12 px-6 pb-36 pt-36 sm:px-10 lg:grid-cols-[1.12fr_1fr] lg:gap-6 lg:px-16 lg:pb-28">
        <motion.div style={{ y: titleY, opacity: fade }} className="relative z-10">
          <motion.p
            className="eyebrow flex items-center gap-4 text-gold"
            initial={{ opacity: 0, x: -20 }}
            animate={play ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1, ease: EASE, delay: 0.1 }}
          >
            <span className="h-px w-10 bg-gold/60" />
            {content.hero.eyebrow}
          </motion.p>
          <h1 className="h-display mt-7 text-[clamp(3.6rem,9.6vw,10.5rem)]">
            <SplitText text={content.hero.titleLine1} by="char" play={play} delay={0.25} stagger={0.035} className="block" />
            <SplitText
              text={content.hero.titleLine2}
              play={play}
              delay={0.65}
              className="block italic"
              wordClassName="pr-[0.08em]"
              innerClassName="text-foil"
            />
          </h1>
          <motion.p
            className="mt-8 max-w-xl text-pretty text-base leading-relaxed text-ivory/70 sm:text-lg"
            initial={{ opacity: 0, y: 24 }}
            animate={play ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1.2, ease: EASE, delay: 1.05 }}
          >
            {content.hero.subtitle}
          </motion.p>
          <motion.div
            className="mt-10 flex flex-wrap items-center gap-4"
            initial={{ opacity: 0, y: 24 }}
            animate={play ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1.2, ease: EASE, delay: 1.25 }}
          >
            <Magnetic>
              <Link href="/boutique" className="btn btn-gold" data-cursor="link">
                <span>{content.hero.ctaLabel}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Magnetic>
            <Magnetic>
              <Link href="/atelier" className="btn btn-ghost text-ivory">
                <span>Composer mon bouquet</span>
              </Link>
            </Magnetic>
          </motion.div>
        </motion.div>

        {/* composition d'arches */}
        <div className="relative mx-auto h-[62vh] w-full max-w-[640px] lg:h-[78vh]">
          <motion.div style={{ y: y1, x: m1x }} className="absolute right-[6%] top-[4%] h-[84%] w-[64%]">
            <motion.div
              className="relative h-full w-full overflow-hidden rounded-t-full border border-gold/40 p-2"
              initial={{ clipPath: "inset(100% 0% 0% 0%)" }}
              animate={play ? { clipPath: "inset(0% 0% 0% 0%)" } : {}}
              transition={{ duration: 1.6, ease: [0.77, 0, 0.18, 1], delay: 0.35 }}
            >
              <div className="relative h-full w-full overflow-hidden rounded-t-full">
                <motion.div className="absolute inset-0" style={{ scale: scaleMain }}>
                  <motion.div className="absolute inset-0" initial={{ scale: 1.4 }} animate={play ? { scale: 1 } : {}} transition={{ duration: 2.4, ease: EASE, delay: 0.35 }}>
                    <SmartImage src={img1} alt="Bouquet de saison de la Maison" fill priority sizes="(max-width: 1024px) 70vw, 40vw" className="object-cover" />
                  </motion.div>
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-t from-aubergine-950/50 via-transparent to-aubergine-900/20" />
              </div>
            </motion.div>
          </motion.div>

          <motion.div style={{ y: y2, x: m2x }} className="absolute bottom-[2%] left-0 h-[42%] w-[38%]">
            <motion.div
              className="relative h-full w-full overflow-hidden rounded-t-full shadow-2xl shadow-black/50"
              initial={{ clipPath: "inset(100% 0% 0% 0%)" }}
              animate={play ? { clipPath: "inset(0% 0% 0% 0%)" } : {}}
              transition={{ duration: 1.5, ease: [0.77, 0, 0.18, 1], delay: 0.7 }}
            >
              <SmartImage src={img2} alt="" fill sizes="25vw" className="object-cover" />
            </motion.div>
          </motion.div>

          <motion.div style={{ y: y3, x: m3x }} className="absolute left-[8%] top-0 aspect-square w-[30%]">
            <motion.div
              className="relative h-full w-full overflow-hidden rounded-full border border-ivory/20"
              initial={{ scale: 0, opacity: 0 }}
              animate={play ? { scale: 1, opacity: 1 } : {}}
              transition={{ duration: 1.4, ease: EASE, delay: 0.95 }}
            >
              <SmartImage src={img3} alt="" fill sizes="20vw" className="object-cover" />
            </motion.div>
          </motion.div>

          <motion.div
            className="absolute bottom-[10%] right-0 sm:right-[2%]"
            initial={{ scale: 0, rotate: -90 }}
            animate={play ? { scale: 1, rotate: 0 } : {}}
            transition={{ duration: 1.4, ease: EASE, delay: 1.2 }}
          >
            <RotatingBadge />
          </motion.div>
        </div>
      </div>

      {/* bandeau d'informations */}
      <motion.div
        className="absolute inset-x-0 bottom-0 z-10 border-t border-ivory/10 bg-noir/40 backdrop-blur-md"
        initial={{ y: "100%" }}
        animate={play ? { y: 0 } : {}}
        transition={{ duration: 1.1, ease: EASE, delay: 1.4 }}
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 overflow-x-auto px-6 py-4 text-[0.7rem] uppercase tracking-[0.18em] text-ivory/70 no-scrollbar sm:px-10 lg:px-16">
          <span className="flex shrink-0 items-center gap-2.5">
            <Truck className="h-4 w-4 text-gold" strokeWidth={1.4} /> Livraison Six-Fours · Sanary · La Seyne
          </span>
          <span className="flex shrink-0 items-center gap-2.5">
            <Car className="h-4 w-4 text-gold" strokeWidth={1.4} /> Retrait gratuit & Drive
          </span>
          <span className="flex shrink-0 items-center gap-2.5">
            <Star className="h-4 w-4 fill-gold text-gold" strokeWidth={1.4} /> {String(settings.googleRating).replace(".", ",")} / 5 · {settings.googleReviews} avis Google
          </span>
          <span className="hidden shrink-0 items-center gap-3 lg:flex">
            Défiler
            <span className="relative block h-8 w-px overflow-hidden bg-ivory/20">
              <motion.span className="absolute left-0 top-0 block h-1/2 w-px bg-gold" animate={{ y: ["-100%", "200%"] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
            </span>
          </span>
        </div>
      </motion.div>
    </section>
  );
}
