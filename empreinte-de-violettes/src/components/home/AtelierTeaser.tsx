"use client";

import { useScroll } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { BouquetArt, TEASER_STEMS } from "@/components/site/BouquetArt";
import { SectionTitle } from "@/components/site/SectionTitle";

export function AtelierTeaser({ basePrice }: { basePrice: string }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "center 0.4"] });
  return (
    <section ref={ref} id="atelier" className="fern-paper relative overflow-hidden bg-paper py-28 text-noir sm:py-36">
      <div className="mx-auto grid max-w-[1600px] items-center gap-16 px-6 sm:px-10 lg:grid-cols-2 lg:px-16">
        <div className="order-2 lg:order-1">
          <SectionTitle eyebrow="L'atelier" title="Composez votre bouquet," accent="tige par tige" tone="light" />
          <Reveal delay={0.15}>
            <p className="mt-8 max-w-lg text-lg leading-relaxed text-noir/70">
              Roses de jardin, renoncules, lavande de Provence, fougère… Choisissez vos fleurs et votre emballage : la fleuriste compose votre création à la main, exactement comme vous l&apos;imaginez.
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <ul className="mt-8 space-y-3 text-sm text-noir/70">
              {["Jusqu'à 30 tiges, fleurs de saison", "Prix calculé en direct", `Composition à partir de ${basePrice}`].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rotate-45 bg-aubergine-600" /> {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.35} className="mt-10">
            <Link href="/atelier" className="btn btn-noir" data-cursor="link">
              <span>Ouvrir l&apos;atelier</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
        <div className="order-1 flex justify-center lg:order-2">
          <BouquetArt stems={TEASER_STEMS} progress={scrollYProgress} wrapColor="#C9A27A" className="w-full max-w-[540px] overflow-visible drop-shadow-[0_30px_40px_rgba(38,21,47,0.25)]" />
        </div>
      </div>
    </section>
  );
}
