"use client";

import { AnimatePresence, motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { EASE, roman, Words } from "@/components/herbier/Elements";
import { Plate } from "@/components/herbier/Plate";
import { SmartImage } from "@/components/site/SmartImage";
import { cn } from "@/lib/cn";
import { euro } from "@/lib/format";
import type { PlateName } from "@/lib/plates";
import type { Addon, Product } from "@/lib/types";
import { useCart } from "@/store/cart";

function Gallery({ images, name, plate }: { images: string[]; name: string; plate: PlateName }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  return (
    <div className="min-w-0 lg:sticky lg:top-24">
      <div className="sheet relative p-3 sm:p-4">
        <span className="tape -top-2 left-[16%] -rotate-[4deg]" aria-hidden />
        <span className="tape -top-2 right-[16%] rotate-[3deg]" aria-hidden />
        <div
          className="relative aspect-[4/5] cursor-zoom-in overflow-hidden bg-paper-deep"
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse") return;
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onPointerLeave={() => setZoom(null)}
        >
          {images.length ? (
            <AnimatePresence initial={false}>
              <motion.div key={i} className="absolute inset-0" initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1, ease: EASE }}>
                <div className="absolute inset-0 transition-transform duration-500 ease-out" style={{ transform: zoom ? "scale(1.6)" : "scale(1)", transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : "50% 50%" }}>
                  <SmartImage src={images[i]} alt={`${name} — photo ${i + 1}`} fill priority sizes="(max-width: 1024px) 92vw, 46vw" className="tirage object-cover" />
                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <Plate name={plate} fit="contain" reveal="mount" className="absolute inset-[10%] text-ink-soft" />
          )}
        </div>
      </div>
      {images.length > 1 && (
        <div className="mt-5 flex gap-3">
          {images.map((src, k) => (
            <button key={k} onClick={() => setI(k)} className={cn("relative h-[84px] w-[68px] bg-paper-light p-1 shadow-[0_1px_2px_rgba(27,19,32,0.15)] transition", k === i ? "outline outline-1 outline-offset-2 outline-ink" : "opacity-60 hover:opacity-100")} aria-label={`Photo ${k + 1}`} aria-pressed={k === i}>
              <span className="relative block h-full w-full overflow-hidden">
                <SmartImage src={src} alt="" fill sizes="68px" className="tirage object-cover" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductView({
  product,
  category,
  addons,
  notes,
  number,
  plate,
}: {
  product: Product;
  category: string;
  addons: Addon[];
  notes: [string, string][];
  number: number;
  plate: PlateName;
}) {
  const add = useCart((s) => s.add);
  const [variantId, setVariantId] = useState(product.variants[0]?.id);
  const [chosen, setChosen] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);
  const variant = product.variants.find((v) => v.id === variantId);
  const base = variant?.price ?? product.price;
  const addonsTotal = addons.filter((a) => chosen.includes(a.id)).reduce((s, a) => s + a.price, 0);
  const unit = base + addonsTotal;
  const soldOut = product.stock != null && product.stock <= 0;
  const sectionRef = useRef<HTMLElement>(null);
  const buyRef = useRef<HTMLButtonElement>(null);
  const inSection = useInView(sectionRef);
  const buyVisible = useInView(buyRef);

  const onAdd = () => {
    if (soldOut) return;
    add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      variantId: variant?.id,
      variantName: variant?.name,
      unitPrice: unit,
      quantity: qty,
      addonIds: chosen,
      addonNames: addons.filter((a) => chosen.includes(a.id)).map((a) => a.name),
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2400);
  };

  return (
    <section ref={sectionRef} className="wrap pb-24 pt-24 sm:pt-28 lg:pt-32">
      <div className="grid gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
        <Gallery images={product.images} name={product.name} plate={plate} />

        <div className="min-w-0 lg:pt-4">
          <p className="flex items-baseline gap-3 font-text text-[0.9rem] italic text-ink-muted">
            <span>Planche {roman(number)}</span>
            <span className="h-px w-8 translate-y-[-0.3em] bg-ink/25" />
            <span className="sc not-italic">{category}</span>
          </p>
          <h1 className="mt-5 font-display text-[clamp(3rem,6vw,5.4rem)] leading-[0.95] tracking-[-0.015em]">
            <Words text={product.name} />
          </h1>
          <p className="mt-3 font-text text-[1.25rem] italic text-ink-soft">{product.subtitle}</p>

          <div className="mt-7 flex items-baseline gap-4">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={unit * qty} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }} className="tab font-text text-[2.3rem] leading-none">
                {euro(unit * qty)}
              </motion.span>
            </AnimatePresence>
            {product.compareAtPrice ? <s className="tab font-text text-[1.1rem] text-ink-faint">{euro(product.compareAtPrice)}</s> : null}
            <span className="font-text text-[0.85rem] italic text-ink-muted">TTC</span>
          </div>

          <p className="body-text mt-8 max-w-xl">{product.description}</p>

          {product.variants.length > 0 && (
            <fieldset className="min-w-0 mt-10">
              <legend className="sc mb-3 text-ink-muted">Taille</legend>
              <div className="border-t border-ink/15">
                {product.variants.map((v) => {
                  const on = v.id === variantId;
                  return (
                    <label key={v.id} className={cn("flex cursor-pointer items-baseline gap-4 border-b border-ink/15 py-3.5 font-text text-[1.05rem] transition-colors", on ? "text-ink" : "text-ink-soft hover:text-ink")}>
                      <input type="radio" name="variant" className="sr-only" checked={on} onChange={() => setVariantId(v.id)} />
                      <span className="radio-dot translate-y-[1px]" data-on={on} aria-hidden />
                      <span className={cn("font-display text-[1.3rem]", on && "italic")}>{v.name}</span>
                      {v.description && <span className="hidden truncate text-[0.9rem] italic text-ink-muted sm:inline">{v.description}</span>}
                      <span className="leader" />
                      <span className="tab">{euro(v.price, { compact: true })}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {addons.length > 0 && (
            <fieldset className="min-w-0 mt-10">
              <legend className="sc mb-3 text-ink-muted">Les petites attentions</legend>
              <div className="border-t border-ink/15">
                {addons.map((a) => {
                  const on = chosen.includes(a.id);
                  return (
                    <label key={a.id} className={cn("flex cursor-pointer items-baseline gap-4 border-b border-ink/15 py-3 font-text transition-colors", on ? "text-ink" : "text-ink-soft hover:text-ink")}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => setChosen((c) => (on ? c.filter((x) => x !== a.id) : [...c, a.id]))} />
                      <span className="check-box translate-y-[1px]" data-on={on} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-[1.02rem]">{a.name}</span>
                        <span className="block truncate text-[0.88rem] italic text-ink-muted">{a.description}</span>
                      </span>
                      <span className="leader" />
                      <span className="tab shrink-0 text-[1rem]">+ {euro(a.price, { compact: true })}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
            <div className="flex items-center gap-4 font-text text-[1.05rem]">
              <span className="sc text-ink-muted">Quantité</span>
              <button className="px-1.5 text-ink-muted hover:text-ink" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuer la quantité">
                −
              </button>
              <span className="tab w-5 text-center">{qty}</span>
              <button className="px-1.5 text-ink-muted hover:text-ink" onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Augmenter la quantité">
                +
              </button>
            </div>
            <button ref={buyRef} onClick={onAdd} disabled={soldOut} className="btn-label min-w-[16rem] flex-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={added ? "ok" : "add"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                  {soldOut ? "Épuisé" : added ? "Ajouté au panier" : "Ajouter au panier"}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
          {product.stock != null && product.stock > 0 && product.stock <= 5 && (
            <p className="mt-3 font-text text-[0.95rem] italic text-plum">
              Plus que {product.stock} disponible{product.stock > 1 ? "s" : ""}.
            </p>
          )}

          <div className="mt-10 space-y-2.5 border-t border-ink/15 pt-6 font-text text-[0.98rem]">
            {notes.map(([a, b]) => (
              <div key={a} className="flex items-baseline">
                <span className="text-ink-soft">{a}</span>
                <span className="leader" />
                <span className="text-right italic">{b}</span>
              </div>
            ))}
          </div>

          {product.details && (
            <div className="mt-8 border-y border-ink/15">
              <button onClick={() => setOpenDetails((v) => !v)} className="flex w-full items-baseline justify-between py-5 text-left" aria-expanded={openDetails}>
                <span className="font-display text-[1.5rem]">Composition &amp; soin</span>
                <span className="font-text text-[1.3rem] text-ink-muted">{openDetails ? "−" : "+"}</span>
              </button>
              <AnimatePresence initial={false}>
                {openDetails && (
                  <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.5, ease: EASE }} className="body-text overflow-hidden pb-6">
                    {product.details}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}
          <p className="mt-6 font-text text-[0.88rem] italic leading-relaxed text-ink-muted">
            Les fleurs sont vivantes et de saison : votre création peut différer légèrement de la photo. La fleuriste respecte toujours son harmonie et sa valeur.
          </p>
        </div>
      </div>

      {/* barre d'achat mobile, visible tant que le bouton principal est hors de l'écran */}
      <AnimatePresence>
        {inSection && !buyVisible && (
          <motion.div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/15 bg-paper/[0.97] px-5 py-3 lg:hidden" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.45, ease: EASE }}>
            <button onClick={onAdd} disabled={soldOut} className="btn-label w-full !py-3.5">
              <span>{added ? "Ajouté au panier" : soldOut ? "Épuisé" : `Ajouter · ${euro(unit * qty)}`}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
