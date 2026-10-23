"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, useTransition } from "react";
import { SHOPS, type ShopId } from "@/lib/shops";
import { formatDateLong, parisNow } from "@/lib/hours";
import type { Settings } from "@/lib/settings";
import { updateSettings } from "../actions";

export function ShopSettings({ initialLive, initialClosed, envLive }: { initialLive: Settings["live"]; initialClosed: Settings["closedDates"]; envLive: boolean }) {
  const [live, setLive] = useState(initialLive);
  const [closed, setClosed] = useState(initialClosed);
  const [draft, setDraft] = useState<Partial<Record<ShopId, string>>>({});
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = parisNow().date;

  const persist = (patch: Partial<Settings>, rollback: () => void) => {
    setError(null);
    start(async () => {
      try {
        const r = await updateSettings(patch);
        if (!r.ok) throw new Error(r.error);
      } catch (e) {
        rollback();
        setError(`Échec de l'enregistrement : ${(e as Error).message}`);
      }
    });
  };

  const toggleLive = (id: ShopId) => {
    const prev = live;
    const next = { ...live, [id]: !live[id] };
    if (next[id] && !confirm("Les commandes passées sur le site seront réelles pour cette boutique. Avez-vous vérifié les prix et activé les notifications ?")) return;
    setLive(next);
    persist({ live: next }, () => setLive(prev));
  };

  const addClosed = (id: ShopId) => {
    const d = draft[id];
    if (!d || d < today) return;
    const prev = closed;
    const next = { ...closed, [id]: [...new Set([...(closed[id] ?? []), d])].sort() };
    setClosed(next);
    setDraft((s) => ({ ...s, [id]: "" }));
    persist({ closedDates: next }, () => setClosed(prev));
  };

  const removeClosed = (id: ShopId, d: string) => {
    const prev = closed;
    const next = { ...closed, [id]: (closed[id] ?? []).filter((x) => x !== d) };
    setClosed(next);
    persist({ closedDates: next }, () => setClosed(prev));
  };

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl">Boutiques</h2>
      {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        {SHOPS.map((shop) => {
          const on = envLive || live[shop.id] === true;
          const dates = (closed[shop.id] ?? []).filter((d) => d >= today);
          return (
            <article key={shop.id} className="rounded-[1.75rem] bg-creme p-6 ring-1 ring-mie">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-grege">{shop.city}</p>
              <h3 className="font-display text-2xl">{shop.name}</h3>

              <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-farine p-4">
                <div>
                  <p className="font-semibold">Commande en ligne</p>
                  <p className="text-xs text-grege">
                    {on ? "En service : les commandes sont réelles." : "Mode test : les clients voient un bandeau « commande de test »."}
                    {envLive && " (forcé par ORDERS_LIVE dans Vercel)"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`Commande en ligne ${shop.short}`}
                  disabled={pending || envLive}
                  onClick={() => toggleLive(shop.id)}
                  className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-olive" : "bg-sable"}`}
                >
                  <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} className={`absolute top-1 h-6 w-6 rounded-full bg-creme shadow ${on ? "right-1" : "left-1"}`} />
                </button>
              </div>

              <div className="mt-5">
                <p className="font-semibold">Fermetures exceptionnelles</p>
                <p className="text-xs text-grege">Congés, jours fériés… Aucun retrait ne sera proposé ces jours-là, et la boutique s&apos;affiche fermée.</p>
                <div className="mt-3 flex gap-2">
                  <input
                    type="date"
                    min={today}
                    value={draft[shop.id] ?? ""}
                    onChange={(e) => setDraft((s) => ({ ...s, [shop.id]: e.target.value }))}
                    className="h-10 flex-1 rounded-xl border border-mie bg-farine px-3 text-sm outline-none focus:border-croute"
                  />
                  <button type="button" disabled={!draft[shop.id] || pending} onClick={() => addClosed(shop.id)} className="h-10 rounded-full bg-cafe px-4 text-sm font-semibold text-creme transition hover:bg-croute disabled:opacity-40">
                    Ajouter
                  </button>
                </div>
                <ul className="mt-3 flex flex-wrap gap-2">
                  <AnimatePresence initial={false}>
                    {dates.map((d) => (
                      <motion.li key={d} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="flex items-center gap-2 rounded-full bg-dore/25 py-1 pl-3 pr-1 text-sm">
                        <span className="first-letter:uppercase">{formatDateLong(d)}</span>
                        <button type="button" onClick={() => removeClosed(shop.id, d)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-creme" aria-label={`Retirer ${d}`}>
                          ×
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                  {dates.length === 0 && <li className="text-sm text-grege">Aucune fermeture prévue.</li>}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
