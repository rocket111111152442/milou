"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Minus, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useScrollLock } from "@/components/motion/SmoothScroll";
import { euro } from "@/lib/format";
import { cartCount, cartSubtotal, useCart } from "@/store/cart";
import { VioletMark } from "./Logo";
import { SmartImage } from "./SmartImage";

export function CartDrawer({ freeFrom, freeZone }: { freeFrom: number | null; freeZone: string }) {
  const { lines, open, setOpen, setQty, remove } = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useScrollLock(open);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const subtotal = mounted ? cartSubtotal(lines) : 0;
  const count = mounted ? cartCount(lines) : 0;
  const ratio = freeFrom ? Math.min(1, subtotal / freeFrom) : 0;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120]" role="dialog" aria-modal aria-label="Panier">
          <motion.button
            aria-label="Fermer le panier"
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            className="fern-night absolute inset-y-0 right-0 flex w-full max-w-[480px] flex-col bg-aubergine-950 shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="flex items-center justify-between border-b border-ivory/10 px-6 py-6 sm:px-8">
              <div>
                <p className="eyebrow text-gold">Votre panier</p>
                <p className="mt-1 font-display text-2xl">
                  {count} création{count > 1 ? "s" : ""}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full border border-ivory/15 p-2.5 transition hover:rotate-90 hover:border-gold" aria-label="Fermer">
                <X className="h-4 w-4" strokeWidth={1.4} />
              </button>
            </div>

            {freeFrom != null && count > 0 && (
              <div className="border-b border-ivory/10 px-6 py-4 text-xs text-ivory/70 sm:px-8">
                {ratio >= 1 ? (
                  <span className="text-gold-light">✦ Livraison offerte à {freeZone} débloquée</span>
                ) : (
                  <span>
                    Plus que <strong className="text-ivory">{euro(freeFrom - subtotal)}</strong> pour la livraison offerte à {freeZone}
                  </span>
                )}
                <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-ivory/10">
                  <motion.div className="bg-foil h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${ratio * 100}%` }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-4 sm:px-8" data-lenis-prevent>
              {count === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <motion.div initial={{ rotate: -30, scale: 0.6, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}>
                    <VioletMark className="h-20 w-20 text-gold/80" strokeWidth={1} />
                  </motion.div>
                  <p className="mt-6 font-display text-3xl italic">Votre panier attend ses fleurs</p>
                  <p className="mt-2 max-w-xs text-sm text-ivory/60">Laissez-vous guider par la saison, ou composez votre propre bouquet à l&apos;atelier.</p>
                  <div className="mt-8 flex flex-col gap-3">
                    <Link href="/boutique" onClick={() => setOpen(false)} className="btn btn-ivory">
                      <span>La boutique</span>
                    </Link>
                    <Link href="/atelier" onClick={() => setOpen(false)} className="btn btn-ghost text-ivory">
                      <span>Composer un bouquet</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-ivory/10">
                  <AnimatePresence initial={false}>
                    {lines.map((l) => (
                      <motion.li
                        key={l.key}
                        layout
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 60, height: 0, paddingTop: 0, paddingBottom: 0 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="flex gap-4 overflow-hidden py-5"
                      >
                        <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-t-full bg-aubergine-800">
                          {l.image ? (
                            <SmartImage src={l.image} alt={l.name} fill sizes="80px" className="object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <VioletMark className="h-10 w-10 text-gold/70" />
                            </div>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              {l.slug ? (
                                <Link href={`/boutique/${l.slug}`} onClick={() => setOpen(false)} className="font-display text-xl leading-tight hover:text-gold-light">
                                  {l.name}
                                </Link>
                              ) : (
                                <p className="font-display text-xl leading-tight">{l.name}</p>
                              )}
                              {l.variantName && <p className="mt-0.5 text-xs text-ivory/55">{l.variantName}</p>}
                              {l.custom?.summary && <p className="mt-0.5 line-clamp-2 text-xs text-ivory/55">{l.custom.summary}</p>}
                              {!!l.addonNames?.length && <p className="mt-0.5 text-xs text-gold/80">+ {l.addonNames.join(", ")}</p>}
                            </div>
                            <button onClick={() => remove(l.key)} className="text-ivory/40 transition hover:text-ivory" aria-label={`Retirer ${l.name}`}>
                              <X className="h-4 w-4" strokeWidth={1.4} />
                            </button>
                          </div>
                          <div className="mt-auto flex items-center justify-between pt-3">
                            <div className="flex items-center rounded-full border border-ivory/15">
                              <button className="p-2 text-ivory/70 hover:text-ivory" onClick={() => setQty(l.key, l.quantity - 1)} aria-label="Diminuer">
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center text-sm tabular-nums">{l.quantity}</span>
                              <button className="p-2 text-ivory/70 hover:text-ivory" onClick={() => setQty(l.key, l.quantity + 1)} aria-label="Augmenter">
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="font-display text-lg tabular-nums">{euro(l.unitPrice * l.quantity)}</span>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {count > 0 && (
              <div className="border-t border-ivory/10 px-6 py-6 sm:px-8">
                <div className="flex items-baseline justify-between">
                  <span className="eyebrow text-ivory/70">Sous-total</span>
                  <span className="font-display text-3xl tabular-nums">{euro(subtotal)}</span>
                </div>
                <p className="mt-1 text-xs text-ivory/45">Livraison et remises calculées à l&apos;étape suivante.</p>
                <Link href="/commande" onClick={() => setOpen(false)} className="btn btn-gold mt-5 w-full" data-cursor="link">
                  <span>Commander</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button onClick={() => setOpen(false)} className="mt-3 w-full text-center text-xs uppercase tracking-[0.2em] text-ivory/55 hover:text-ivory">
                  Continuer mes achats
                </button>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
