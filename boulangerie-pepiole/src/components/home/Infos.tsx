"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { SITE } from "@/lib/site";
import { DAY_NAMES, OPENING_HOURS, formatTime, parisNow } from "@/lib/hours";
import { OpenStatus } from "@/components/ui/OpenStatus";
import { PhoneIcon } from "@/components/Header";
import { Reveal, SplitWords } from "@/components/ui/motion";

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const SERVICES = [
  { label: "Vente à emporter", icon: "🥖" },
  { label: "Parking", icon: "🅿️" },
  { label: "Accès fauteuil roulant", icon: "♿" },
  { label: "Pause café", icon: "☕" },
  { label: "Ouvert le dimanche", icon: "☀️" },
];

export function Infos() {
  const [today, setToday] = useState<number | null>(null);
  const [mapActive, setMapActive] = useState(false);
  useEffect(() => setToday(parisNow().weekday), []);

  return (
    <section id="infos" className="grain relative scroll-mt-20 bg-farine py-24 sm:py-36">
      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <Reveal>
          <p className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-croute">
            <span className="h-px w-10 bg-croute" /> Infos pratiques
          </p>
        </Reveal>
        <SplitWords as="h2" text="On vous attend, four chaud." className="mb-14 block max-w-3xl font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl" />

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Horaires */}
          <Reveal className="rounded-[2rem] bg-creme p-7 ring-1 ring-mie sm:p-9 lg:col-span-5">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-3xl">Horaires</h3>
              <OpenStatus />
            </div>
            <ul className="space-y-1">
              {ORDER.map((d, i) => {
                const isToday = d === today;
                return (
                  <motion.li
                    key={d}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className={`relative flex items-center justify-between rounded-xl px-4 py-3 ${isToday ? "text-creme" : ""}`}
                  >
                    {isToday && (
                      <motion.span layoutId="today" className="absolute inset-0 -z-0 rounded-xl bg-cafe" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                    )}
                    <span className="relative font-semibold">
                      {DAY_NAMES[d]}
                      {isToday && <span className="ml-2 text-xs font-bold uppercase tracking-wider text-dore">aujourd&apos;hui</span>}
                    </span>
                    <span className="relative tabular-nums">
                      {OPENING_HOURS[d].map(([o, c]) => `${formatTime(o)} – ${formatTime(c)}`).join(" · ") || "Fermé"}
                    </span>
                  </motion.li>
                );
              })}
            </ul>
            <p className="mt-5 text-xs text-grege">Horaires indicatifs : un doute un jour férié ? Un coup de fil suffit.</p>
          </Reveal>

          {/* Adresse + carte */}
          <div className="grid gap-6 lg:col-span-7">
            <Reveal delay={0.1} className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-[2rem] bg-cafe p-7 text-creme sm:p-9">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-creme/50">Adresse</p>
                <address className="mt-3 font-display text-2xl not-italic leading-snug">
                  {SITE.address.street}
                  <br />
                  {SITE.address.postalCode} {SITE.address.city}
                </address>
                <p className="mt-2 text-sm text-creme/60">{SITE.address.landmark}</p>
                <a
                  href={SITE.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex rounded-full bg-dore px-5 py-3 text-sm font-semibold text-torref transition hover:bg-creme"
                >
                  Itinéraire →
                </a>
              </div>
              <div className="flex flex-col rounded-[2rem] bg-dore p-7 text-torref sm:p-9">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-torref/60">Téléphone</p>
                <a href={SITE.phone.href} className="mt-3 font-display text-3xl hover:underline">
                  {SITE.phone.display}
                </a>
                <p className="mt-2 text-sm text-torref/70">Pour une grosse commande ou une question.</p>
                <a
                  href={SITE.phone.href}
                  className="mt-auto inline-flex items-center gap-2 self-start rounded-full bg-torref px-5 py-3 text-sm font-semibold text-creme transition hover:bg-cafe"
                >
                  <PhoneIcon className="h-4 w-4" /> Appeler
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.2} className="relative min-h-[320px] overflow-hidden rounded-[2rem] ring-1 ring-mie">
              <iframe
                title="Plan d'accès au Pétrin de Pépiole"
                src={SITE.mapEmbedUrl}
                className={`absolute inset-0 h-full w-full border-0 transition duration-700 ${mapActive ? "" : "pointer-events-none grayscale-[60%] sepia-[25%]"}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              {!mapActive && (
                <button
                  type="button"
                  onClick={() => setMapActive(true)}
                  className="absolute inset-0 flex items-end justify-start bg-gradient-to-t from-torref/40 to-transparent p-5"
                  aria-label="Activer la carte interactive"
                >
                  <span className="rounded-full bg-creme px-4 py-2 text-sm font-semibold text-cafe shadow">Cliquer pour explorer la carte</span>
                </button>
              )}
            </Reveal>
          </div>
        </div>

        {/* Services */}
        <div className="mt-6 flex flex-wrap gap-3">
          {SERVICES.map((s, i) => (
            <motion.span
              key={s.label}
              initial={{ opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: i * 0.07 }}
              whileHover={{ y: -4, rotate: -2 }}
              className="inline-flex items-center gap-2 rounded-full bg-creme px-5 py-3 text-sm font-semibold ring-1 ring-mie"
            >
              <span aria-hidden="true">{s.icon}</span> {s.label}
            </motion.span>
          ))}
          <span className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-grege line-through decoration-croute/60">
            Livraison
          </span>
        </div>
      </div>

      {/* Sanary */}
      <div className="relative z-10 mx-auto mt-24 max-w-7xl px-6">
        <Reveal className="relative overflow-hidden rounded-[2rem]">
          <div className="relative aspect-[16/9] sm:aspect-[21/9]">
            <Image src="/images/sanary-port.jpg" alt="Le port de Sanary-sur-Mer, ses palmiers et son clocher" fill sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-mer/80 via-mer/30 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-center p-8 text-creme sm:p-14">
              <p className="font-script text-3xl text-dore sm:text-4xl">Avant la plage, après le marché</p>
              <p className="mt-2 max-w-md font-display text-3xl leading-tight sm:text-5xl">Une baguette sous le bras, direction le port.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
