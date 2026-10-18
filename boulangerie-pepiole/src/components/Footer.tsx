"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { SITE } from "@/lib/site";
import { DAY_NAMES, OPENING_HOURS, formatTime } from "@/lib/hours";
import { Monogram } from "@/components/ui/Logo";

export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const y = useTransform(scrollYProgress, [0, 1], ["35%", "0%"]);
  const opacity = useTransform(scrollYProgress, [0.2, 1], [0, 1]);
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <footer ref={ref} className="grain relative overflow-hidden bg-torref text-creme">
      <div className="relative z-10 mx-auto grid max-w-7xl gap-12 px-6 pb-10 pt-24 md:grid-cols-12">
        <div className="md:col-span-5">
          <Monogram className="h-14 w-14 text-dore" />
          <p className="mt-6 max-w-sm font-display text-3xl leading-tight">
            Du pain chaud, tous les jours, à deux pas de la gare.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={SITE.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-creme/20 px-5 py-3 text-sm font-semibold transition hover:border-dore hover:text-dore"
            >
              <InstagramIcon className="h-4 w-4" /> {SITE.instagram.handle}
            </a>
            <a
              href={SITE.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-dore px-5 py-3 text-sm font-semibold text-torref transition hover:bg-creme"
            >
              Itinéraire →
            </a>
          </div>
        </div>

        <div className="md:col-span-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-creme/50">Nous trouver</p>
          <address className="mt-4 not-italic leading-relaxed text-creme/85">
            {SITE.address.street}
            <br />
            {SITE.address.postalCode} {SITE.address.city}
            <br />
            <span className="text-creme/55">{SITE.address.landmark}</span>
          </address>
          <a href={SITE.phone.href} className="mt-4 inline-block font-display text-2xl text-dore hover:underline">
            {SITE.phone.display}
          </a>
        </div>

        <div className="md:col-span-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-creme/50">Horaires</p>
          <ul className="mt-4 space-y-1.5 text-sm">
            {order.map((d) => (
              <li key={d} className="flex justify-between gap-4 border-b border-creme/10 pb-1.5">
                <span className="text-creme/70">{DAY_NAMES[d]}</span>
                <span className="tabular-nums">
                  {OPENING_HOURS[d].map(([o, c]) => `${formatTime(o)} – ${formatTime(c)}`).join(" · ") || "Fermé"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <motion.div style={{ y, opacity }} className="relative z-10 select-none px-4" aria-hidden="true">
        <p className="whitespace-nowrap text-center font-display text-[13.5vw] font-semibold leading-[0.85] tracking-tighter text-creme/[0.07]">
          Pétrin de Pépiole
        </p>
      </motion.div>

      <div className="relative z-10 border-t border-creme/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 pb-24 pt-6 text-xs text-creme/50 sm:flex-row sm:pb-6 sm:pr-64">
          <p>
            © {new Date().getFullYear()} {SITE.legal.company} — {SITE.name}
          </p>
          <nav className="flex gap-5" aria-label="Liens légaux">
            <Link href="/mentions-legales" className="hover:text-creme">
              Mentions légales & confidentialité
            </Link>
            <Link href="/carte" className="hover:text-creme">
              La carte
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export function InstagramIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
    </svg>
  );
}
