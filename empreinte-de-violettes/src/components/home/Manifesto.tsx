"use client";

import { Counter } from "@/components/motion/Counter";
import { ImageReveal, Parallax, Reveal } from "@/components/motion/Reveal";
import { ScrollWords } from "@/components/motion/ScrollWords";
import { VioletMark } from "@/components/site/Logo";
import { SmartImage } from "@/components/site/SmartImage";
import type { Content } from "@/lib/types";

export function Manifesto({ content }: { content: Content }) {
  const m = content.manifesto;
  return (
    <section id="manifeste" className="fern-paper relative overflow-hidden bg-ivory py-28 text-noir sm:py-36">
      <div className="mx-auto grid max-w-[1600px] gap-16 px-6 sm:px-10 lg:grid-cols-[0.8fr_1.4fr] lg:gap-24 lg:px-16">
        <div className="relative lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <p className="eyebrow flex items-center gap-4 text-aubergine-600">
              <span className="h-px w-8 bg-aubergine-600/50" />
              {m.eyebrow}
            </p>
          </Reveal>
          <Parallax speed={0.08} className="mt-10">
            <ImageReveal className="aspect-[4/5] w-full max-w-sm rounded-t-full">
              <SmartImage src={m.image} alt="Les mains de la fleuriste et une fougère" fill sizes="(max-width: 1024px) 80vw, 30vw" className="object-cover" />
            </ImageReveal>
          </Parallax>
          <VioletMark className="absolute -bottom-6 left-[min(20rem,70%)] h-20 w-20 animate-spin-slow text-aubergine-500/40" strokeWidth={1} />
        </div>
        <div>
          <ScrollWords text={m.text} className="font-display text-[clamp(1.9rem,3.5vw,3.6rem)] font-light leading-[1.18] text-aubergine-900" />
          <Reveal className="mt-10">
            <p className="font-display text-2xl italic text-aubergine-600">{m.signature}</p>
          </Reveal>
          <div className="mt-20 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-noir/10 bg-noir/10 sm:grid-cols-4">
            {content.stats.map((s, i) => (
              <Reveal key={i} delay={i * 0.1} className="bg-ivory/90 p-6 sm:p-8">
                <Counter value={s.value} className="block font-display text-4xl text-aubergine-800 sm:text-5xl" />
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-noir/55">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
