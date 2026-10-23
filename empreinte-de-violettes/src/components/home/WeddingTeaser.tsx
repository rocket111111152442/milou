"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { SplitText } from "@/components/motion/SplitText";
import { SmartImage } from "@/components/site/SmartImage";
import type { Content } from "@/lib/types";

export function WeddingTeaser({ wedding, images }: { wedding: Content["wedding"]; images: string[] }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-15%", "15%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1.2, 1]);
  const radius = useTransform(scrollYProgress, [0, 0.4], ["30vw", "0vw"]);
  return (
    <section ref={ref} id="mariage" className="relative bg-noir">
      <motion.div className="relative h-[110vh] overflow-hidden" style={{ borderTopLeftRadius: radius, borderTopRightRadius: radius }}>
        <motion.div className="absolute inset-[-15%_0]" style={{ y, scale }}>
          <SmartImage src={wedding.image} alt="Bouquet de mariée" fill sizes="100vw" className="object-cover" />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-noir/70 via-noir/30 to-noir" />
        <div className="relative mx-auto flex h-full max-w-[1600px] flex-col justify-end px-6 pb-24 sm:px-10 lg:px-16">
          <p className="eyebrow flex items-center gap-4 text-gold">
            <span className="h-px w-8 bg-gold/60" />
            Mariages & événements
          </p>
          <h2 className="h-display mt-5 max-w-5xl text-[clamp(3rem,8vw,8.5rem)]">
            <SplitText text="Le plus beau jour," />{" "}
            <SplitText text="en fleurs" className="italic" innerClassName="text-foil" wordClassName="pr-[0.08em]" delay={0.2} />
          </h2>
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <Reveal>
              <p className="max-w-2xl text-lg leading-relaxed text-ivory/75">{wedding.intro}</p>
            </Reveal>
            <Reveal delay={0.15} className="flex gap-3">
              {images.slice(0, 3).map((src, i) => (
                <div key={i} className="relative hidden h-28 w-20 overflow-hidden rounded-t-full border border-ivory/20 sm:block">
                  <SmartImage src={src} alt="" fill sizes="80px" className="object-cover" />
                </div>
              ))}
            </Reveal>
          </div>
          <Reveal delay={0.25} className="mt-10 flex flex-wrap gap-4">
            <Link href="/mariage" className="btn btn-gold" data-cursor="link">
              <span>Découvrir nos prestations</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/mariage#devis" className="btn btn-ghost text-ivory">
              <span>Demander un devis</span>
            </Link>
          </Reveal>
        </div>
      </motion.div>
    </section>
  );
}
