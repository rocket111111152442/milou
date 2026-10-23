"use client";

import { ArrowUpRight, Phone } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { DeliveryChecker } from "@/components/site/DeliveryChecker";
import { OpenBadge } from "@/components/site/OpenBadge";
import { SectionTitle } from "@/components/site/SectionTitle";
import { DAYS } from "@/lib/format";
import type { Settings } from "@/lib/types";

const ORDER = [2, 3, 4, 5, 6, 0, 1];

export function MapEmbed({ settings, className = "" }: { settings: Settings; className?: string }) {
  const q = encodeURIComponent(`${settings.shopName}, ${settings.address}, ${settings.postcode} ${settings.city}`);
  return (
    <div className={`relative overflow-hidden rounded-[2rem] border border-ivory/10 ${className}`}>
      <iframe
        title="Plan d'accès à la boutique"
        src={`https://www.google.com/maps?q=${q}&z=16&output=embed`}
        className="absolute inset-0 h-full w-full [filter:grayscale(1)_invert(0.92)_sepia(0.25)_hue-rotate(225deg)_saturate(1.6)_brightness(0.9)]"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-gold/20" />
    </div>
  );
}

export function Visit({ settings }: { settings: Settings }) {
  const today = new Date().getDay();
  return (
    <section id="contact" className="fern-night relative bg-aubergine-950 py-28 sm:py-36">
      <div className="mx-auto grid max-w-[1600px] gap-16 px-6 sm:px-10 lg:grid-cols-2 lg:px-16">
        <div>
          <SectionTitle eyebrow="Nous trouver" title="Poussez la porte" accent="du cabinet de curiosités" size="md" />
          <Reveal delay={0.1} className="mt-8">
            <OpenBadge settings={settings} />
          </Reveal>
          <Reveal delay={0.15} className="mt-8 grid gap-10 sm:grid-cols-2">
            <div>
              <p className="eyebrow mb-3 text-gold/80">Adresse</p>
              <a href={settings.mapsUrl} target="_blank" rel="noreferrer" className="group inline-flex items-start gap-2 font-display text-2xl leading-snug hover:text-gold-light">
                <span>
                  {settings.address}
                  <br />
                  {settings.postcode} {settings.city}
                </span>
                <ArrowUpRight className="mt-1 h-4 w-4 opacity-60 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
              <p className="eyebrow mb-3 mt-8 text-gold/80">Téléphone</p>
              <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-3 font-display text-2xl hover:text-gold-light">
                <Phone className="h-4 w-4" strokeWidth={1.4} /> {settings.phone}
              </a>
            </div>
            <div>
              <p className="eyebrow mb-3 text-gold/80">Horaires</p>
              <dl className="space-y-2 text-sm">
                {ORDER.map((d) => {
                  const h = settings.hours.find((x) => x.day === d);
                  return (
                    <div key={d} className={`flex justify-between gap-4 border-b border-ivory/[0.06] pb-2 ${d === today ? "text-gold-light" : "text-ivory/70"}`}>
                      <dt>{DAYS[d]}</dt>
                      <dd className="tabular-nums">{!h || h.closed ? "Fermé" : h.ranges.map((r) => `${r.from}–${r.to}`).join(" · ")}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </Reveal>
          <Reveal delay={0.25} className="mt-12 max-w-lg">
            <p className="eyebrow mb-4 text-gold/80">Livrons-nous chez vous ?</p>
            <DeliveryChecker />
          </Reveal>
        </div>
        <Reveal delay={0.2} className="min-h-[420px]">
          <MapEmbed settings={settings} className="h-full min-h-[420px]" />
        </Reveal>
      </div>
    </section>
  );
}
