"use client";

import Link, { useSitePath } from "@/components/TLink";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { useEffect, useState } from "react";
import { useLenis } from "lenis/react";
import { cartDetails, useCart } from "@/lib/cart";
import { useSiteData } from "@/components/SettingsProvider";
import { formatPrice } from "@/lib/catalog";
import { ProductThumb } from "@/components/menu/ProductImage";
import { QtyStepper } from "./QtyStepper";

function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

export function FloatingCart() {
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const bump = useCart((s) => s.bump);
  const setOpen = useCart((s) => s.setOpen);
  const pathname = useSitePath();
  const controls = useAnimationControls();
  const { byId } = useSiteData();
  const { count, total } = cartDetails(lines, byId);

  useEffect(() => {
    if (bump) controls.start({ scale: [1, 1.25, 0.95, 1], rotate: [0, -8, 6, 0], transition: { duration: 0.6, delay: 0.75 } });
  }, [bump, controls]);

  const hidden = !hydrated || pathname.startsWith("/commande") || pathname.startsWith("/admin");

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.button
          id="cart-target"
          type="button"
          onClick={() => setOpen(true)}
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="fixed bottom-4 right-4 z-[60] flex items-center gap-3 rounded-full bg-cafe p-2 sm:py-2.5 sm:pl-3 sm:pr-5 text-creme shadow-[0_18px_40px_-12px_rgba(36,22,13,0.6)] ring-1 ring-creme/10 transition-colors hover:bg-croute sm:bottom-8 sm:right-8"
          aria-label={`Ouvrir le panier (${count} article${count > 1 ? "s" : ""})`}
        >
          <motion.span animate={controls} className="relative grid h-12 w-12 place-items-center rounded-full bg-dore text-torref sm:h-10 sm:w-10">
            <BasketIcon className="h-5 w-5" />
            <AnimatePresence>
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-croute px-1 text-[11px] font-bold text-creme ring-2 ring-cafe"
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.span>
          <span className="hidden flex-col items-start leading-tight sm:flex">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-creme/60">Mon panier</span>
            <span className="font-display text-lg">{count > 0 ? formatPrice(total) : "Commander"}</span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export function CartDrawer() {
  const hydrated = useHydrated();
  const { lines, open, setOpen, setQty, remove } = useCart();
  const { byId } = useSiteData();
  const { items, total, count } = cartDetails(lines, byId);
  const lenis = useLenis();
  const pathname = useSitePath();

  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  useEffect(() => {
    if (open) lenis?.stop();
    else lenis?.start();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, lenis, setOpen]);

  if (!hydrated) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-torref/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Votre panier"
            data-lenis-prevent
            className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-md flex-col bg-creme shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <header className="flex items-center justify-between border-b border-mie px-6 py-5">
              <div>
                <p className="font-script text-xl text-caramel">Votre panier</p>
                <p className="font-display text-2xl">
                  {count} article{count > 1 ? "s" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-full border border-mie transition hover:rotate-90 hover:bg-mie"
                aria-label="Fermer le panier"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <motion.div
                      className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full bg-farine text-croute"
                      animate={{ rotate: [0, -6, 6, 0] }}
                      transition={{ repeat: Infinity, duration: 3 }}
                    >
                      <BasketIcon className="h-10 w-10" />
                    </motion.div>
                    <p className="font-display text-2xl">Le panier est vide</p>
                    <p className="mt-2 text-sm text-grege">Une baguette, quelques croissants ?</p>
                    <Link
                      href="/carte"
                      className="mt-6 inline-flex rounded-full bg-cafe px-6 py-3 text-sm font-semibold text-creme transition hover:bg-croute"
                    >
                      Voir la carte
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  <AnimatePresence initial={false}>
                    {items.map(({ key, product, qty, total: lineTotal, options, invalid }) => (
                      <motion.li
                        key={key}
                        layout
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 60, height: 0, marginBottom: 0 }}
                        className="flex gap-4 rounded-2xl bg-farine/70 p-3"
                      >
                        <ProductThumb product={product} className="h-20 w-20 shrink-0 rounded-xl" sizes="80px" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-display text-lg leading-tight">{product.name}</p>
                            <button
                              type="button"
                              onClick={() => remove(key)}
                              className="text-grege transition hover:text-croute"
                              aria-label={`Retirer ${product.name}`}
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 6l12 12M18 6L6 18" />
                              </svg>
                            </button>
                          </div>
                          <p className="text-xs text-grege">
                            {formatPrice(product.price)}
                            {product.unit ? ` · ${product.unit}` : ""}
                          </p>
                          {options && <p className="text-xs text-cafe/70">{options}</p>}
                          {invalid && <p className="text-xs font-semibold text-red-700">Choix modifiés : retirez puis rajoutez.</p>}
                          <div className="mt-auto flex items-center justify-between pt-2">
                            <QtyStepper value={qty} onChange={(v) => setQty(key, v)} label={product.name} small />
                            <motion.span key={lineTotal} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-semibold">
                              {formatPrice(lineTotal)}
                            </motion.span>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <footer className="border-t border-mie bg-farine/60 px-6 py-5">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-sm text-grege">Total</span>
                  <span className="font-display text-3xl">{formatPrice(total)}</span>
                </div>
                <p className="mb-4 text-xs text-grege">Paiement en boutique au moment du retrait.</p>
                <Link
                  href="/commande"
                  className="group flex w-full items-center justify-center gap-2 rounded-full bg-croute px-6 py-4 font-semibold text-creme transition hover:bg-cafe"
                >
                  Choisir mon créneau de retrait
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </Link>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function BasketIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 10h14l-1.4 8.4a2 2 0 0 1-2 1.6H8.4a2 2 0 0 1-2-1.6L5 10Z" />
      <path d="M9 10 11 4M15 10l-2-6M3.5 10h17" />
      <path d="M10 14v2.5M14 14v2.5" />
    </svg>
  );
}
