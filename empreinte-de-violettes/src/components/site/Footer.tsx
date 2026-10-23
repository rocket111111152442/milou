"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { DAYS } from "@/lib/format";
import type { Settings } from "@/lib/types";
import { Newsletter } from "./Newsletter";
import { FacebookIcon, InstagramIcon } from "./Social";
import { VioletMark } from "./Logo";

const ORDER = [2, 3, 4, 5, 6, 0, 1];

export function Footer({ settings, categories }: { settings: Settings; categories: { href: string; label: string }[] }) {
  const word = "Empreinte de Violettes";
  return (
    <footer className="fern-night relative overflow-hidden bg-ink pt-24 text-ivory">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-16">
        <div className="grid gap-14 border-b border-ivory/10 pb-16 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
          <div>
            <VioletMark className="h-12 w-12 text-gold" />
            <p className="mt-6 max-w-sm font-display text-3xl font-light leading-tight">
              La lettre de la Maison, <em className="text-gold-light">au fil des saisons</em>
            </p>
            <p className="mt-3 max-w-sm text-sm text-ivory/55">Arrivages, éditions limitées et coulisses de l&apos;atelier. Une lettre par mois, jamais plus.</p>
            <Newsletter />
          </div>

          <div>
            <p className="eyebrow mb-5 text-gold/80">Boutique</p>
            <ul className="space-y-2.5 text-sm text-ivory/70">
              {categories.map((c) => (
                <li key={c.href}>
                  <Link href={c.href} className="link-line hover:text-ivory">
                    {c.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/atelier" className="link-line hover:text-ivory">
                  Composer un bouquet
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="eyebrow mb-5 text-gold/80">La Maison</p>
            <ul className="space-y-2.5 text-sm text-ivory/70">
              {[
                ["/la-maison", "Notre histoire"],
                ["/mariage", "Mariages"],
                ["/deuil", "Deuil & hommage"],
                ["/livraison", "Livraison & retrait"],
                ["/suivi", "Suivre ma commande"],
                ["/faq", "Questions fréquentes"],
                ["/contact", "Contact"],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="link-line hover:text-ivory">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="eyebrow mb-5 text-gold/80">Nous rendre visite</p>
            <a href={settings.mapsUrl} target="_blank" rel="noreferrer" className="group flex items-start gap-2 text-sm text-ivory/80 hover:text-ivory">
              <span>
                {settings.address}
                <br />
                {settings.postcode} {settings.city}
              </span>
              <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 opacity-50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
            </a>
            <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="mt-3 block font-display text-2xl text-ivory hover:text-gold-light">
              {settings.phone}
            </a>
            <dl className="mt-5 space-y-1 text-xs text-ivory/55">
              {ORDER.map((d) => {
                const h = settings.hours.find((x) => x.day === d);
                return (
                  <div key={d} className="flex justify-between gap-4">
                    <dt>{DAYS[d]}</dt>
                    <dd className="tabular-nums">{!h || h.closed ? "Fermé" : h.ranges.map((r) => `${r.from}–${r.to}`).join(" · ")}</dd>
                  </div>
                );
              })}
            </dl>
            <div className="mt-6 flex gap-3">
              <a href={settings.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="rounded-full border border-ivory/15 p-2.5 transition hover:border-gold hover:text-gold">
                <InstagramIcon className="h-4 w-4" />
              </a>
              <a href={settings.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="rounded-full border border-ivory/15 p-2.5 transition hover:border-gold hover:text-gold">
                <FacebookIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-[1600px] select-none overflow-hidden px-4 pt-10" aria-hidden>
        <motion.p
          className="whitespace-nowrap text-center font-caps text-[clamp(1.05rem,5.5vw,7.6rem)] uppercase leading-none tracking-[0.04em]"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          transition={{ staggerChildren: 0.12 }}
        >
          {word.split(" ").map((w, i) => (
            <span key={i} className="inline-block overflow-hidden pb-[0.06em] align-bottom">
              <motion.span
                className="text-foil inline-block"
                variants={{ hidden: { y: "105%" }, show: { y: "0%", transition: { duration: 1.3, ease: [0.22, 1, 0.36, 1] } } }}
              >
                {w}
              </motion.span>
              {i < 2 && "\u00a0"}
            </span>
          ))}
        </motion.p>
      </div>

      <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-4 px-6 py-8 text-[0.7rem] text-ivory/40 sm:flex-row sm:px-10 lg:px-16">
        <p>
          © {new Date().getFullYear()} {settings.legalName} · Artisane fleuriste · SIRET {settings.siret}
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-label="Liens légaux">
          <Link href="/mentions-legales" className="hover:text-ivory">
            Mentions légales
          </Link>
          <Link href="/cgv" className="hover:text-ivory">
            CGV
          </Link>
          <Link href="/confidentialite" className="hover:text-ivory">
            Confidentialité
          </Link>
          <span>Paiement sécurisé Stripe</span>
          <Link href="/admin" className="hover:text-ivory">
            Espace fleuriste
          </Link>
        </nav>
      </div>
    </footer>
  );
}
