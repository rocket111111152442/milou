"use client";

import Image from "next/image";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { useSiteData } from "@/components/SettingsProvider";
import { InstagramIcon } from "@/components/Footer";
import { Reveal, SplitWords } from "@/components/ui/motion";

const COLUMNS = [
  [
    { src: "/images/baguettes.jpg", alt: "Baguettes dorées", ratio: "aspect-[3/4]" },
    { src: "/images/p/tarte-fraises.jpg", alt: "Tartelette aux fruits rouges", ratio: "aspect-square" },
    { src: "/images/boutique-2.jpg", alt: "Intérieur d'une boulangerie", ratio: "aspect-[4/5]" },
    { src: "/images/p/croissant.jpg", alt: "Croissants", ratio: "aspect-square" },
  ],
  [
    { src: "/images/mains-pate.jpg", alt: "Mains travaillant la pâte", ratio: "aspect-[4/5]" },
    { src: "/images/p/pain-chocolat.jpg", alt: "Plaque de pains au chocolat", ratio: "aspect-[3/4]" },
    { src: "/images/p/eclair-chocolat.jpg", alt: "Éclair au chocolat", ratio: "aspect-square" },
    { src: "/images/p/campagne.jpg", alt: "Pain de campagne", ratio: "aspect-[4/5]" },
  ],
  [
    { src: "/images/hero-pains.jpg", alt: "Pains aux graines et épis de blé", ratio: "aspect-square" },
    { src: "/images/boutique-3.jpg", alt: "Vitrine de viennoiseries", ratio: "aspect-[3/4]" },
    { src: "/images/farine.jpg", alt: "Farine tamisée", ratio: "aspect-[4/5]" },
    { src: "/images/p/tartelette-fruits.jpg", alt: "Tartelette aux fruits", ratio: "aspect-square" },
  ],
  [
    { src: "/images/p/macarons.jpg", alt: "Macarons colorés", ratio: "aspect-[3/4]" },
    { src: "/images/p/levain.jpg", alt: "Pain au levain", ratio: "aspect-[4/5]" },
    { src: "/images/p/tartes-salees.jpg", alt: "Tartes salées", ratio: "aspect-square" },
    { src: "/images/p/baguette.jpg", alt: "Baguettes", ratio: "aspect-[3/4]" },
  ],
];

function Column({ items, y, className = "" }: { items: (typeof COLUMNS)[number]; y: MotionValue<string>; className?: string }) {
  return (
    <motion.div style={{ y }} className={`flex flex-col gap-4 ${className}`}>
      {items.map((it) => (
        <figure key={it.src} className={`group relative overflow-hidden rounded-[1.5rem] ${it.ratio}`}>
          <Image
            src={it.src}
            alt={it.alt}
            fill
            sizes="(min-width:1024px) 25vw, 50vw"
            className="object-cover grayscale-[25%] transition-all duration-700 group-hover:scale-110 group-hover:grayscale-0"
          />
        </figure>
      ))}
    </motion.div>
  );
}

export function Gallery() {
  const { site } = useSiteData();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], ["0%", "-18%"]);
  const y2 = useTransform(scrollYProgress, [0, 1], ["-12%", "6%"]);
  const y3 = useTransform(scrollYProgress, [0, 1], ["4%", "-22%"]);
  const y4 = useTransform(scrollYProgress, [0, 1], ["-8%", "10%"]);

  return (
    <section ref={ref} className="relative overflow-hidden bg-creme py-24 sm:py-36">
      <div className="mx-auto mb-16 flex max-w-7xl flex-col items-start justify-between gap-8 px-6 md:flex-row md:items-end">
        <div>
          <Reveal>
            <p className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-croute">
              <span className="h-px w-10 bg-croute" /> Le comptoir
            </p>
          </Reveal>
          <SplitWords as="h2" text="Ça sent bon jusque sur le trottoir." className="block max-w-2xl font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl" />
        </div>
        {site.instagram && (
          <Reveal delay={0.2}>
            <a
              href={site.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-full bg-cafe px-6 py-4 font-semibold text-creme transition hover:bg-croute"
            >
              <InstagramIcon className="h-5 w-5" /> Suivre {site.instagram.handle}
            </a>
          </Reveal>
        )}
      </div>

      <div className="relative mx-auto grid h-[110vh] max-w-[1600px] grid-cols-2 gap-4 overflow-hidden px-4 md:h-[130vh] lg:grid-cols-4">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-creme to-transparent" />
        <Column items={COLUMNS[0]} y={y1} />
        <Column items={COLUMNS[1]} y={y2} />
        <Column items={COLUMNS[2]} y={y3} className="hidden lg:flex" />
        <Column items={COLUMNS[3]} y={y4} className="hidden lg:flex" />
      </div>
      <p className="mx-auto mt-8 max-w-7xl px-6 text-xs text-grege">Photos d&apos;illustration.</p>
    </section>
  );
}
