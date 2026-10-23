"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ProductCard, type CardProduct } from "@/components/site/ProductCard";
import { SectionTitle } from "@/components/site/SectionTitle";
import { cn } from "@/lib/cn";

export function Featured({ products, categories }: { products: (CardProduct & { categoryId: string; featured: boolean })[]; categories: { id: string; name: string }[] }) {
  const [cat, setCat] = useState("featured");
  const tabs = [{ id: "featured", name: "Coups de cœur" }, ...categories.filter((c) => products.some((p) => p.categoryId === c.id))];
  const list = useMemo(() => (cat === "featured" ? products.filter((p) => p.featured) : products.filter((p) => p.categoryId === cat)).slice(0, 8), [cat, products]);

  return (
    <section id="boutique" className="relative bg-noir py-28 sm:py-36">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-16">
        <div className="flex flex-col justify-between gap-10 lg:flex-row lg:items-end">
          <SectionTitle eyebrow="La boutique" title="Les créations" accent="du moment" />
          <Link href="/boutique" className="btn btn-ghost self-start text-ivory lg:self-auto">
            <span>Toute la boutique</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <LayoutGroup>
          <div className="mt-12 flex gap-2 overflow-x-auto pb-2 no-scrollbar" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={cat === t.id}
                onClick={() => setCat(t.id)}
                className={cn(
                  "relative shrink-0 rounded-full px-5 py-2.5 font-caps text-[0.62rem] uppercase tracking-[0.2em] transition-colors",
                  cat === t.id ? "text-noir" : "text-ivory/65 hover:text-ivory",
                )}
              >
                {cat === t.id && <motion.span layoutId="feat-pill" className="absolute inset-0 rounded-full bg-ivory" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                <span className="relative">{t.name}</span>
              </button>
            ))}
          </div>

          <motion.div layout className="mt-12 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {list.map((p, i) => (
                <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.5 }}>
                  <ProductCard product={p} index={i} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </div>
    </section>
  );
}
