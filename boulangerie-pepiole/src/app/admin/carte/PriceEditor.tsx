"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import { CATEGORIES, PRODUCTS, formatPrice } from "@/lib/catalog";
import { updateSettings } from "../actions";

function toEuros(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function parseEuros(v: string): number | null {
  const n = Number(v.replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n >= 1000) return null;
  return Math.round(n * 100);
}

export function PriceEditor({
  initialPrices,
  initialUnavailable,
  updatedAt,
}: {
  initialPrices: Record<string, number>;
  initialUnavailable: string[];
  updatedAt: string | null;
}) {
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(PRODUCTS.map((p) => [p.id, toEuros(initialPrices[p.id] ?? p.price)])),
  );
  const [off, setOff] = useState<Set<string>>(() => new Set(initialUnavailable));
  const [saved, setSaved] = useState({ prices: initialPrices, off: new Set(initialUnavailable) });
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [query, setQuery] = useState("");

  const invalid = PRODUCTS.filter((p) => parseEuros(prices[p.id]) === null).map((p) => p.id);

  const dirty = useMemo(() => {
    const changedPrice = PRODUCTS.some((p) => parseEuros(prices[p.id]) !== (saved.prices[p.id] ?? p.price));
    const changedOff = off.size !== saved.off.size || [...off].some((id) => !saved.off.has(id));
    return changedPrice || changedOff;
  }, [prices, off, saved]);

  const save = () => {
    setMessage(null);
    const nextPrices: Record<string, number> = {};
    for (const p of PRODUCTS) {
      const v = parseEuros(prices[p.id]);
      if (v !== null && v !== p.price) nextPrices[p.id] = v;
    }
    start(async () => {
      try {
        await updateSettings({ prices: nextPrices, unavailable: [...off] });
        setSaved({ prices: nextPrices, off: new Set(off) });
        setMessage({ ok: true, text: "Enregistré : la carte du site est à jour." });
      } catch (e) {
        setMessage({ ok: false, text: `Échec de l'enregistrement : ${(e as Error).message}` });
      }
    });
  };

  const q = query.trim().toLowerCase();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Carte & prix</h1>
          <p className="mt-1 max-w-xl text-sm text-cafe/70">
            Modifiez un prix ou décochez « en vente » pour retirer un produit de la commande en ligne (rupture, saison
            terminée…). Les changements s&apos;appliquent aux deux boutiques.
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un produit…"
          className="h-11 w-full rounded-full border border-mie bg-creme px-4 text-sm outline-none focus:border-croute sm:w-64"
        />
      </div>

      {CATEGORIES.map((cat) => {
        const list = PRODUCTS.filter((p) => p.category === cat.id && (!q || p.name.toLowerCase().includes(q)));
        if (!list.length) return null;
        return (
          <section key={cat.id} className="mt-8">
            <h2 className="mb-3 font-display text-2xl">{cat.label}</h2>
            <ul className="divide-y divide-mie overflow-hidden rounded-[1.5rem] bg-creme ring-1 ring-mie">
              {list.map((p) => {
                const isOff = off.has(p.id);
                const bad = invalid.includes(p.id);
                const changed = parseEuros(prices[p.id]) !== p.price;
                return (
                  <li key={p.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap ${isOff ? "bg-mie/30" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold ${isOff ? "text-grege line-through" : ""}`}>{p.name}</p>
                      <p className="text-xs text-grege">
                        {p.unit ? `${p.unit} · ` : ""}prix d&apos;origine {formatPrice(p.price)}
                        {p.leadHours ? ` · sur commande ${p.leadHours} h` : ""}
                      </p>
                    </div>
                    <label className="relative">
                      <span className="sr-only">Prix de {p.name}</span>
                      <input
                        inputMode="decimal"
                        value={prices[p.id]}
                        onChange={(e) => setPrices((s) => ({ ...s, [p.id]: e.target.value }))}
                        aria-invalid={bad}
                        className={`h-10 w-28 rounded-xl border bg-farine pl-3 pr-7 text-right font-semibold tabular-nums outline-none focus:ring-4 ${
                          bad ? "border-red-400 focus:ring-red-100" : changed ? "border-caramel focus:ring-croute/10" : "border-mie focus:ring-croute/10"
                        }`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-grege">€</span>
                    </label>
                    {changed && !bad && (
                      <button type="button" onClick={() => setPrices((s) => ({ ...s, [p.id]: toEuros(p.price) }))} className="text-xs font-semibold text-grege hover:text-croute" title="Revenir au prix d'origine">
                        ↺
                      </button>
                    )}
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={!isOff}
                        onChange={(e) =>
                          setOff((s) => {
                            const n = new Set(s);
                            if (e.target.checked) n.delete(p.id);
                            else n.add(p.id);
                            return n;
                          })
                        }
                        className="h-5 w-5 accent-olive"
                      />
                      En vente
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <AnimatePresence>
        {(dirty || message) && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-full bg-cafe py-2.5 pl-6 pr-2.5 text-creme shadow-2xl"
          >
            <span className="text-sm">
              {message ? message.text : invalid.length ? `${invalid.length} prix invalide(s)` : "Modifications non enregistrées"}
              {!message && updatedAt && <span className="ml-2 text-creme/50">· dernier enregistrement {new Date(updatedAt).toLocaleString("fr-FR")}</span>}
            </span>
            {dirty && (
              <button
                type="button"
                onClick={save}
                disabled={pending || invalid.length > 0}
                className="h-11 rounded-full bg-dore px-6 text-sm font-semibold text-torref transition hover:bg-creme disabled:opacity-50"
              >
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
