"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EASE } from "@/components/herbier/Elements";
import { Plate } from "@/components/herbier/Plate";
import { fromPrice, Specimen, type SpecimenProduct } from "@/components/herbier/Specimen";
import { cn } from "@/lib/cn";

type P = SpecimenProduct & { categoryId: string; occasionIds: string[]; featured: boolean; description: string; sortOrder: number; tags: string[] };
type Opt = { id: string; slug: string; name: string; description?: string };

const SORTS = [
  { id: "selection", label: "la sélection de la Maison" },
  { id: "prix-asc", label: "prix croissant" },
  { id: "prix-desc", label: "prix décroissant" },
  { id: "nouveautes", label: "nouveautés d'abord" },
];
const BUDGETS = [
  { id: "", label: "tous les budgets", min: 0, max: Infinity },
  { id: "40", label: "moins de 40 €", min: 0, max: 4000 },
  { id: "80", label: "de 40 à 80 €", min: 4000, max: 8000 },
  { id: "plus", label: "plus de 80 €", min: 8000, max: Infinity },
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
  initial: { categorie?: string; occasion?: string; q?: string; tri?: string; budget?: string };
}) {
  const pathname = usePathname();
  const [cat, setCat] = useState(initial.categorie || "");
  const [occ, setOcc] = useState(initial.occasion || "");
  const [q, setQ] = useState(initial.q || "");
  const [sort, setSort] = useState(initial.tri || "selection");
  const [budget, setBudget] = useState(BUDGETS.some((b) => b.id === initial.budget) ? initial.budget || "" : "");

  useEffect(() => {
    const sp = new URLSearchParams();
    if (cat) sp.set("categorie", cat);
    if (occ) sp.set("occasion", occ);
    if (q) sp.set("q", q);
    if (sort !== "selection") sp.set("tri", sort);
    if (budget) sp.set("budget", budget);
    const qs = sp.toString();
    // mise à jour « superficielle » de l'URL (pas d'aller-retour serveur)
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [cat, occ, q, sort, budget, pathname]);

  const list = useMemo(() => {
    const c = categories.find((x) => x.slug === cat);
    const o = occasions.find((x) => x.slug === occ);
    const b = BUDGETS.find((x) => x.id === budget) || BUDGETS[0];
    const nq = norm(q.trim());
    const out = products.filter((p) => {
      const price = fromPrice(p);
      return (
        (!c || p.categoryId === c.id) &&
        (!o || p.occasionIds.includes(o.id)) &&
        price >= b.min &&
        price < b.max &&
        (!nq || norm(`${p.name} ${p.subtitle} ${p.description} ${p.tags.join(" ")} ${p.category || ""}`).includes(nq))
      );
    });
    if (sort === "prix-asc") out.sort((a, b) => fromPrice(a) - fromPrice(b));
    else if (sort === "prix-desc") out.sort((a, b) => fromPrice(b) - fromPrice(a));
    else if (sort === "nouveautes") out.sort((a, b) => Number(b.isNew) - Number(a.isNew) || a.sortOrder - b.sortOrder);
    else out.sort((a, b) => Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder);
    return out;
  }, [products, categories, occasions, cat, occ, q, sort, budget]);

  const activeCat = categories.find((c) => c.slug === cat);
  const counts = useMemo(() => Object.fromEntries(categories.map((c) => [c.slug, products.filter((p) => p.categoryId === c.id).length])), [categories, products]);
  const reset = () => {
    setCat("");
    setOcc("");
    setQ("");
    setBudget("");
    setSort("selection");
  };
  const sig = `${cat}|${occ}|${q}|${sort}|${budget}`;

  return (
    <section className="wrap pb-28">
      <div className="border-y border-ink/15 py-5">
        <div className="-mx-1 flex gap-x-6 gap-y-2 overflow-x-auto px-1 pb-1 no-scrollbar sm:flex-wrap" role="tablist" aria-label="Rayons">
          {[{ id: "", slug: "", name: "Tout" }, ...categories].map((c) => {
            const on = cat === c.slug;
            return (
              <button key={c.slug || "all"} role="tab" aria-selected={on} onClick={() => setCat(c.slug)} className={cn("shrink-0 whitespace-nowrap font-display text-[1.35rem] transition-colors duration-300", on ? "italic text-ink" : "text-ink-muted hover:text-ink")}>
                <span className={on ? "ulink-on" : "ulink"}>{c.name}</span>
                <sup className="ml-1 font-text text-[0.7rem] not-italic text-ink-faint">{c.slug ? counts[c.slug] : products.length}</sup>
              </button>
            );
          })}
        </div>
        <div className="mt-5 grid gap-5 font-text text-[1rem] text-ink-soft sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <label className="flex items-baseline gap-3">
            <span className="sc shrink-0 text-ink-muted">Chercher</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="une fleur, un nom…" className="f-line !py-1.5 !text-[1rem]" aria-label="Rechercher" />
          </label>
          <Select label="Occasion" value={occ} onChange={setOcc} options={[{ value: "", label: "toutes" }, ...occasions.map((o) => ({ value: o.slug, label: o.name.toLowerCase() }))]} />
          <Select label="Budget" value={budget} onChange={setBudget} options={BUDGETS.map((b) => ({ value: b.id, label: b.label }))} />
          <Select label="Trier par" value={sort} onChange={setSort} options={SORTS.map((s) => ({ value: s.id, label: s.label }))} />
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-4">
        <AnimatePresence mode="wait">
          <motion.p key={activeCat?.slug || "all"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-2xl font-text text-[1.08rem] italic text-ink-soft">
            {activeCat?.description || "Chaque création est composée à la main le jour même, avec des fleurs locales et de saison. Les photos sont indicatives : votre bouquet sera unique."}
          </motion.p>
        </AnimatePresence>
        <p className="folio text-ink-muted">
          <span className="tab not-italic text-ink">{list.length}</span> création{list.length > 1 ? "s" : ""}
          {(occ || q || budget) && (
            <>
              {" · "}
              <button onClick={() => (setOcc(""), setQ(""), setBudget(""))} className="ulink-on">
                effacer les filtres
              </button>
            </>
          )}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <Plate name="brins" reveal="mount" className="w-64 text-ink-soft" />
          <p className="mt-8 font-display text-[2rem] italic">Aucune création ne correspond.</p>
          <p className="body-text mt-2">Élargissez la recherche, ou demandez-nous une composition sur mesure.</p>
          <button onClick={reset} className="btn-line mt-8">
            Tout afficher <span className="arrow">→</span>
          </button>
        </div>
      ) : (
        <motion.div key={sig} className="mt-12 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-12" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.05 } } }}>
          {list.map((p, i) => (
            <motion.div key={p.id} variants={{ h: { opacity: 0, y: 24 }, s: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } } }}>
              <Specimen p={p} priority={i < 3} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-baseline gap-3">
      <span className="sc shrink-0 text-ink-muted">{label}</span>
      <span className="relative min-w-0 flex-1">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="f-line w-full cursor-pointer appearance-none !py-1.5 pr-6 !text-[1rem] italic">
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[0.7rem] text-ink-muted">▾</span>
      </span>
    </label>
  );
}
