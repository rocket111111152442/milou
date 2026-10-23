"use client";

/* eslint-disable @next/next/no-img-element */
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import { CATEGORIES, PRODUCTS, formatPrice } from "@/lib/catalog";
import type { CustomProduct, ProductFields } from "@/lib/settings";
import { updateSettings as updateSettingsAction } from "../actions";
import { ProductForm, parseEuros, toEuros } from "./ProductForm";

type Initial = { prices: Record<string, number>; unavailable: string[]; hidden: string[]; custom: CustomProduct[]; edits: Record<string, ProductFields> };
type Row = ProductFields & { id: string; price: number; custom?: CustomProduct; edited?: boolean };

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((id) => b.has(id));

/** Enregistre une partie des réglages ; lève l'erreur du serveur si l'enregistrement échoue. */
async function updateSettings(patch: Parameters<typeof updateSettingsAction>[0]) {
  const r = await updateSettingsAction(patch);
  if (!r.ok) throw new Error(r.error);
}

export function CatalogEditor({ initial, updatedAt }: { initial: Initial; updatedAt: string | null }) {
  const [custom, setCustom] = useState(initial.custom);
  const [edits, setEdits] = useState(initial.edits);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(PRODUCTS.map((p) => [p.id, toEuros(initial.prices[p.id] ?? p.price)])),
  );
  const [off, setOff] = useState(() => new Set(initial.unavailable));
  const [hidden, setHidden] = useState(() => new Set(initial.hidden));
  const [saved, setSaved] = useState({ prices: initial.prices, off: new Set(initial.unavailable), hidden: new Set(initial.hidden) });
  const [editing, setEditing] = useState<CustomProduct | "new" | null>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [query, setQuery] = useState("");

  const invalid = PRODUCTS.filter((p) => parseEuros(prices[p.id]) === null).map((p) => p.id);

  const dirty = useMemo(() => {
    const changedPrice = PRODUCTS.some((p) => parseEuros(prices[p.id]) !== (saved.prices[p.id] ?? p.price));
    return changedPrice || !sameSet(off, saved.off) || !sameSet(hidden, saved.hidden);
  }, [prices, off, hidden, saved]);

  const flash = (ok: boolean, text: string) => {
    setMessage({ ok, text });
    if (ok) setTimeout(() => setMessage((m) => (m?.text === text ? null : m)), 4000);
  };

  const save = () => {
    setMessage(null);
    const nextPrices: Record<string, number> = {};
    for (const p of PRODUCTS) {
      const v = parseEuros(prices[p.id]);
      if (v !== null && v !== p.price) nextPrices[p.id] = v;
    }
    start(async () => {
      try {
        await updateSettings({ prices: nextPrices, unavailable: [...off], hidden: [...hidden] });
        setSaved({ prices: nextPrices, off: new Set(off), hidden: new Set(hidden) });
        flash(true, "Enregistré : la carte du site est à jour.");
      } catch (e) {
        flash(false, `Échec de l'enregistrement : ${(e as Error).message}`);
      }
    });
  };

  // Les produits ajoutés sont enregistrés tout de suite (pas besoin du bouton « Enregistrer »).
  const saveCustom = async (next: CustomProduct[], text: string) => {
    await updateSettings({ custom: next });
    setCustom(next);
    flash(true, text);
  };

  const onSaveProduct = async (p: CustomProduct) => {
    const base = PRODUCTS.find((x) => x.id === p.id);
    if (base) {
      // Produit d'origine : les champs modifiés sont mémorisés à part, le prix reste dans « prix modifiés »
      const { id, price, ...fields } = p;
      const nextEdits = { ...edits, [id]: fields };
      const nextPrices = { ...saved.prices };
      if (price === base.price) delete nextPrices[id];
      else nextPrices[id] = price;
      await updateSettings({ edits: nextEdits, prices: nextPrices });
      setEdits(nextEdits);
      setPrices((s) => ({ ...s, [id]: toEuros(price) }));
      setSaved((s) => ({ ...s, prices: nextPrices }));
      flash(true, `« ${p.name} » modifié.`);
      setEditing(null);
      return;
    }
    const exists = custom.some((c) => c.id === p.id);
    await saveCustom(exists ? custom.map((c) => (c.id === p.id ? p : c)) : [...custom, p], exists ? `« ${p.name} » modifié.` : `« ${p.name} » ajouté à la carte.`);
    setEditing(null);
  };

  const restore = (id: string, name: string) => {
    if (!confirm(`Rétablir « ${name} » tel qu'il était à l'origine (nom, photo, description, choix) ?`)) return;
    start(async () => {
      try {
        const next = { ...edits };
        delete next[id];
        await updateSettings({ edits: next });
        setEdits(next);
        flash(true, `« ${name} » rétabli.`);
      } catch (e) {
        flash(false, `Échec : ${(e as Error).message}`);
      }
    });
  };

  const remove = (p: CustomProduct) => {
    if (!confirm(`Supprimer « ${p.name} » de la carte ? Cette action est définitive.`)) return;
    start(async () => {
      try {
        await saveCustom(custom.filter((c) => c.id !== p.id), `« ${p.name} » supprimé.`);
      } catch (e) {
        flash(false, `Échec de la suppression : ${(e as Error).message}`);
      }
    });
  };

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string, on: boolean) =>
    set((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const rows: Row[] = [...PRODUCTS.map((p): Row => ({ ...p, ...edits[p.id], edited: !!edits[p.id] })), ...custom.map((c): Row => ({ ...c, custom: c }))];
  const q = query.trim().toLowerCase();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Carte & prix</h1>
          <p className="mt-1 max-w-xl text-sm text-cafe/70">
            Ajoutez vos produits, modifiez un prix, décochez « en vente » en cas de rupture ou retirez un produit de la
            carte. Les changements s&apos;appliquent aux deux boutiques.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit…"
            className="h-11 min-w-0 flex-1 rounded-full border border-mie bg-creme px-4 text-sm outline-none focus:border-croute sm:w-56"
          />
          <button type="button" onClick={() => setEditing("new")} className="h-11 rounded-full bg-croute px-5 text-sm font-semibold text-creme transition hover:bg-cafe">
            + Ajouter un produit
          </button>
        </div>
      </div>

      {CATEGORIES.map((cat) => {
        const list = rows.filter((p) => p.category === cat.id && (!q || p.name.toLowerCase().includes(q)));
        if (!list.length) return null;
        return (
          <section key={cat.id} className="mt-8">
            <h2 className="mb-3 font-display text-2xl">{cat.label}</h2>
            <ul className="divide-y divide-mie overflow-hidden rounded-[1.5rem] bg-creme ring-1 ring-mie">
              {list.map((p) => {
                const isHidden = !p.custom && hidden.has(p.id);
                const isOff = off.has(p.id);
                const bad = !p.custom && invalid.includes(p.id);
                const changed = !p.custom && parseEuros(prices[p.id]) !== p.price;
                return (
                  <li key={p.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap ${isHidden ? "opacity-50" : isOff ? "bg-mie/30" : ""}`}>
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-mie">
                      {p.image && <img src={p.image} alt="" className="h-full w-full object-cover" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold ${isOff || isHidden ? "text-grege line-through" : ""}`}>
                        {p.name}
                        {p.custom && <span className="ml-2 rounded-full bg-olive/15 px-2 py-0.5 align-middle text-[11px] font-semibold text-olive">Ajouté</span>}
                        {p.edited && <span className="ml-2 rounded-full bg-caramel/20 px-2 py-0.5 align-middle text-[11px] font-semibold text-croute">Modifié</span>}
                        {isHidden && <span className="ml-2 align-middle text-xs font-semibold no-underline">· retiré de la carte</span>}
                      </p>
                      <p className="text-xs text-grege">
                        {p.unit ? `${p.unit} · ` : ""}
                        {p.custom ? formatPrice(p.price) : `prix d'origine ${formatPrice(p.price)}`}
                        {p.leadHours ? ` · sur commande ${p.leadHours} h` : ""}
                        {p.groups?.length ? ` · choix : ${p.groups.map((g) => g.label).join(", ")}` : ""}
                      </p>
                    </div>

                    {p.custom ? (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setEditing(p.custom!)} className="h-9 rounded-full border border-mie px-4 text-xs font-semibold transition hover:bg-mie">
                          Modifier
                        </button>
                        <button type="button" onClick={() => remove(p.custom!)} disabled={pending} className="h-9 rounded-full px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50">
                          Supprimer
                        </button>
                      </div>
                    ) : (
                      <>
                        <label className="relative">
                          <span className="sr-only">Prix de {p.name}</span>
                          <input
                            inputMode="decimal"
                            value={prices[p.id]}
                            disabled={isHidden}
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
                      </>
                    )}

                    {!isHidden && (
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={!isOff} onChange={(e) => toggle(setOff, p.id, !e.target.checked)} className="h-5 w-5 accent-olive" />
                        En vente
                      </label>
                    )}
                    {!p.custom && (
                      <button
                        type="button"
                        onClick={() => setEditing({ ...p, price: parseEuros(prices[p.id]) ?? p.price, edited: undefined } as CustomProduct)}
                        className="h-9 rounded-full border border-mie px-4 text-xs font-semibold transition hover:bg-mie"
                      >
                        Modifier
                      </button>
                    )}
                    {p.edited && (
                      <button type="button" onClick={() => restore(p.id, p.name)} disabled={pending} className="text-xs font-semibold text-grege underline-offset-2 hover:text-croute hover:underline">
                        Rétablir
                      </button>
                    )}
                    {!p.custom && (
                      <button
                        type="button"
                        onClick={() => toggle(setHidden, p.id, !isHidden)}
                        className="text-xs font-semibold text-grege underline-offset-2 hover:text-croute hover:underline"
                      >
                        {isHidden ? "Remettre sur la carte" : "Retirer de la carte"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <AnimatePresence>{editing && <ProductForm key="form" initial={editing === "new" ? undefined : editing} original={editing !== "new" && !custom.some((c) => c.id === editing.id)} onSave={onSaveProduct} onCancel={() => setEditing(null)} />}</AnimatePresence>

      <AnimatePresence>
        {(dirty || message) && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={`fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-full py-2.5 pl-6 pr-2.5 text-creme shadow-2xl ${message && !message.ok ? "bg-red-800" : "bg-cafe"}`}
          >
            <span className="py-2 text-sm">
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
