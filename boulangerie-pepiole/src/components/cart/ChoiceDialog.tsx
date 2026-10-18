"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatPrice, type Product } from "@/lib/catalog";

/** Fenêtre de choix des options d'une formule (une option par choix) avant l'ajout au panier. */
export function ChoiceDialog({ product, onClose, onConfirm }: { product: Product; onClose: () => void; onConfirm: (picks: string[]) => void }) {
  const groups = product.groups ?? [];
  const [picks, setPicks] = useState<(string | null)[]>(() => groups.map((g) => (g.options.length === 1 ? g.options[0] : null)));
  const ready = picks.every((p) => p !== null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Rendu dans <body> : une carte animée (transform) ne doit pas servir de repère à la fenêtre
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-torref/60 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Composer ${product.name}`}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        data-lenis-prevent
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-creme p-6 shadow-2xl sm:rounded-[2rem] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-script text-2xl text-caramel">Composez votre formule</p>
            <h2 className="font-display text-3xl leading-tight">{product.name}</h2>
          </div>
          <span className="font-display text-2xl text-croute">{formatPrice(product.price)}</span>
        </div>

        <div className="mt-6 space-y-6">
          {groups.map((g, i) => (
            <fieldset key={g.label}>
              <legend className="mb-2 text-sm font-bold uppercase tracking-wider text-cafe/70">{g.label}</legend>
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const on = picks[i] === o;
                  return (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPicks((s) => s.map((x, j) => (j === i ? o : x)))}
                      className={`rounded-full px-4 py-2.5 text-sm font-semibold ring-1 transition ${on ? "bg-cafe text-creme ring-cafe" : "bg-farine text-cafe ring-mie hover:bg-mie"}`}
                    >
                      {on && "✓ "}
                      {o}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="mt-8 flex gap-3">
          <button type="button" onClick={onClose} className="h-12 rounded-full border border-mie px-6 text-sm font-semibold transition hover:bg-mie">
            Annuler
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => onConfirm(picks as string[])}
            className="h-12 flex-1 rounded-full bg-croute px-6 text-sm font-semibold text-creme transition hover:bg-cafe disabled:cursor-not-allowed disabled:opacity-40"
          >
            {ready ? "Ajouter au panier" : "Faites vos choix"}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
