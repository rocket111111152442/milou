"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, PRODUCTS, type CategoryId } from "@/lib/catalog";
import { ProductCard } from "./ProductCard";
import { useHeaderState } from "@/lib/ui-store";

type Filter = CategoryId | "tout";

function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function MenuBrowser({ initial = "tout" }: { initial?: Filter }) {
  const [filter, setFilter] = useState<Filter>(initial);
  const [query, setQuery] = useState("");
  const headerHidden = useHeaderState((s) => s.hidden);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (filter === "tout") url.searchParams.delete("rayon");
    else url.searchParams.set("rayon", filter);
    window.history.replaceState(null, "", url);
  }, [filter]);

  const products = useMemo(() => {
    const q = normalize(query.trim());
    return PRODUCTS.filter((p) => p.available !== false)
      .filter((p) => filter === "tout" || p.category === filter)
      .filter((p) => !q || normalize(`${p.name} ${p.description}`).includes(q));
  }, [filter, query]);

  const tabs: { id: Filter; label: string }[] = [{ id: "tout", label: "Tout" }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))];
  const current = CATEGORIES.find((c) => c.id === filter);

  return (
    <div>
      <div
        className="sticky z-30 -mx-6 mb-10 bg-farine/90 px-6 py-3 shadow-[0_12px_24px_-20px_rgba(36,22,13,0.4)] backdrop-blur-xl transition-[top] duration-500 ease-[var(--ease-pain)]"
        style={{ top: headerHidden ? 0 : 84 }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <LayoutGroup>
            <div className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Rayons">
              {tabs.map((t) => {
                const active = t.id === filter;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(t.id)}
                    className={`relative shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${active ? "text-creme" : "text-cafe/70 hover:text-cafe"}`}
                  >
                    {active && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-cafe" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                    <span className="relative">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
          <label className="relative md:w-72">
            <span className="sr-only">Rechercher un produit</span>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-grege" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Croissant, levain, éclair…"
              className="h-11 w-full rounded-full border border-mie bg-creme pl-11 pr-4 text-sm outline-none transition focus:border-croute focus:ring-4 focus:ring-croute/10"
            />
          </label>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={filter}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          {current ? (
            <>
              <p className="font-script text-3xl text-caramel">{current.tagline}</p>
              <h2 className="font-display text-4xl tracking-tight sm:text-5xl">{current.label}</h2>
              {current.id === "gateaux" && (
                <p className="mt-3 max-w-2xl text-cafe/70">Ces gâteaux sont préparés pour vous : commandez au moins 48 h avant le retrait.</p>
              )}
            </>
          ) : (
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Toute la carte</h2>
          )}
        </motion.div>
      </AnimatePresence>

      <motion.div layout className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </AnimatePresence>
      </motion.div>

      {products.length === 0 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center font-display text-2xl text-grege">
          Rien ne correspond à « {query} »… mais il reste de la baguette !
        </motion.p>
      )}
    </div>
  );
}
