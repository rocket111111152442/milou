"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SmartImage } from "@/components/site/SmartImage";

type Item = { href: string; title: string; text: string; image: string };

function Card({ item, i, total }: { item: Item; i: number; total: number }) {
  return (
    <Link href={item.href} className="group relative block h-full w-[78vw] shrink-0 sm:w-[46vw] lg:w-[34vw]" data-cursor="view" data-cursor-label="Explorer">
      <div className="relative h-[58vh] overflow-hidden rounded-t-full">
        <SmartImage src={item.image} alt={item.title} fill sizes="(max-width: 1024px) 80vw, 34vw" className="object-cover transition duration-[1.6s] ease-silk group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
        <div className="absolute inset-0 rounded-t-full ring-1 ring-inset ring-gold/0 transition duration-700 group-hover:ring-gold/60" />
        <span className="absolute left-1/2 top-10 -translate-x-1/2 font-caps text-[0.6rem] tracking-[0.3em] text-ivory/70">
          {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>
      <div className="mt-6 flex items-start justify-between gap-6">
        <div>
          <h3 className="font-display text-4xl font-light transition group-hover:italic group-hover:text-gold-light sm:text-5xl">{item.title}</h3>
          <p className="mt-2 max-w-sm text-sm text-ivory/55">{item.text}</p>
        </div>
        <span className="mt-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ivory/20 transition duration-500 group-hover:rotate-45 group-hover:border-gold group-hover:bg-gold group-hover:text-noir">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      </div>
    </Link>
  );
}

/** Défilement horizontal épinglé (desktop) — glissement natif sur mobile. */
export function Univers({ items }: { items: Item[] }) {
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);
  const bar = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  useEffect(() => {
    const measure = () => {
      if (!track.current) return;
      setDistance(Math.max(0, track.current.scrollWidth - window.innerWidth + 64));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <>
      {/* desktop */}
      <section ref={ref} className="relative hidden bg-noir lg:block" style={{ height: `calc(100vh + ${distance}px)` }}>
        <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
          <div className="mx-auto mb-10 flex w-full max-w-[1600px] items-end justify-between px-16">
            <div>
              <p className="eyebrow flex items-center gap-4 text-gold">
                <span className="h-px w-8 bg-gold/60" />
                Nos univers
              </p>
              <h2 className="h-display mt-4 text-[clamp(2.6rem,5vw,5.2rem)]">
                Un jardin, <em className="text-gold-light">mille histoires</em>
              </h2>
            </div>
            <div className="h-px w-64 bg-ivory/15">
              <motion.div className="h-px bg-gold" style={{ width: bar }} />
            </div>
          </div>
          <motion.div ref={track} style={{ x }} className="flex gap-10 pl-16 pr-16">
            {items.map((it, i) => (
              <Card key={it.href} item={it} i={i} total={items.length} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* mobile & tablette */}
      <section className="bg-noir py-24 lg:hidden">
        <div className="px-6 sm:px-10">
          <p className="eyebrow flex items-center gap-4 text-gold">
            <span className="h-px w-8 bg-gold/60" />
            Nos univers
          </p>
          <h2 className="h-display mt-4 text-5xl">
            Un jardin, <em className="text-gold-light">mille histoires</em>
          </h2>
        </div>
        <div className="mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-4 no-scrollbar sm:px-10" data-lenis-prevent>
          {items.map((it, i) => (
            <div key={it.href} className="snap-start">
              <Card item={it} i={i} total={items.length} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
