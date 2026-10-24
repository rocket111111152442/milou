"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useScrollLock } from "@/components/motion/SmoothScroll";
import { SmartImage } from "@/components/site/SmartImage";
import { euro } from "@/lib/format";
import { cartCount, cartSubtotal, useCart } from "@/store/cart";
import { EASE } from "./Elements";
import { Plate } from "./Plate";

/** Panier : un bon de commande qui glisse depuis la droite. */
export function Bag({ freeFrom, freeZone }: { freeFrom: number | null; freeZone: string }) {
  const { lines, open, setOpen, setQty, remove } = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, setOpen]);

  const subtotal = cartSubtotal(lines);
  const left = freeFrom != null ? Math.max(0, freeFrom - subtotal) : null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-[60] bg-plum-night/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} onClick={() => setOpen(false)} />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Votre panier"
              className="h-paper fixed inset-y-0 right-0 z-[61] flex w-[min(470px,100vw)] flex-col shadow-[-30px_0_60px_-30px_rgba(17,11,21,0.5)]"
              initial={{ x: "100%" }}
              animate={{ x: "0%" }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.75, ease: [0.77, 0, 0.18, 1] }}
            >
              <div className="flex items-center justify-between border-b border-ink/15 px-6 py-5 sm:px-8">
                <div>
                  <p className="sc text-ink-muted">Bon de commande</p>
                  <h2 className="mt-1 font-display text-[2rem] leading-none">Votre panier</h2>
                </div>
                <button onClick={() => setOpen(false)} className="sc ulink">
                  Fermer
                </button>
              </div>

              {mounted && lines.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                  <Plate name="brins" className="w-56 text-ink-soft" reveal="mount" duration={1.4} />
                  <p className="mt-8 font-display text-[1.7rem] italic">Encore aucune fleur.</p>
                  <p className="body-text mt-2 !text-[1rem]">La boutique compose chaque matin avec les arrivages du jour.</p>
                  <Link href="/boutique" onClick={() => setOpen(false)} className="btn-line mt-8">
                    Voir la boutique <span className="arrow">→</span>
                  </Link>
                </div>
              ) : (
                <>
                  <ul className="flex-1 overflow-y-auto px-6 sm:px-8" data-lenis-prevent>
                    <AnimatePresence initial={false}>
                      {lines.map((l, i) => (
                        <motion.li
                          key={l.key}
                          layout
                          initial={{ opacity: 0, x: 30 }}
                          animate={{ opacity: 1, x: 0, transition: { delay: 0.25 + i * 0.05, duration: 0.6, ease: EASE } }}
                          exit={{ opacity: 0, height: 0, transition: { duration: 0.35 } }}
                          className="border-b border-ink/10"
                        >
                          <div className="flex gap-4 py-5">
                            <div className="relative h-[92px] w-[74px] shrink-0 bg-paper-deep p-1 shadow-[0_1px_2px_rgba(27,19,32,0.15)]">
                              <div className="relative h-full w-full overflow-hidden">
                                {l.image ? <SmartImage src={l.image} alt="" fill sizes="74px" className="tirage object-cover" /> : <Plate name="bouquet-ancien" reveal="none" className="mx-auto mt-1 w-[90%] text-ink-soft" />}
                              </div>
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <div className="flex items-baseline gap-3">
                                {l.slug ? (
                                  <Link href={`/boutique/${l.slug}`} onClick={() => setOpen(false)} className="truncate font-display text-[1.25rem] leading-tight hover:italic">
                                    {l.name}
                                  </Link>
                                ) : (
                                  <span className="truncate font-display text-[1.25rem] leading-tight">{l.name}</span>
                                )}
                                <span className="leader" />
                                <span className="tab shrink-0 font-text text-[0.98rem]">{euro(l.unitPrice * l.quantity)}</span>
                              </div>
                              <p className="mt-0.5 line-clamp-2 font-text text-[0.88rem] italic text-ink-muted">
                                {[l.variantName, ...(l.addonNames || []), l.custom?.summary].filter(Boolean).join(" · ")}
                              </p>
                              <div className="mt-auto flex items-center justify-between pt-2 font-text text-[0.9rem]">
                                <span className="flex items-center gap-3">
                                  <button onClick={() => setQty(l.key, l.quantity - 1)} className="px-1 text-ink-muted hover:text-ink" aria-label="Retirer un exemplaire">
                                    −
                                  </button>
                                  <span className="tab w-4 text-center">{l.quantity}</span>
                                  <button onClick={() => setQty(l.key, l.quantity + 1)} className="px-1 text-ink-muted hover:text-ink" aria-label="Ajouter un exemplaire">
                                    +
                                  </button>
                                </span>
                                <button onClick={() => remove(l.key)} className="ulink italic text-ink-muted hover:text-ink">
                                  retirer
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>

                  <div className="border-t border-ink/15 px-6 pb-6 pt-5 sm:px-8">
                    {left != null && (
                      <div className="mb-5">
                        <p className="font-text text-[0.9rem] italic text-ink-soft">
                          {left > 0 ? (
                            <>
                              Plus que <span className="tab not-italic">{euro(left)}</span> pour la livraison offerte · {freeZone}
                            </>
                          ) : (
                            <>Livraison offerte à {freeZone}.</>
                          )}
                        </p>
                        <div className="mt-2 h-px w-full bg-ink/15">
                          <motion.div className="h-px bg-ink" initial={false} animate={{ width: `${Math.min(100, (subtotal / (freeFrom || 1)) * 100)}%` }} transition={{ duration: 0.8, ease: EASE }} />
                        </div>
                      </div>
                    )}
                    <div className="flex items-baseline font-text">
                      <span className="sc">Sous-total</span>
                      <span className="leader" />
                      <span className="tab font-text text-[1.5rem]">{euro(subtotal)}</span>
                    </div>
                    <p className="mt-1 font-text text-[0.85rem] italic text-ink-muted">Livraison et date choisies à l&apos;étape suivante.</p>
                    <Link href="/commande" onClick={() => setOpen(false)} className="btn-label mt-5 w-full">
                      <span>Passer commande</span>
                    </Link>
                    <button onClick={() => setOpen(false)} className="mt-3 w-full text-center font-text text-[0.92rem] italic text-ink-muted hover:text-ink">
                      Continuer mes achats
                    </button>
                  </div>
                </>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      <AddedNotice />
    </>
  );
}

/** Petit billet qui confirme l'ajout au panier. */
function AddedNotice() {
  const { lines, bump, open, setOpen } = useCart();
  const first = useRef(bump);
  const [show, setShow] = useState(false);
  const lastLine = lines[lines.length - 1];

  useEffect(() => {
    if (bump === first.current) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 3600);
    return () => clearTimeout(t);
  }, [bump]);
  useEffect(() => {
    if (open) setShow(false);
  }, [open]);

  return (
    <AnimatePresence>
      {show && lastLine && (
        <motion.div
          role="status"
          className="sheet fixed bottom-5 left-5 right-5 z-[55] flex items-center gap-4 p-4 sm:left-auto sm:right-8 sm:w-[360px]"
          initial={{ opacity: 0, y: 30, rotate: 1.5 }}
          animate={{ opacity: 1, y: 0, rotate: -0.6 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-paper-deep">
            {lastLine.image ? <SmartImage src={lastLine.image} alt="" fill sizes="44px" className="tirage object-cover" /> : <Plate name="bouquet-ancien" reveal="none" className="w-full text-ink-soft" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="sc text-ink-muted">Ajouté au panier</p>
            <p className="truncate font-display text-[1.1rem]">
              {lastLine.name}
              {lastLine.variantName && <span className="font-text text-[0.9rem] italic text-ink-muted"> — {lastLine.variantName}</span>}
            </p>
          </div>
          <button onClick={() => setOpen(true)} className="sc ulink-on shrink-0">
            Voir · {cartCount(lines)}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
