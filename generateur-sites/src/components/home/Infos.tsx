"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useState } from "react";
import { shopLinks, type ShopId } from "@/lib/shops";
import { useSiteData } from "@/components/SettingsProvider";
import { useHref } from "@/components/TLink";
import { DAY_NAMES, formatRanges, parisNow } from "@/lib/hours";
import { useCart } from "@/lib/cart";
import { OpenStatus, useOpenStatuses } from "@/components/ui/OpenStatus";
import { PhoneIcon } from "@/components/Header";
import { Reveal, SplitWords } from "@/components/ui/motion";

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const ease = [0.22, 1, 0.36, 1] as const;

export function Infos() {
  const router = useRouter();
  const href = useHref();
  const { shops: SHOPS, copy } = useSiteData();
  const setShop = useCart((s) => s.setShop);
  const statuses = useOpenStatuses();
  const [today, setToday] = useState<number | null>(null);
  const [active, setActive] = useState<ShopId>(SHOPS[0].id);
  const [mapActive, setMapActive] = useState(false);
  useEffect(() => setToday(parisNow().weekday), []);

  const shop = SHOPS.find((s) => s.id === active)!;
  const links = shopLinks(shop);

  return (
    <section id="boutiques" className="grain relative scroll-mt-20 bg-farine py-24 sm:py-36">
      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <Reveal>
          <p className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-croute">
            <span className="h-px w-10 bg-croute" /> {SHOPS.length > 1 ? "Nos boutiques" : "La boutique"}
          </p>
        </Reveal>
        <div className="mb-12 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SplitWords as="h2" text={copy.infoTitle} className="block max-w-3xl font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl" />

          {/* Sélecteur de boutique */}
          {SHOPS.length > 1 && <LayoutGroup>
            <div className="flex gap-2 self-start rounded-full bg-creme p-1.5 ring-1 ring-mie lg:self-auto" role="tablist" aria-label="Choisir une boutique">
              {SHOPS.map((s) => {
                const on = s.id === active;
                return (
                  <button
                    key={s.id}
                    role="tab"
                    aria-selected={on}
                    aria-controls="boutique-panel"
                    onClick={() => {
                      setActive(s.id);
                      setMapActive(false);
                    }}
                    className={`relative flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-colors ${on ? "text-creme" : "text-cafe/70 hover:text-cafe"}`}
                  >
                    {on && <motion.span layoutId="shop-pill" className="absolute inset-0 rounded-full bg-cafe" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                    <span className={`relative h-2 w-2 rounded-full ${statuses?.[s.id]?.open ? "bg-emerald-400" : "bg-croute"}`} aria-hidden="true" />
                    <span className="relative">{s.short}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={shop.id}
            id="boutique-panel"
            role="tabpanel"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease }}
            className="grid gap-6 lg:grid-cols-12"
          >
            {/* Carte d'identité de la boutique */}
            <div className="overflow-hidden rounded-[2rem] bg-cafe text-creme lg:col-span-7">
              <div className="relative aspect-[16/7] overflow-hidden bg-torref">
                <motion.div className="absolute inset-0" initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 1.4, ease }}>
                  <Image src={shop.image} alt={shop.imageAlt} fill sizes="(min-width:1024px) 55vw, 100vw" className="object-cover" />
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-t from-cafe via-cafe/10 to-transparent" />
                <span className="absolute left-5 top-5 rounded-full bg-torref/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-dore backdrop-blur">
                  {shop.city}
                </span>
              </div>
              <div className="grid gap-8 p-7 sm:grid-cols-2 sm:p-9">
                <div>
                  <p className="font-script text-2xl text-dore">{shop.tagline}</p>
                  <h3 className="font-display text-4xl tracking-tight">{shop.name}</h3>
                  <OpenStatus shop={shop} tone="dark" className="mt-4" />
                  <address className="mt-5 not-italic leading-relaxed text-creme/85">
                    {shop.address.street}
                    <br />
                    {shop.address.postalCode} {shop.address.city}
                  </address>
                  {shop.landmark && <p className="mt-1 text-sm text-creme/55">{shop.landmark}</p>}
                  <div className="mt-6 flex flex-wrap gap-2">
                    <a href={shop.phone.href} className="inline-flex items-center gap-2 rounded-full bg-dore px-5 py-3 text-sm font-semibold text-torref transition hover:bg-creme">
                      <PhoneIcon className="h-4 w-4" /> {shop.phone.display}
                    </a>
                    <a
                      href={links.directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-full border border-creme/25 px-5 py-3 text-sm font-semibold transition hover:bg-creme/10"
                    >
                      Itinéraire →
                    </a>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-creme/50">Horaires</p>
                  <ul className="space-y-0.5 text-sm">
                    {ORDER.map((d, i) => {
                      const isToday = d === today;
                      return (
                        <motion.li
                          key={d}
                          initial={{ opacity: 0, x: -14 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.05 }}
                          className={`relative flex items-center justify-between rounded-lg px-3 py-2 ${isToday ? "text-torref" : ""}`}
                        >
                          {isToday && <span className="absolute inset-0 rounded-lg bg-dore" />}
                          <span className="relative font-semibold">{DAY_NAMES[d]}</span>
                          <span className="relative tabular-nums">{formatRanges(shop.hours[d] ?? [])}</span>
                        </motion.li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      setShop(shop.id);
                      router.push(href("/carte"));
                    }}
                    className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-croute px-5 py-3.5 text-sm font-semibold text-creme transition hover:bg-creme hover:text-torref"
                  >
                    Commander, retrait à {shop.short} →
                  </button>
                </div>
              </div>
            </div>

            {/* Plan */}
            <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] ring-1 ring-mie lg:col-span-5">
              <iframe
                key={shop.id}
                title={`Plan d'accès : ${shop.name}, ${shop.city}`}
                src={links.mapEmbedUrl}
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
            </div>

            {/* Services */}
            <div className="flex flex-wrap gap-3 lg:col-span-12">
              {shop.services.map((label, i) => (
                <motion.span
                  key={label}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.2 + i * 0.06 }}
                  whileHover={{ y: -4, rotate: -2 }}
                  className="inline-flex items-center gap-2 rounded-full bg-creme px-5 py-3 text-sm font-semibold ring-1 ring-mie"
                >
                  {label}
                </motion.span>
              ))}
              <span className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-grege line-through decoration-croute/60">Livraison</span>
            </div>
          </motion.div>
        </AnimatePresence>
        <p className="mt-6 text-xs text-grege">Horaires indicatifs : un doute un jour férié ? Un coup de fil suffit.</p>
      </div>

      {/* Bandeau photo */}
      <div className="relative z-10 mx-auto mt-24 max-w-7xl px-6">
        <Reveal className="relative overflow-hidden rounded-[2rem]">
          <div className="relative aspect-[16/9] sm:aspect-[21/9]">
            <Image src="/images/vitrine.jpg" alt="" fill sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-torref/85 via-torref/45 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-center p-8 text-creme sm:p-14">
              <p className="font-script text-3xl text-dore sm:text-4xl">{copy.bandText}</p>
              <p className="mt-2 max-w-md font-display text-3xl leading-tight sm:text-5xl">Du frais, chaque jour, tout près de chez vous.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
