"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Leaf, Minus, Plus, ShieldCheck, Truck, PenLine } from "lucide-react";
import { useRef, useState } from "react";
import { Magnetic } from "@/components/motion/Reveal";
import { SplitText } from "@/components/motion/SplitText";
import { SmartImage } from "@/components/site/SmartImage";
import { StarGlyph } from "@/components/site/Social";
import { cn } from "@/lib/cn";
import { flyToCart } from "@/lib/fly";
import { euro } from "@/lib/format";
import type { Addon, Product } from "@/lib/types";
import { useCart } from "@/store/cart";

function Gallery({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  return (
    <div className="lg:sticky lg:top-28">
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-t-full border border-gold/30 p-2"
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onPointerLeave={() => setZoom(null)}
        data-cursor="view"
        data-cursor-label="Zoom"
      >
        <div className="relative h-full w-full overflow-hidden rounded-t-full bg-aubergine-800">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={i}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.15 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                className="absolute inset-0 transition-transform duration-300 ease-out"
                style={{ transform: zoom ? "scale(1.7)" : "scale(1)", transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : "50% 50%" }}
              >
                <SmartImage src={images[i]} alt={`${name} — photo ${i + 1}`} fill priority sizes="(max-width: 1024px) 95vw, 50vw" className="object-cover" />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {images.length > 1 && (
        <div className="mt-5 flex justify-center gap-3">
          {images.map((src, k) => (
            <button key={k} onClick={() => setI(k)} className={cn("relative h-20 w-16 overflow-hidden rounded-t-full border transition", k === i ? "border-gold" : "border-ivory/15 opacity-60 hover:opacity-100")} aria-label={`Photo ${k + 1}`}>
              <SmartImage src={src} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductView({ product, category, addons, deliveryHint }: { product: Product; category: string; addons: Addon[]; deliveryHint: string }) {
  const add = useCart((s) => s.add);
  const [variantId, setVariantId] = useState(product.variants[0]?.id);
  const [chosen, setChosen] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const variant = product.variants.find((v) => v.id === variantId);
  const base = variant?.price ?? product.price;
  const addonsTotal = addons.filter((a) => chosen.includes(a.id)).reduce((s, a) => s + a.price, 0);
  const unit = base + addonsTotal;
  const soldOut = product.stock != null && product.stock <= 0;

  const onAdd = () => {
    if (soldOut) return;
    flyToCart(btnRef.current?.closest("[data-product]")?.querySelector("img") ?? btnRef.current, product.images[0]);
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
    setTimeout(() => setAdded(false), 2200);
  };

  return (
    <section className="fern-night relative bg-noir pb-28 pt-32 lg:pt-40" data-product>
      <div className="mx-auto grid max-w-[1500px] gap-14 px-6 sm:px-10 lg:grid-cols-2 lg:gap-24 lg:px-16">
        <Gallery images={product.images} name={product.name} />

        <div className="lg:pt-6">
          <motion.p className="eyebrow flex items-center gap-3 text-gold" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
            <span className="h-px w-8 bg-gold/60" /> {category}
          </motion.p>
          <h1 className="h-display mt-5 text-[clamp(3.4rem,7vw,6.5rem)]">
            <SplitText text={product.name} by="char" stagger={0.04} />
          </h1>
          {product.star && (
            <p className="mt-3 flex items-center gap-2 font-caps text-[0.62rem] uppercase tracking-[0.3em] text-aubergine-300">
              <StarGlyph className="h-3 w-3 text-gold" /> {product.star}
            </p>
          )}
          <p className="mt-6 text-lg text-ivory/65">{product.subtitle}</p>

          <div className="mt-8 flex items-baseline gap-4">
            <AnimatePresence mode="popLayout">
              <motion.span key={unit * qty} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="font-display text-5xl tabular-nums">
                {euro(unit * qty)}
              </motion.span>
            </AnimatePresence>
            {product.compareAtPrice ? <span className="text-lg text-ivory/40 line-through">{euro(product.compareAtPrice)}</span> : null}
          </div>

          <p className="mt-8 max-w-xl leading-relaxed text-ivory/75">{product.description}</p>

          {product.variants.length > 0 && (
            <div className="mt-10">
              <p className="label text-ivory">Taille</p>
              <div className="grid grid-cols-3 gap-3">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVariantId(v.id)}
                    className={cn("relative rounded-2xl border px-4 py-4 text-left transition", v.id === variantId ? "border-gold" : "border-ivory/15 hover:border-ivory/40")}
                    aria-pressed={v.id === variantId}
                  >
                    {v.id === variantId && <motion.span layoutId="variant-bg" className="absolute inset-0 rounded-2xl bg-gold/10" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
                    <span className="relative block font-display text-xl">{v.name}</span>
                    <span className="relative mt-1 block text-sm text-ivory/60">{euro(v.price, { compact: true })}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {addons.length > 0 && (
            <div className="mt-10">
              <p className="label text-ivory">Les petites attentions</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {addons.map((a) => {
                  const on = chosen.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => setChosen((c) => (on ? c.filter((x) => x !== a.id) : [...c, a.id]))}
                      className={cn("flex items-center gap-3 rounded-2xl border p-3 text-left transition", on ? "border-gold bg-gold/10" : "border-ivory/15 hover:border-ivory/35")}
                      aria-pressed={on}
                    >
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                        <SmartImage src={a.image} alt="" fill sizes="48px" className="object-cover" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{a.name}</span>
                        <span className="block text-xs text-ivory/50">+ {euro(a.price)}</span>
                      </span>
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition", on ? "border-gold bg-gold text-noir" : "border-ivory/30")}>
                        {on && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <div className="flex items-center rounded-full border border-ivory/15">
              <button className="p-4 text-ivory/70 hover:text-ivory" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuer la quantité">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center tabular-nums">{qty}</span>
              <button className="p-4 text-ivory/70 hover:text-ivory" onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Augmenter la quantité">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <Magnetic strength={0.15} className="flex-1">
              <button ref={btnRef} onClick={onAdd} disabled={soldOut} className="btn btn-gold w-full !py-5" data-cursor="link">
                <AnimatePresence mode="wait">
                  {added ? (
                    <motion.span key="ok" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="flex items-center gap-2">
                      <Check className="h-4 w-4" /> Ajouté au panier
                    </motion.span>
                  ) : (
                    <motion.span key="add" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
                      {soldOut ? "Épuisé" : "Ajouter au panier"}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </Magnetic>
          </div>
          {product.stock != null && product.stock > 0 && product.stock <= 5 && <p className="mt-3 text-sm text-gold-light">Plus que {product.stock} disponible{product.stock > 1 ? "s" : ""}.</p>}

          <ul className="mt-10 grid gap-4 border-y border-ivory/10 py-8 text-sm text-ivory/70 sm:grid-cols-2">
            <li className="flex gap-3">
              <Truck className="h-5 w-5 shrink-0 text-gold" strokeWidth={1.3} /> {deliveryHint}
            </li>
            <li className="flex gap-3">
              <PenLine className="h-5 w-5 shrink-0 text-gold" strokeWidth={1.3} /> Carte message manuscrite offerte
            </li>
            <li className="flex gap-3">
              <Leaf className="h-5 w-5 shrink-0 text-gold" strokeWidth={1.3} /> Plus de 80 % de fleurs locales
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-gold" strokeWidth={1.3} /> Paiement sécurisé Stripe
            </li>
          </ul>

          {product.details && (
            <div className="border-b border-ivory/10">
              <button onClick={() => setOpenDetails((v) => !v)} className="flex w-full items-center justify-between py-6 text-left" aria-expanded={openDetails}>
                <span className="font-display text-2xl">Entretien & conseils</span>
                <ChevronDown className={cn("h-5 w-5 transition", openDetails && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {openDetails && (
                  <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pb-6 leading-relaxed text-ivory/65">
                    {product.details}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}
          <p className="mt-6 text-xs leading-relaxed text-ivory/40">
            Les fleurs étant des produits vivants et de saison, votre création peut légèrement différer de la photo : la fleuriste respecte toujours l&apos;harmonie et la valeur du bouquet.
          </p>
        </div>
      </div>

      {/* barre d'achat mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ivory/10 bg-noir/90 p-4 backdrop-blur-xl lg:hidden">
        <button onClick={onAdd} disabled={soldOut} className="btn btn-gold w-full">
          <span>{added ? "Ajouté ✓" : soldOut ? "Épuisé" : `Ajouter · ${euro(unit * qty)}`}</span>
        </button>
      </div>
    </section>
  );
}
