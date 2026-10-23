"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Minus, Plus, RotateCcw, Shuffle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { BouquetArt, kindFromName, type Stem } from "@/components/site/BouquetArt";
import { cn } from "@/lib/cn";
import { flyToCart } from "@/lib/fly";
import { euro } from "@/lib/format";
import type { AtelierSettings } from "@/lib/types";
import { useCart } from "@/store/cart";

const PRESETS: { name: string; picks: [string, number][] }[] = [
  { name: "Romantique", picks: [["rose de jardin", 5], ["pivoine", 3], ["lisianthus", 3], ["eucalyptus", 3], ["matricaire", 3]] },
  { name: "Provence", picks: [["lavande", 6], ["olivier", 3], ["renoncule", 4], ["graminées", 3], ["matricaire", 3]] },
  { name: "Sauvage", picks: [["rose prune", 4], ["dahlia", 3], ["muflier", 3], ["fougère", 4], ["graminées", 3], ["anémone", 2]] },
  { name: "Blanc pur", picks: [["anémone", 5], ["matricaire", 5], ["eucalyptus", 4], ["fougère", 3]] },
];

export function Composer({ atelier }: { atelier: AtelierSettings }) {
  const add = useCart((s) => s.add);
  const flowers = atelier.flowers.filter((f) => f.active);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [wrapId, setWrapId] = useState(atelier.wrappings[0]?.id);
  const [note, setNote] = useState("");
  const [added, setAdded] = useState(false);
  const [filter, setFilter] = useState<"tout" | "fleur" | "feuillage">("tout");
  const artRef = useRef<HTMLDivElement>(null);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const wrap = atelier.wrappings.find((w) => w.id === wrapId) || atelier.wrappings[0];
  const price = atelier.basePrice + flowers.reduce((s, f) => s + (counts[f.id] || 0) * f.price, 0) + (wrap?.price || 0);

  const stems: Stem[] = useMemo(
    () =>
      flowers.flatMap((f) =>
        Array.from({ length: counts[f.id] || 0 }, (_, k) => ({ id: `${f.id}-${k}`, kind: kindFromName(f.name, f.kind), color: f.color })),
      ),
    [flowers, counts],
  );
  // ordre de placement stable mais mélangé (les tiges d'une même fleur ne s'agglutinent pas)
  const ordered = useMemo(() => {
    const out = [...stems];
    out.sort((a, b) => hash(a.id) - hash(b.id));
    return out;
  }, [stems]);

  const change = (id: string, d: number) =>
    setCounts((c) => {
      const cur = c[id] || 0;
      if (d > 0 && total >= atelier.maxStems) return c;
      const next = Math.max(0, cur + d);
      const out = { ...c, [id]: next };
      if (!next) delete out[id];
      return out;
    });

  const preset = (picks: [string, number][]) => {
    const out: Record<string, number> = {};
    let n = 0;
    for (const [name, q] of picks) {
      const f = flowers.find((x) => x.name.toLowerCase().includes(name));
      if (f && n + q <= atelier.maxStems) {
        out[f.id] = q;
        n += q;
      }
    }
    setCounts(out);
  };

  const inspire = () => {
    const fl = flowers.filter((f) => f.kind === "fleur").sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 2));
    const fo = flowers.filter((f) => f.kind === "feuillage").sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2));
    const out: Record<string, number> = {};
    let n = 0;
    for (const f of [...fl, ...fo]) {
      const q = f.kind === "fleur" ? 2 + Math.floor(Math.random() * 4) : 2 + Math.floor(Math.random() * 2);
      if (n + q > atelier.maxStems) break;
      out[f.id] = q;
      n += q;
    }
    setCounts(out);
  };

  const summary = flowers
    .filter((f) => counts[f.id])
    .map((f) => `${counts[f.id]} ${f.name.toLowerCase()}`)
    .join(", ");

  const onAdd = () => {
    if (total < atelier.minStems) return;
    flyToCart(artRef.current);
    add({
      productId: null,
      name: "Création de l'atelier",
      variantName: `${total} tiges · ${wrap?.name}`,
      unitPrice: price,
      quantity: 1,
      addonIds: [],
      custom: { stems: Object.entries(counts).map(([flowerId, quantity]) => ({ flowerId, quantity })), wrappingId: wrap?.id, note, summary },
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2400);
  };

  const shown = flowers.filter((f) => filter === "tout" || f.kind === filter);
  const ratio = total / atelier.maxStems;

  return (
    <section className="fern-paper relative bg-paper pb-28 pt-12 text-noir">
      <div className="mx-auto grid max-w-[1600px] gap-12 px-6 sm:px-10 lg:grid-cols-[1.05fr_1fr] lg:gap-20 lg:px-16">
        {/* aperçu */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div ref={artRef} className="relative mx-auto aspect-[400/470] w-full max-w-[560px]">
            <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(185,162,207,0.45),transparent_65%)] blur-2xl" />
            <BouquetArt stems={ordered} wrapColor={wrap?.color} isVase={wrap?.id === "wrap_vase" || /vase/i.test(wrap?.name || "")} className="relative h-full w-full overflow-visible drop-shadow-[0_30px_40px_rgba(38,21,47,0.22)]" />
            <AnimatePresence>
              {total === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-x-0 top-[28%] text-center">
                  <p className="font-display text-3xl italic text-aubergine-700">Votre bouquet commence ici</p>
                  <p className="mt-2 text-sm text-noir/55">Ajoutez des tiges, ou laissez-vous inspirer.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="mx-auto mt-6 flex max-w-[560px] flex-wrap justify-center gap-2">
            {PRESETS.map((p) => (
              <button key={p.name} onClick={() => preset(p.picks)} className="rounded-full border border-noir/15 bg-white/50 px-4 py-2 text-xs uppercase tracking-[0.16em] transition hover:border-aubergine-600 hover:bg-aubergine-700 hover:text-ivory">
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* configuration */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-1 rounded-full border border-noir/10 bg-white/50 p-1">
              {(["tout", "fleur", "feuillage"] as const).map((k) => (
                <button key={k} onClick={() => setFilter(k)} className={cn("relative rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.14em]", filter === k ? "text-ivory" : "text-noir/60")}>
                  {filter === k && <motion.span layoutId="comp-filter" className="absolute inset-0 rounded-full bg-aubergine-700" />}
                  <span className="relative">{k === "tout" ? "Tout" : k === "fleur" ? "Fleurs" : "Feuillages"}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={inspire} className="flex items-center gap-2 rounded-full border border-noir/15 px-4 py-2 text-xs uppercase tracking-[0.14em] transition hover:border-aubergine-600">
                <Shuffle className="h-3.5 w-3.5" /> Inspirez-moi
              </button>
              <button onClick={() => setCounts({})} className="flex items-center gap-2 rounded-full border border-noir/15 px-4 py-2 text-xs uppercase tracking-[0.14em] transition hover:border-aubergine-600">
                <RotateCcw className="h-3.5 w-3.5" /> Recommencer
              </button>
            </div>
          </div>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {shown.map((f) => {
              const n = counts[f.id] || 0;
              return (
                <motion.li key={f.id} layout className={cn("flex items-center gap-4 rounded-2xl border p-3 pr-2 transition", n ? "border-aubergine-500 bg-white" : "border-noir/10 bg-white/50")}>
                  <span className="relative h-11 w-11 shrink-0 rounded-full border border-noir/10" style={{ background: `radial-gradient(circle at 35% 30%, #fff8, ${f.color} 55%)` }}>
                    <AnimatePresence>
                      {n > 0 && (
                        <motion.span key={n} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-aubergine-700 px-1 text-[0.6rem] text-ivory">
                          {n}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg leading-tight">{f.name}</span>
                    <span className="text-xs text-noir/50">{euro(f.price)} la tige</span>
                  </span>
                  <span className="flex items-center">
                    <button onClick={() => change(f.id, -1)} disabled={!n} className="rounded-full p-2 text-noir/50 transition hover:bg-noir/5 hover:text-noir disabled:opacity-30" aria-label={`Retirer une tige de ${f.name}`}>
                      <Minus className="h-4 w-4" />
                    </button>
                    <button onClick={() => change(f.id, 1)} disabled={total >= atelier.maxStems} className="rounded-full p-2 text-noir/70 transition hover:bg-aubergine-700 hover:text-ivory disabled:opacity-30" aria-label={`Ajouter une tige de ${f.name}`}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </span>
                </motion.li>
              );
            })}
          </ul>

          <div className="mt-10">
            <p className="label text-noir">Emballage</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {atelier.wrappings.map((w) => (
                <button key={w.id} onClick={() => setWrapId(w.id)} className={cn("rounded-2xl border p-3 text-left transition", w.id === wrapId ? "border-aubergine-600 bg-white" : "border-noir/10 bg-white/50 hover:border-noir/30")} aria-pressed={w.id === wrapId}>
                  <span className="block h-8 w-8 rounded-full border border-noir/10" style={{ background: w.color }} />
                  <span className="mt-2 block text-sm leading-tight">{w.name}</span>
                  <span className="text-xs text-noir/50">{w.price ? `+ ${euro(w.price)}` : "Offert"}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <label htmlFor="comp-note" className="label text-noir">
              Une indication pour la fleuriste ? (facultatif)
            </label>
            <textarea id="comp-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={2} placeholder="Tons plutôt pastel, sans lys, pour une naissance…" className="field-box-light resize-none" />
          </div>

          <div className="sticky bottom-4 mt-10 rounded-3xl border border-noir/10 bg-noir p-6 text-ivory shadow-2xl">
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ivory/50">
                  {total} / {atelier.maxStems} tiges {total < atelier.minStems && <span className="text-gold-light">· minimum {atelier.minStems}</span>}
                </p>
                <div className="mt-3 h-1 w-48 overflow-hidden rounded-full bg-ivory/10">
                  <motion.div className="bg-foil h-full" animate={{ width: `${ratio * 100}%` }} transition={{ duration: 0.5 }} />
                </div>
                <p className="mt-2 text-[0.7rem] text-ivory/45">Composition {euro(atelier.basePrice)} incluse</p>
              </div>
              <AnimatePresence mode="popLayout">
                <motion.p key={price} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -16, opacity: 0 }} className="font-display text-4xl tabular-nums">
                  {euro(price)}
                </motion.p>
              </AnimatePresence>
            </div>
            <button onClick={onAdd} disabled={total < atelier.minStems} className="btn btn-gold mt-5 w-full">
              {added ? (
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4" /> Ajouté au panier
                </span>
              ) : (
                <span>Ajouter ma création au panier</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
