"use client";

import Image from "next/image";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { Counter, Reveal } from "@/components/ui/motion";
import { useSiteData } from "@/components/SettingsProvider";

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  const y = useTransform(progress, range, [6, 0]);
  return (
    <span className="relative mr-[0.25em] inline-block">
      <motion.span style={{ opacity, y }} className="inline-block">
        {children}
      </motion.span>
    </span>
  );
}

export function Story() {
  const { copy, shops } = useSiteData();
  const TEXT = copy.story;
  const textRef = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: textRef, offset: ["start 0.85", "end 0.45"] });
  const words = TEXT.split(" ");

  const imgRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: imgProgress } = useScroll({ target: imgRef, offset: ["start end", "end start"] });
  const r1 = useTransform(imgProgress, [0, 1], [-10, 4]);
  const r2 = useTransform(imgProgress, [0, 1], [12, -2]);
  const y1 = useTransform(imgProgress, [0, 1], [80, -60]);
  const y2 = useTransform(imgProgress, [0, 1], [140, -120]);

  return (
    <section id="maison" className="grain relative scroll-mt-24 bg-farine py-24 sm:py-36">
      <div className="relative z-10 mx-auto grid max-w-7xl gap-16 px-6 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <Reveal>
            <p className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-croute">
              <span className="h-px w-10 bg-croute" /> La maison
            </p>
          </Reveal>
          <p ref={textRef} className="font-display text-[clamp(1.9rem,4.2vw,3.6rem)] leading-[1.12] tracking-tight text-cafe">
            {words.map((w, i) => {
              const start = i / words.length;
              return (
                <Word key={i} progress={scrollYProgress} range={[start, start + 1 / words.length]}>
                  {w}
                </Word>
              );
            })}
          </p>

          <div className="mt-16 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {copy.stats.map((s) => ({
              value: <Counter to={s.value} from={s.from} duration={s.from ? 2.4 : undefined} />,
              suffix: s.suffix,
              label: s.label,
            })).map((s, i) => (
              <Reveal key={i} delay={i * 0.1} className="border-t border-cafe/15 pt-4">
                <p className="font-display text-4xl text-croute sm:text-5xl">
                  {s.value}
                  {s.suffix}
                </p>
                <p className="mt-1 text-sm text-grege">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </div>

        <div ref={imgRef} className="relative min-h-[460px] lg:sticky lg:top-32 lg:col-span-5 lg:self-start">
          <motion.figure
            style={{ rotate: r1, y: y1 }}
            className="absolute left-0 top-0 w-[78%] rounded-sm bg-creme p-3 pb-12 shadow-[0_30px_60px_-25px_rgba(36,22,13,0.55)]"
          >
            <div className="relative aspect-[11/4] overflow-hidden bg-mie">
              <Image src={shops[1]?.image ?? "/images/boutique-2.jpg"} alt={shops[1]?.imageAlt ?? "Intérieur de la boutique"} fill sizes="(min-width:1024px) 30vw, 80vw" className="object-cover" />
            </div>
            <figcaption className="absolute bottom-3 left-4 font-script text-2xl text-cafe">{shops[1] ? `${shops[1].short} · ${shops[1].name}` : "Le comptoir"}</figcaption>
          </motion.figure>
          <motion.figure
            style={{ rotate: r2, y: y2 }}
            className="absolute bottom-0 right-0 w-[72%] rounded-sm bg-creme p-3 pb-12 shadow-[0_30px_60px_-25px_rgba(36,22,13,0.55)]"
          >
            <div className="relative aspect-[27/10] overflow-hidden bg-mie">
              <Image src={shops[0].image} alt={shops[0].imageAlt} fill sizes="(min-width:1024px) 30vw, 80vw" className="object-cover" />
            </div>
            <figcaption className="absolute bottom-3 left-4 font-script text-2xl text-cafe">{shops[0].short} · {shops[0].address.street}</figcaption>
          </motion.figure>
          <div className="absolute -right-4 top-1/3 hidden h-28 w-28 animate-float rounded-full bg-dore/90 text-center font-script text-xl leading-tight text-torref shadow-xl [--r:12deg] sm:grid sm:place-items-center">
            fait
            <br />
            maison
          </div>
        </div>
      </div>
    </section>
  );
}
