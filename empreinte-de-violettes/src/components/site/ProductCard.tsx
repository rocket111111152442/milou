"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Tilt } from "@/components/motion/Reveal";
import { cn } from "@/lib/cn";
import { flyToCart } from "@/lib/fly";
import { euro } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useCart } from "@/store/cart";
import { StarGlyph } from "./Social";
import { SmartImage } from "./SmartImage";

export type CardProduct = Pick<Product, "id" | "slug" | "name" | "subtitle" | "price" | "images" | "variants" | "isNew" | "seasonal" | "stock" | "star" | "compareAtPrice">;

export function ProductCard({ product, index = 0, tone = "dark", priority = false }: { product: CardProduct; index?: number; tone?: "dark" | "light"; priority?: boolean }) {
  const add = useCart((s) => s.add);
  const imgRef = useRef<HTMLDivElement>(null);
  const soldOut = product.stock != null && product.stock <= 0;
  const fromPrice = product.variants.length ? Math.min(...product.variants.map((v) => v.price)) : product.price;
  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (soldOut) return;
    const v = product.variants[0];
    flyToCart(imgRef.current, product.images[0]);
    add({ productId: product.id, slug: product.slug, name: product.name, image: product.images[0], variantId: v?.id, variantName: v?.name, unitPrice: v?.price ?? product.price, quantity: 1, addonIds: [] });
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: (index % 4) * 0.08 }}
      className="group"
    >
      <Link href={`/boutique/${product.slug}`} data-cursor="view" data-cursor-label="Découvrir" className="block">
        <Tilt className="rounded-t-[999px]" max={6}>
          <div ref={imgRef} className="relative aspect-[3/4] overflow-hidden rounded-t-[999px] bg-aubergine-800">
            <SmartImage
              src={product.images[0]}
              alt={product.name}
              fill
              priority={priority}
              sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 25vw"
              className="object-cover transition duration-[1.4s] ease-silk group-hover:scale-110"
            />
            {product.images[1] && (
              <SmartImage
                src={product.images[1]}
                alt=""
                fill
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 25vw"
                className="object-cover opacity-0 transition duration-[1.2s] ease-silk group-hover:scale-105 group-hover:opacity-100"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent opacity-80" />
            <div className="pointer-events-none absolute inset-0 rounded-t-[999px] ring-1 ring-inset ring-gold/0 transition duration-700 group-hover:ring-gold/50" />
            <div className="absolute left-4 top-1/2 flex -translate-y-1/2 flex-col gap-2">
              {product.isNew && <span className="rounded-full bg-ivory px-2.5 py-1 font-caps text-[0.55rem] uppercase tracking-[0.2em] text-noir">Nouveau</span>}
              {product.seasonal && <span className="rounded-full bg-aubergine-700/90 px-2.5 py-1 font-caps text-[0.55rem] uppercase tracking-[0.2em] text-ivory backdrop-blur">Saison</span>}
              {soldOut && <span className="rounded-full bg-noir/80 px-2.5 py-1 font-caps text-[0.55rem] uppercase tracking-[0.2em] text-ivory">Épuisé</span>}
            </div>
            {product.star && (
              <span className="absolute inset-x-0 top-[18%] flex items-center justify-center gap-2 font-caps text-[0.55rem] uppercase tracking-[0.3em] text-ivory/0 transition duration-700 group-hover:text-ivory/90">
                <StarGlyph className="h-2.5 w-2.5 text-gold" /> {product.star}
              </span>
            )}
            <button
              onClick={quickAdd}
              disabled={soldOut}
              aria-label={`Ajouter ${product.name} au panier`}
              data-cursor="link"
              className="absolute bottom-4 right-4 flex h-11 w-11 translate-y-3 items-center justify-center rounded-full bg-ivory text-noir opacity-0 shadow-xl transition duration-500 ease-silk hover:bg-gold group-hover:translate-y-0 group-hover:opacity-100 disabled:hidden max-lg:translate-y-0 max-lg:opacity-100"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </Tilt>
        <div className={cn("mt-5 flex items-start justify-between gap-4", tone === "light" ? "text-noir" : "text-ivory")}>
          <div className="min-w-0">
            <h3 className="font-display text-2xl leading-none transition group-hover:italic">{product.name}</h3>
            <p className={cn("mt-1.5 truncate text-sm", tone === "light" ? "text-noir/55" : "text-ivory/55")}>{product.subtitle}</p>
          </div>
          <p className="shrink-0 text-right">
            {product.variants.length > 1 && <span className={cn("block text-[0.6rem] uppercase tracking-[0.18em]", tone === "light" ? "text-noir/45" : "text-ivory/45")}>dès</span>}
            <span className="font-display text-xl tabular-nums">{euro(fromPrice, { compact: true })}</span>
          </p>
        </div>
      </Link>
    </motion.article>
  );
}
