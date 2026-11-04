"use client";
import { Lock, PackageSearch } from "lucide-react";
import { CATEGORIES } from "@waverti/ui/app";

const SURFACES = [
  "from-[#dfe8ff] to-[#f1f5ff] text-[#1d3fd6]",
  "from-[#ece0ff] to-[#f7f1ff] text-[#6a1fd6]",
  "from-[#d9f3e8] to-[#eef9f4] text-[#0b7350]",
  "from-[#ffe9c2] to-[#fff6e3] text-[#8a3b00]",
  "from-[#ffdce2] to-[#fff0f2] text-[#a8142d]",
];

/** Ce que la formule débloque : les dix types de surveillance réellement disponibles, grisés tant qu'aucune formule n'est active. */
export function Unlockables() {
  return (
    <section aria-labelledby="unlock-title" className="flex flex-col gap-4">
      <div>
        <h2 id="unlock-title" className="font-display text-xl font-semibold">
          Ce que vous débloquez avec une formule
        </h2>
        <p className="mt-1 text-sm text-ink-soft">Dix façons de surveiller, prêtes à l'emploi. Elles s'ouvrent dès que votre formule ou votre essai est actif.</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CATEGORIES.map((c, i) => (
          <li key={c.id} className={`relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-br p-4 shadow-soft ${SURFACES[i % SURFACES.length]}`}>
            <span className="grid size-10 place-items-center rounded-xl bg-white/80 [&_svg]:size-[18px]" aria-hidden="true">
              {c.icon}
            </span>
            <span className="font-medium text-ink">{c.title}</span>
            <span className="text-xs leading-snug text-ink-soft">{c.desc}</span>
            <Lock className="absolute right-3 top-3 size-3.5 text-ink-soft" aria-hidden="true" />
            <span className="sr-only">Se débloque avec une formule</span>
          </li>
        ))}
        <li className="relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-dashed border-line-strong bg-white/50 p-4">
          <span className="grid size-10 place-items-center rounded-xl bg-white/80 text-ink-soft [&_svg]:size-[18px]" aria-hidden="true">
            <PackageSearch />
          </span>
          <span className="font-medium text-ink">Rechercher un produit</span>
          <span className="text-xs leading-snug text-ink-soft">Comparer les boutiques pour un même produit.</span>
          <span className="mt-1 w-fit rounded-full bg-surface-strong px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Bientôt</span>
        </li>
      </ul>
    </section>
  );
}
