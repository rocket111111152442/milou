"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import type { Product } from "@/lib/catalog";
import { ChoiceDialog } from "@/components/cart/ChoiceDialog";
import { formatPrice } from "@/lib/catalog";
import { useSiteData } from "@/components/SettingsProvider";
import { useCart } from "@/lib/cart";
import { flyToCart } from "@/components/cart/FlyToCart";
import { Reveal, SplitWords } from "@/components/ui/motion";

const TONES = ["bg-dore text-torref", "bg-olive text-creme", "bg-croute text-creme"];
const KICKERS: Record<string, string> = { "formule-ptit-dej": "Le matin", "formule-dejeuner": "Le midi" };

export function Formules() {
  const add = useCart((s) => s.add);
  const { products } = useSiteData();
  const [choosing, setChoosing] = useState<Product | null>(null);
  // Toutes les formules de la carte (celles d'origine et celles ajoutées depuis /admin), rangées par rayon « Formules »
  const formules = products.filter((p) => p.category === "formules");
  if (formules.length === 0) return null;
  const addFormule = (p: Product, el: HTMLElement | null, picks?: string[]) => {
    add(p.id, 1, picks);
    flyToCart(el, p.image ?? "/images/pause-cafe.jpg");
  };
  return (
    <section className="relative overflow-hidden bg-farine py-24 sm:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <p className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-croute">
            <span className="h-px w-10 bg-croute" /> Les formules
          </p>
        </Reveal>
        <SplitWords as="h2" text="Une pause, à toute heure." className="mb-14 block max-w-2xl font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl" />

        <div className="grid gap-6 lg:grid-cols-2">
          {formules.map((p, i) => {
            const f = {
              kicker: KICKERS[p.id] ?? "Formule",
              tone: TONES[i % TONES.length],
              stamp: p.groups?.length ? p.groups.map((g) => g.label).join(" + ") : (p.unit ?? ""),
            };
            return (
              <Reveal key={p.id} delay={(i % 2) * 0.15}>
                <article className="group relative overflow-hidden rounded-[2rem] bg-creme ring-1 ring-mie">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image src={p.image ?? "/images/pause-cafe.jpg"} alt={p.name} fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover transition-transform duration-[1.4s] ease-[var(--ease-pain)] group-hover:scale-105" />
                    <motion.div
                      className={`absolute right-5 top-5 grid h-28 w-28 place-items-center rounded-full text-center shadow-xl ${f.tone}`}
                      initial={{ rotate: -30, scale: 0 }}
                      whileInView={{ rotate: -12, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ type: "spring", stiffness: 160, damping: 12, delay: 0.3 + i * 0.15 }}
                    >
                      <span>
                        <span className="block font-display text-2xl leading-none">{formatPrice(p.price)}</span>
                        <span className="mt-1 block px-3 text-[10px] font-bold uppercase leading-tight tracking-wider">{f.stamp}</span>
                      </span>
                    </motion.div>
                  </div>
                  <div className="flex flex-col gap-5 p-7 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="font-script text-2xl text-caramel">{f.kicker}</p>
                      <h3 className="font-display text-4xl tracking-tight">{p.name}</h3>
                      <p className="mt-2 max-w-sm text-cafe/70">{p.description}</p>
                    </div>
                    {p.available === false ? (
                      <span className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-mie/60 px-6 text-sm font-semibold text-grege">Indisponible</span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => (p.groups?.length ? setChoosing(p) : addFormule(p, e.currentTarget))}
                        className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-cafe px-6 text-sm font-semibold text-creme transition hover:bg-croute"
                      >
                        {p.groups?.length ? "Composer" : "+ Ajouter"}
                      </button>
                    )}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
      <AnimatePresence>
        {choosing && <ChoiceDialog product={choosing} onClose={() => setChoosing(null)} onConfirm={(picks) => { addFormule(choosing, null, picks); setChoosing(null); }} />}
      </AnimatePresence>
    </section>
  );
}

/** Bandeau « gâteaux sur commande » avec image en parallaxe. */
export function GateauxCta() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-15%", "15%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.88, 1]);
  const radius = useTransform(scrollYProgress, [0, 0.5], ["4rem", "0rem"]);

  return (
    <section ref={ref} className="bg-farine">
      <motion.div style={{ scale, borderRadius: radius }} className="relative overflow-hidden">
        <motion.div style={{ y }} className="absolute inset-[-15%_0]">
          <Image src="/images/vitrine.jpg" alt="Vitrine de pâtisseries" fill sizes="100vw" className="object-cover" />
        </motion.div>
        <div className="absolute inset-0 bg-torref/65" />
        <div className="relative mx-auto flex min-h-[80vh] max-w-7xl flex-col justify-center px-6 py-28 text-creme">
          <p className="font-script text-4xl text-dore">Anniversaire, repas de famille, brunch…</p>
          <SplitWords as="h2" text="Vos gâteaux, préparés pour vous." className="mt-3 block max-w-3xl font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl" />
          <Reveal delay={0.3}>
            <p className="mt-6 max-w-xl text-lg text-creme/80">
              Number cakes, tropézienne, fraisier, entremets, plateaux de viennoiseries : commandez en ligne 48 à 72 h
              à l&apos;avance et récupérez-les à Sanary ou à Six-Fours, au créneau de votre choix.
            </p>
            <Link
              href="/carte?rayon=gateaux"
              className="mt-10 inline-flex h-14 items-center gap-3 rounded-full bg-dore px-8 font-semibold text-torref transition hover:bg-creme"
            >
              Voir les gâteaux à partager →
            </Link>
          </Reveal>
        </div>
      </motion.div>
    </section>
  );
}
