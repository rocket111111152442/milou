"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { Countdown } from "@/components/site/Countdown";
import { SectionTitle } from "@/components/site/SectionTitle";
import { SmartImage } from "@/components/site/SmartImage";
import type { Content } from "@/lib/types";

export function Seasonal({ seasonal }: { seasonal: Content["seasonal"] }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1.25, 1]);
  const clip = useTransform(scrollYProgress, [0, 0.45], ["inset(12% 10% 12% 10% round 400px 400px 0 0)", "inset(0% 0% 0% 0% round 400px 400px 0 0)"]);
  if (!seasonal.active) return null;
  return (
    <section ref={ref} className="relative overflow-hidden bg-aubergine-950 py-28 sm:py-36">
      <div className="mx-auto grid max-w-[1600px] items-center gap-16 px-6 sm:px-10 lg:grid-cols-2 lg:px-16">
        <div>
          <SectionTitle eyebrow={seasonal.eyebrow} title={seasonal.title} size="lg" />
          <Reveal delay={0.2}>
            <p className="mt-8 max-w-lg text-lg leading-relaxed text-ivory/70">{seasonal.text}</p>
          </Reveal>
          <Reveal delay={0.3} className="mt-10">
            <Countdown target={seasonal.targetDate} />
          </Reveal>
          <Reveal delay={0.4} className="mt-10">
            <Link href={seasonal.ctaLink} className="btn btn-ivory" data-cursor="link">
              <span>{seasonal.ctaLabel}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
        <motion.div className="relative mx-auto aspect-[4/5] w-full max-w-xl overflow-hidden" style={{ clipPath: clip }}>
          <motion.div className="absolute inset-0" style={{ scale }}>
            <SmartImage src={seasonal.image} alt={seasonal.title} fill sizes="(max-width: 1024px) 90vw, 45vw" className="object-cover" />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-t from-aubergine-950/60 to-transparent" />
        </motion.div>
      </div>
    </section>
  );
}
