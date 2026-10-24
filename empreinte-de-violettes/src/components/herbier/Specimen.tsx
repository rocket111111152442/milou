"use client";

import Link from "next/link";
import { SmartImage } from "@/components/site/SmartImage";
import { cn } from "@/lib/cn";
import { euro } from "@/lib/format";
import type { PlateName } from "@/lib/plates";
import { roman } from "./Elements";
import { Plate } from "./Plate";

export type SpecimenProduct = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  price: number;
  compareAtPrice?: number | null;
  variants: { price: number }[];
  images: string[];
  isNew: boolean;
  seasonal: boolean;
  stock: number | null;
  plate: PlateName;
  category?: string;
  number: number;
};

export const fromPrice = (p: { price: number; variants: { price: number }[] }) => (p.variants.length ? Math.min(...p.variants.map((v) => v.price)) : p.price);

/**
 * Une création présentée comme une planche d'herbier : photo maintenue par deux bandelettes,
 * numéro de planche et étiquette. `hover="plate"` : au survol, la photo s'efface et laisse la gravure.
 */
export function Specimen({ p, hover = "photo", priority, sizes, className }: { p: SpecimenProduct; hover?: "photo" | "plate"; priority?: boolean; sizes?: string; className?: string }) {
  const soldOut = p.stock != null && p.stock <= 0;
  const note = soldOut ? "épuisé" : p.isNew ? "nouveauté" : p.seasonal ? "de saison" : p.stock != null && p.stock <= 3 ? "dernières pièces" : null;
  const from = fromPrice(p);
  return (
    <Link href={`/boutique/${p.slug}`} className={cn("group block", className)} aria-label={`${p.name} — ${p.subtitle}, ${p.variants.length > 1 ? "à partir de " : ""}${euro(from)}`}>
      <article className="sheet relative px-3 pb-4 pt-3 transition-[transform,box-shadow] duration-700 ease-silk group-hover:-translate-y-1 sm:px-4 sm:pt-4">
        <div className="relative">
          <span className="tape -top-2 left-[14%] -rotate-[4deg]" aria-hidden />
          <span className="tape -top-2 right-[14%] rotate-[3deg]" aria-hidden />
          <div className="relative aspect-[4/5] overflow-hidden bg-paper-deep">
            {hover === "plate" && <Plate name={p.plate} fit="contain" reveal="none" className="absolute inset-[8%] text-ink-soft" />}
            <div
              className={cn(
                "absolute inset-0",
                hover === "plate" && "transition-[clip-path] duration-[1100ms] ease-[cubic-bezier(0.77,0,0.18,1)] [clip-path:inset(0_0_0_0)] group-hover:[clip-path:inset(0_0_100%_0)]",
                soldOut && "opacity-60 grayscale",
              )}
            >
              {p.images[0] ? (
                <SmartImage src={p.images[0]} alt="" fill priority={priority} sizes={sizes || "(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"} className="tirage object-cover transition duration-[1.6s] ease-silk group-hover:scale-[1.035]" />
              ) : (
                <Plate name={p.plate} fit="contain" reveal="none" className="absolute inset-[8%] text-ink-soft" />
              )}
              {hover === "photo" && p.images[1] && (
                <SmartImage src={p.images[1]} alt="" fill sizes={sizes || "(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"} className="tirage object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[auto_1fr] items-end gap-3 sm:gap-4">
          <div className="pb-1 leading-tight">
            <p className="folio text-ink-muted">Pl. {roman(p.number)}</p>
            {note && <p className="font-text text-[0.78rem] italic text-plum">{note}</p>}
          </div>
          <div className="herb-label min-w-0 px-3 py-2.5">
            <h3 className="truncate font-display text-[1.32rem] leading-tight transition-[font-style] group-hover:italic">{p.name}</h3>
            <p className="truncate font-text text-[0.86rem] italic text-ink-muted">{p.subtitle}</p>
            <div className="mt-1.5 flex items-baseline font-text text-[0.9rem]">
              <span className="truncate text-[0.62rem] uppercase tracking-[0.18em] text-ink-muted">{p.category}</span>
              <span className="leader !min-w-[0.75rem]" />
              <span className="tab shrink-0">
                {p.variants.length > 1 && <span className="italic text-ink-muted">dès </span>}
                {euro(from, { compact: true })}
                {p.compareAtPrice ? <s className="ml-1.5 text-ink-faint">{euro(p.compareAtPrice, { compact: true })}</s> : null}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
