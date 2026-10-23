"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProductCard, type CardProduct } from "@/components/site/ProductCard";
import { VioletMark } from "@/components/site/Logo";
import { cn } from "@/lib/cn";

type P = CardProduct & { categoryId: string; occasionIds: string[]; featured: boolean; description: string; sortOrder: number; tags: string[] };
type Opt = { id: string; slug: string; name: string };

const SORTS = [
  { id: "selection", label: "Sélection de la Maison" },
  { id: "prix-asc", label: "Prix croissant" },
  { id: "prix-desc", label: "Prix décroissant" },
  { id: "nouveautes", label: "Nouveautés" },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ShopBrowser({
  products,
  categories,
  occasions,
  initial,
}: {
  products: P[];
  categories: Opt[];
  occasions: Opt[];
  initial: { categorie?: string; occasion?: string; q?: string; tri?: string; max?: string };
}) {
  const pathname = usePathname();
  const [cat, setCat] = useState(initial.categorie || "");
  const [occ, setOcc] = useState(initial.occasion || "");
  const [q, setQ] = useState(initial.q || "");
  const [sort, setSort] = useState(initial.tri || "selection");
  const maxPrice = Math.ceil(Math.max(...products.map((p) => p.price), 100) / 1000) * 10;
  const [max, setMax] = useState(Number(initial.max) || maxPrice);
  const [panel, setPanel] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (cat) sp.set("categorie", cat);
    if (occ) sp.set("occasion", occ);
    if (q) sp.set("q", q);
    if (sort !== "selection") sp.set("tri", sort);
    if (max < maxPrice) sp.set("max", String(max));
    const qs = sp.toString();
    // mise à jour « superficielle » de l'URL (pas d'aller-retour serveur)
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [cat, occ, q, sort, max, maxPrice, pathname]);

  const list = useMemo(() => {
    const c = categories.find((x) => x.slug === cat);
    const o = occasions.find((x) => x.slug === occ);
    const nq = norm(q.trim());
    const out = products.filter(
      (p) =>
        (!c || p.categoryId === c.id) &&
        (!o || p.occasionIds.includes(o.id)) &&
        p.price <= max * 100 &&
        (!nq || norm(`${p.name} ${p.subtitle} ${p.description} ${p.star || ""} ${p.tags.join(" ")}`).includes(nq)),
    );
    if (sort === "prix-asc") out.sort((a, b) => a.price - b.price);
    else if (sort === "prix-desc") out.sort((a, b) => b.price - a.price);
    else if (sort === "nouveautes") out.sort((a, b) => Number(b.isNew) - Number(a.isNew) || a.sortOrder - b.sortOrder);
    else out.sort((a, b) => Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder);
    return out;
  }, [products, categories, occasions, cat, occ, q, sort, max]);

  const activeCat = categories.find((c) => c.slug === cat);
  const reset = () => {
    setCat("");
    setOcc("");
    setQ("");
    setMax(maxPrice);
    setSort("selection");
  };

  return (
    <section className="relative bg-noir pb-32">
      <div className="sticky top-0 z-30 border-y border-ivory/10 bg-noir/85 backdrop-blur-xl lg:top-[88px]">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-6 py-3 sm:px-10 lg:px-16">
          <LayoutGroup>
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto no-scrollbar" role="tablist" aria-label="Catégories">
              {[{ id: "", slug: "", name: "Tout" }, ...categories].map((c) => (
                <button
                  key={c.slug || "all"}
                  role="tab"
                  aria-selected={cat === c.slug}
                  onClick={() => setCat(c.slug)}
                  className={cn("relative shrink-0 rounded-full px-4 py-2 font-caps text-[0.6rem] uppercase tracking-[0.2em] transition-colors", cat === c.slug ? "text-noir" : "text-ivory/60 hover:text-ivory")}
                >
                  {cat === c.slug && <motion.span layoutId="shop-pill" className="absolute inset-0 rounded-full bg-ivory" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  <span className="relative">{c.name}</span>
                </button>
              ))}
            </div>
          </LayoutGroup>
          <button onClick={() => setPanel((v) => !v)} className={cn("flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs transition", panel ? "border-gold text-gold" : "border-ivory/15 text-ivory/75 hover:border-ivory/40")} aria-expanded={panel}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filtres
          </button>
        </div>
        <AnimatePresence>
          {panel && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-ivory/10">
              <div className="mx-auto grid max-w-[1600px] gap-8 px-6 py-6 sm:px-10 md:grid-cols-[1.2fr_1fr_1fr_1fr] lg:px-16">
                <div>
                  <label className="label text-ivory" htmlFor="shop-q">
                    Rechercher
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ivory/40" />
                    <input id="shop-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rose, pivoine, Orion…" className="field-box pl-11" />
                  </div>
                </div>
                <div>
                  <label className="label text-ivory" htmlFor="shop-occ">
                    Occasion
                  </label>
                  <select id="shop-occ" value={occ} onChange={(e) => setOcc(e.target.value)} className="field-box appearance-none">
                    <option value="" className="bg-noir">
                      Toutes les occasions
                    </option>
                    {occasions.map((o) => (
                      <option key={o.slug} value={o.slug} className="bg-noir">
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label text-ivory" htmlFor="shop-max">
                    Budget max · <span className="text-gold">{max} €</span>
                  </label>
                  <input id="shop-max" type="range" min={20} max={maxPrice} step={5} value={max} onChange={(e) => setMax(Number(e.target.value))} className="mt-3 w-full accent-[#C6A15B]" />
                </div>
                <div>
                  <label className="label text-ivory" htmlFor="shop-sort">
                    Trier par
                  </label>
                  <select id="shop-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="field-box appearance-none">
                    {SORTS.map((s) => (
                      <option key={s.id} value={s.id} className="bg-noir">
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mx-auto max-w-[1600px] px-6 pt-12 sm:px-10 lg:px-16">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-ivory/55">
            <span className="font-display text-2xl text-ivory">{list.length}</span> création{list.length > 1 ? "s" : ""}
            {activeCat && <> · {activeCat.name}</>}
          </p>
          <div className="flex flex-wrap gap-2">
            {occ && (
              <button onClick={() => setOcc("")} className="flex items-center gap-1.5 rounded-full bg-aubergine-800 px-3 py-1 text-xs">
                {occasions.find((o) => o.slug === occ)?.name} <X className="h-3 w-3" />
              </button>
            )}
            {q && (
              <button onClick={() => setQ("")} className="flex items-center gap-1.5 rounded-full bg-aubergine-800 px-3 py-1 text-xs">
                « {q} » <X className="h-3 w-3" />
              </button>
            )}
            {max < maxPrice && (
              <button onClick={() => setMax(maxPrice)} className="flex items-center gap-1.5 rounded-full bg-aubergine-800 px-3 py-1 text-xs">
                ≤ {max} € <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <VioletMark className="h-16 w-16 text-gold/70" strokeWidth={1} />
            <p className="mt-6 font-display text-3xl italic">Aucune création ne correspond…</p>
            <p className="mt-2 text-ivory/55">Essayez d&apos;élargir vos filtres, ou demandez-nous une création sur mesure.</p>
            <button onClick={reset} className="btn btn-ghost mt-8 text-ivory">
              <span>Réinitialiser les filtres</span>
            </button>
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {list.map((p, i) => (
                <motion.div key={p.id} layout initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                  <ProductCard product={p} index={i} priority={i < 4} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </section>
  );
}
