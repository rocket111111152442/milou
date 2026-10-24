"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { EASE } from "@/components/herbier/Elements";
import { Plate } from "@/components/herbier/Plate";
import { cn } from "@/lib/cn";
import { euro } from "@/lib/format";
import { plateFor } from "@/lib/plates";
import type { AtelierSettings } from "@/lib/types";
import { useCart } from "@/store/cart";

const PRESETS: { name: string; picks: [string, number][] }[] = [
  { name: "Romantique", picks: [["rose de jardin", 5], ["pivoine", 3], ["lisianthus", 3], ["eucalyptus", 3], ["matricaire", 3]] },
  { name: "Provence", picks: [["lavande", 6], ["olivier", 3], ["renoncule", 4], ["graminées", 3], ["matricaire", 3]] },
  { name: "Sauvage", picks: [["rose prune", 4], ["dahlia", 3], ["muflier", 3], ["fougère", 4], ["graminées", 3], ["anémone", 2]] },
  { name: "Blanc pur", picks: [["anémone", 5], ["matricaire", 5], ["eucalyptus", 4], ["fougère", 3]] },
];

/** L'atelier : on choisit ses tiges, la planche se compose sous nos yeux, gravure après gravure. */
export function Composer({ atelier }: { atelier: AtelierSettings }) {
  const add = useCart((s) => s.add);
  const flowers = useMemo(() => atelier.flowers.filter((f) => f.active).map((f) => ({ ...f, plate: plateFor(f) })), [atelier.flowers]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [wrapId, setWrapId] = useState(atelier.wrappings[0]?.id);
  const [note, setNote] = useState("");
  const [added, setAdded] = useState(false);
  const [filter, setFilter] = useState<"tout" | "fleur" | "feuillage">("tout");

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const wrap = atelier.wrappings.find((w) => w.id === wrapId) || atelier.wrappings[0];
  const stemsPrice = flowers.reduce((s, f) => s + (counts[f.id] || 0) * f.price, 0);
  const price = atelier.basePrice + stemsPrice + (wrap?.price || 0);

  // disposition en éventail : feuillages aux bords et derrière, fleurs au centre et devant
  const chosen = flowers.filter((f) => counts[f.id]);
  const layout = useMemo(() => {
    const leaves = chosen.filter((f) => f.kind === "feuillage");
    const blooms = chosen.filter((f) => f.kind !== "feuillage");
    const order = [...leaves.slice(0, Math.ceil(leaves.length / 2)), ...blooms, ...leaves.slice(Math.ceil(leaves.length / 2))];
    const n = order.length;
    const spread = Math.min(46, 12 + n * 7);
    return order.map((f, k) => {
      const t = n === 1 ? 0 : k / (n - 1) - 0.5;
      const leaf = f.kind === "feuillage";
      return {
        f,
        rotate: t * spread * 2 + (leaf ? Math.sign(t || 1) * 4 : 0),
        scale: (leaf ? 0.98 : 0.84) + Math.min(counts[f.id], 6) * 0.03,
        z: leaf ? 1 : 10 - Math.round(Math.abs(t) * 6),
        lift: leaf ? 0 : (1 - Math.abs(t) * 2) * 6,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, flowers]);

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

  const summary = chosen.map((f) => `${counts[f.id]} ${f.name.toLowerCase()}`).join(", ");

  const onAdd = () => {
    if (total < atelier.minStems) return;
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

  return (
    <section className="wrap pb-28">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.08fr] lg:gap-16">
        {/* la planche */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="sheet relative p-4 sm:p-5">
            <span className="tape -top-2 left-[18%] -rotate-[4deg]" aria-hidden />
            <span className="tape -top-2 right-[18%] rotate-[3deg]" aria-hidden />
            <div className="relative aspect-[4/5] overflow-hidden bg-paper-light" aria-label={summary ? `Votre bouquet : ${summary}` : "Votre bouquet est vide"} role="img">
              <AnimatePresence>
                {layout.map(({ f, rotate, scale, z, lift }) => (
                  <motion.div
                    key={f.id}
                    className="absolute bottom-[13%] left-[27%] w-[46%] origin-bottom text-ink"
                    style={{ zIndex: z }}
                    initial={{ opacity: 0, rotate: rotate * 0.6, scale: scale * 0.9, y: 20 }}
                    animate={{ opacity: f.kind === "feuillage" ? 0.78 : 1, rotate, scale, y: -lift * 4 }}
                    exit={{ opacity: 0, scale: scale * 0.92, transition: { duration: 0.35 } }}
                    transition={{ duration: 0.9, ease: EASE }}
                  >
                    <Plate name={f.plate} reveal="mount" duration={1.2} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {/* le lien de raphia, là où les tiges se croisent */}
              <AnimatePresence>
                {total > 0 && (
                  <motion.svg key="tie" viewBox="0 0 80 40" className="absolute bottom-[10%] left-1/2 z-20 w-[16%] -translate-x-1/2 text-ink" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden>
                    <motion.path d="M40 20 C30 6, 12 6, 14 16 C16 26, 32 24, 40 20 C48 24, 64 26, 66 16 C68 6, 50 6, 40 20 M40 20 C36 28, 30 34, 24 38 M40 20 C44 28, 50 34, 57 38" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: EASE }} />
                    <ellipse cx="40" cy="20" rx="3.4" ry="2.6" fill="currentColor" />
                  </motion.svg>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {total === 0 && (
                  <motion.div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="absolute inset-[7%] border border-dashed border-ink/20" />
                    <p className="font-display text-[1.9rem] italic leading-tight">Votre planche commence ici.</p>
                    <p className="body-text mt-3 !text-[1rem]">Ajoutez des tiges : chaque fleur vient s&apos;y graver.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="mt-4 grid grid-cols-[auto_1fr] items-end gap-4">
              <p className="folio pb-1 text-ink-muted">Pl. atelier</p>
              <div className="herb-label min-w-0 px-3 py-2.5">
                <p className="font-display text-[1.2rem] leading-tight">Création de l&apos;atelier</p>
                <p className="truncate font-text text-[0.86rem] italic text-ink-muted">{summary || "aucune tige pour l'instant"}</p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2 font-text text-[1rem]">
            <span className="sc text-ink-muted">S&apos;inspirer —</span>
            {PRESETS.map((p) => (
              <button key={p.name} onClick={() => preset(p.picks)} className="ulink italic">
                {p.name}
              </button>
            ))}
            <button onClick={inspire} className="ulink italic">
              au hasard
            </button>
          </div>
        </div>

        {/* la sélection */}
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-ink/15 pb-4">
            <div className="flex gap-6" role="tablist" aria-label="Type de tiges">
              {(["tout", "fleur", "feuillage"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={cn("font-display text-[1.3rem]", filter === k ? "italic" : "text-ink-muted hover:text-ink")}>
                  <span className={filter === k ? "ulink-on" : "ulink"}>{k === "tout" ? "Tout" : k === "fleur" ? "Fleurs" : "Feuillages"}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setCounts({})} disabled={!total} className="font-text text-[0.95rem] italic text-ink-muted hover:text-ink disabled:opacity-40">
              tout effacer
            </button>
          </div>

          <ul className="mt-6 grid grid-cols-2 gap-px bg-ink/10 sm:grid-cols-3">
            {shown.map((f) => {
              const n = counts[f.id] || 0;
              return (
                <li key={f.id} className={cn("relative flex flex-col bg-paper p-3 transition-colors duration-500 sm:p-4", n > 0 && "bg-paper-light")}>
                  <button onClick={() => change(f.id, 1)} disabled={total >= atelier.maxStems} className="group relative block aspect-[3/4] w-full text-ink-soft disabled:cursor-not-allowed" aria-label={`Ajouter une tige de ${f.name}`}>
                    <Plate name={f.plate} fit="contain" reveal="none" className="absolute inset-[4%] transition-transform duration-700 ease-silk group-hover:scale-[1.04]" />
                    <AnimatePresence>
                      {n > 0 && (
                        <motion.span key={n} className="absolute right-0 top-0 font-display text-[1.6rem] italic leading-none text-plum" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                          {n}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                  <p className="mt-3 font-display text-[1.12rem] leading-tight">{f.name}</p>
                  <div className="mt-1 flex items-baseline justify-between font-text text-[0.88rem]">
                    <span className="italic text-ink-muted">{euro(f.price)} la tige</span>
                    <span className="flex items-center gap-2">
                      <button onClick={() => change(f.id, -1)} disabled={!n} className="px-1 text-[1.05rem] text-ink-muted hover:text-ink disabled:opacity-25" aria-label={`Retirer une tige de ${f.name}`}>
                        −
                      </button>
                      <button onClick={() => change(f.id, 1)} disabled={total >= atelier.maxStems} className="px-1 text-[1.05rem] text-ink-muted hover:text-ink disabled:opacity-25" aria-label={`Ajouter une tige de ${f.name}`}>
                        +
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <fieldset className="min-w-0 mt-12">
            <legend className="sc mb-3 text-ink-muted">Emballage</legend>
            <div className="border-t border-ink/15">
              {atelier.wrappings.map((w) => {
                const on = w.id === wrapId;
                return (
                  <label key={w.id} className={cn("flex cursor-pointer items-baseline gap-4 border-b border-ink/15 py-3 font-text text-[1.02rem]", on ? "text-ink" : "text-ink-soft hover:text-ink")}>
                    <input type="radio" name="wrap" className="sr-only" checked={on} onChange={() => setWrapId(w.id)} />
                    <span className="radio-dot translate-y-[1px]" data-on={on} aria-hidden />
                    <span className={on ? "italic" : ""}>{w.name}</span>
                    <span className="leader" />
                    <span className="tab">{w.price ? `+ ${euro(w.price, { compact: true })}` : "offert"}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-10 block">
            <span className="f-label">Un mot pour la fleuriste (facultatif)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={2} placeholder="Tons plutôt pastel, sans lys, pour une naissance…" className="f-line resize-none" />
          </label>

          {/* bon de composition */}
          <div className="sheet perf-top relative mt-12 px-6 pb-6 pt-8 sm:px-8">
            <p className="sc text-ink-muted">Bon de composition</p>
            <ul className="mt-4 space-y-1.5 font-text text-[1rem]">
              {chosen.length === 0 && <li className="italic text-ink-muted">Aucune tige choisie — minimum {atelier.minStems}.</li>}
              {chosen.map((f) => (
                <li key={f.id} className="flex items-baseline">
                  <span>
                    <span className="tab">{counts[f.id]}</span> × {f.name}
                  </span>
                  <span className="leader" />
                  <span className="tab">{euro(counts[f.id] * f.price)}</span>
                </li>
              ))}
              <li className="flex items-baseline text-ink-soft">
                <span>Composition à la main</span>
                <span className="leader" />
                <span className="tab">{euro(atelier.basePrice)}</span>
              </li>
              {wrap && (
                <li className="flex items-baseline text-ink-soft">
                  <span>{wrap.name}</span>
                  <span className="leader" />
                  <span className="tab">{wrap.price ? euro(wrap.price) : "offert"}</span>
                </li>
              )}
            </ul>
            <div className="mt-5 flex items-baseline border-t border-ink/15 pt-4">
              <span className="sc">
                Total · <span className="tab">{total}</span>/{atelier.maxStems} tiges
              </span>
              <span className="leader" />
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={price} className="tab font-text text-[1.9rem] leading-none" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.4 }}>
                  {euro(price)}
                </motion.span>
              </AnimatePresence>
            </div>
            <button onClick={onAdd} disabled={total < atelier.minStems} className="btn-label mt-6 w-full">
              <span>{added ? "Ajoutée au panier" : total < atelier.minStems ? `Encore ${atelier.minStems - total} tige${atelier.minStems - total > 1 ? "s" : ""} au minimum` : "Ajouter ma création au panier"}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
