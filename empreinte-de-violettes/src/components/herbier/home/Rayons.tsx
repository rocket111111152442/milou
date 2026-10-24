"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { SmartImage } from "@/components/site/SmartImage";
import type { PlateName } from "@/lib/plates";
import { EASE, RunningHead, roman, Words } from "../Elements";
import { Plate } from "../Plate";

export type Rayon = { href: string; name: string; note: string; count: string; image: string; plate: PlateName };

/** Le sommaire de la boutique : une table des matières, avec l'aperçu de chaque rayon au survol. */
export function Rayons({ rayons }: { rayons: Rayon[] }) {
  const [i, setI] = useState(0);
  const r = rayons[i] || rayons[0];
  return (
    <section className="h-paper-deep py-24 sm:py-32">
      <div className="wrap">
        <RunningHead left="Sommaire de la boutique" right="II" />
        <div className="mt-14 grid gap-14 lg:grid-cols-[1.35fr_1fr] lg:gap-20">
          <div>
            <h2 className="h-section max-w-[14ch]">
              <Words text="Ce que l'on trouve" /> <em><Words text="entre nos murs" delay={0.12} /></em>
            </h2>
            <ol className="mt-12 border-t border-ink/15">
              {rayons.map((x, k) => (
                <motion.li
                  key={x.href}
                  className="border-b border-ink/15"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.9, ease: EASE, delay: k * 0.05 }}
                >
                  <Link href={x.href} onMouseEnter={() => setI(k)} onFocus={() => setI(k)} className="group flex items-baseline gap-4 py-4 sm:py-5">
                    <span className="w-9 shrink-0 font-text text-[0.85rem] italic text-ink-muted">{roman(k + 1)}.</span>
                    <span className="min-w-0">
                      <span className={`block font-display text-[clamp(1.55rem,3vw,2.35rem)] leading-none transition duration-500 ${k === i ? "italic" : ""}`}>{x.name}</span>
                      <span className="mt-1.5 block font-text text-[0.92rem] italic text-ink-muted lg:hidden">{x.note}</span>
                    </span>
                    <span className="leader" />
                    <span className="hidden max-w-[21rem] truncate font-text text-[0.92rem] italic text-ink-muted lg:block">{x.note}</span>
                    <span className="tab shrink-0 font-text text-[0.92rem] text-ink-soft">{x.count}</span>
                  </Link>
                </motion.li>
              ))}
            </ol>
          </div>

          <div className="relative hidden lg:block">
            <div className="sticky top-28">
              <div className="sheet relative p-4">
                <span className="tape -top-2 left-10 -rotate-3" />
                <span className="tape -top-2 right-10 rotate-2" />
                <div className="relative aspect-[4/5] overflow-hidden bg-paper-deep">
                  <AnimatePresence initial={false}>
                    <motion.div key={r.image} className="absolute inset-0" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: EASE }}>
                      <SmartImage src={r.image} alt="" fill sizes="35vw" className="tirage object-cover" />
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="mt-4 flex items-baseline justify-end gap-3 pl-28">
                  <p className="folio text-ink-muted">Rayon {roman(i + 1)} —</p>
                  <AnimatePresence mode="wait">
                    <motion.p key={r.name} className="font-display text-[1.4rem] italic" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.4 }}>
                      {r.name}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
              <div className="pointer-events-none absolute -bottom-14 -left-16 w-40 text-plum">
                <AnimatePresence mode="wait">
                  <motion.div key={r.plate} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                    <Plate name={r.plate} reveal="mount" duration={1.2} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
