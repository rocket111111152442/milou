"use client";

import Image from "next/image";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { SplitWords } from "@/components/ui/motion";

const STEPS = [
  {
    n: "01",
    title: "Pétrir",
    text: "Farine, eau, sel, levain. Le pétrissage donne sa force à la pâte ; la patience lui donne son goût.",
    image: "/images/petrir.jpg",
    alt: "Mains qui pétrissent une pâte à pain",
  },
  {
    n: "02",
    title: "Façonner",
    text: "Chaque pâton est façonné à la main : baguettes, boules, bâtards. Puis vient le temps de la pousse.",
    image: "/images/faconner.jpg",
    alt: "Pâtons façonnés en boules sur le plan de travail",
  },
  {
    n: "03",
    title: "Cuire",
    text: "Un coup de lame, la sole bien chaude, et la croûte se met à chanter. Direct du four au comptoir.",
    image: "/images/cuire.jpg",
    alt: "Pain doré entouré d'un nuage de farine",
    position: "object-[85%_center]",
  },
];

function Panel({ step, i, progress }: { step: (typeof STEPS)[number]; i: number; progress: MotionValue<number> }) {
  const seg = 1 / STEPS.length;
  const imgScale = useTransform(progress, [i * seg - seg, i * seg + seg], [1.25, 1]);
  const clip = useTransform(progress, [i * seg - seg * 0.9, i * seg], ["inset(12% 8% 12% 8% round 2rem)", "inset(0% 0% 0% 0% round 2rem)"]);
  return (
    <article className="flex h-full w-screen shrink-0 items-center px-6 lg:px-16">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-2 lg:gap-20">
        <motion.div style={{ clipPath: i === 0 ? undefined : clip }} className="relative aspect-[4/5] max-h-[70vh] w-full overflow-hidden rounded-[2rem]">
          <motion.div style={{ scale: imgScale }} className="absolute inset-0">
            <Image src={step.image} alt={step.alt} fill sizes="(min-width:1024px) 45vw, 90vw" className={`object-cover ${"position" in step ? step.position : ""}`} />
          </motion.div>
          <span className="absolute left-6 top-6 rounded-full bg-torref/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-creme backdrop-blur">
            Étape {step.n}
          </span>
        </motion.div>
        <div>
          <p className="font-display text-[clamp(5rem,14vw,12rem)] leading-none text-outline text-dore/60">{step.n}</p>
          <h3 className="-mt-6 font-display text-6xl tracking-tight text-creme sm:text-7xl">{step.title}</h3>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-creme/70">{step.text}</p>
        </div>
      </div>
    </article>
  );
}

export function SavoirFaire() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], ["0vw", `-${(STEPS.length - 1) * 100}vw`]);
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="savoir-faire" className="scroll-mt-0 bg-torref text-creme">
      <div className="mx-auto max-w-7xl px-6 pb-10 pt-24 sm:pt-32">
        <p className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-dore">
          <span className="h-px w-10 bg-dore" /> Le savoir-faire
        </p>
        <SplitWords as="h2" text="Trois gestes, répétés chaque matin." className="block max-w-3xl font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl" />
      </div>

      {/* Desktop : défilement horizontal épinglé */}
      <div ref={ref} className="relative hidden lg:block" style={{ height: `${STEPS.length * 100}vh` }}>
        <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
          <motion.div style={{ x }} className="flex h-[80vh]">
            {STEPS.map((s, i) => (
              <Panel key={s.n} step={s} i={i} progress={scrollYProgress} />
            ))}
          </motion.div>
          <div className="mx-auto mt-6 h-[2px] w-full max-w-7xl bg-creme/10 px-6">
            <motion.div className="h-full origin-left bg-dore" style={{ scaleX: bar }} />
          </div>
        </div>
      </div>

      {/* Mobile : empilé */}
      <div className="flex flex-col gap-16 px-6 pb-24 lg:hidden">
        {STEPS.map((s) => (
          <motion.article
            key={s.n}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem]">
              <Image src={s.image} alt={s.alt} fill sizes="90vw" className={`object-cover ${"position" in s ? s.position : ""}`} />
            </div>
            <p className="mt-6 font-display text-7xl leading-none text-outline text-dore/60">{s.n}</p>
            <h3 className="-mt-3 font-display text-5xl text-creme">{s.title}</h3>
            <p className="mt-4 text-lg leading-relaxed text-creme/70">{s.text}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
