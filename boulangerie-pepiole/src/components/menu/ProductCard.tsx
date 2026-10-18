"use client";

import { motion } from "motion/react";
import { useRef, useState } from "react";
import { formatPrice, type Product } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { flyToCart } from "@/components/cart/FlyToCart";
import { ProductThumb } from "./ProductImage";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const add = useCart((s) => s.add);
  const qtyInCart = useCart((s) => s.lines.find((l) => l.id === product.id)?.qty ?? 0);
  const imgRef = useRef<HTMLDivElement>(null);
  const [added, setAdded] = useState(false);

  const onAdd = () => {
    add(product.id);
    flyToCart(imgRef.current, product.image);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ duration: 0.6, delay: Math.min(index, 8) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="group flex flex-col overflow-hidden rounded-[1.75rem] bg-creme shadow-[0_1px_0_rgba(59,36,22,0.06),0_20px_40px_-28px_rgba(59,36,22,0.45)] ring-1 ring-mie/70"
    >
      <div ref={imgRef} className="relative aspect-[4/3] overflow-hidden">
        <ProductThumb
          product={product}
          className="h-full w-full"
          imgClassName="transition-transform duration-[1.2s] ease-[var(--ease-pain)] group-hover:scale-110"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.badges?.map((b) => (
            <span key={b} className="rounded-full bg-creme/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-cafe backdrop-blur">
              {b}
            </span>
          ))}
        </div>
        {qtyInCart > 0 && (
          <motion.span
            key={qtyInCart}
            initial={{ scale: 0.4, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            className="absolute right-3 top-3 grid h-9 min-w-9 place-items-center rounded-full bg-croute px-2 text-sm font-bold text-creme shadow-lg"
            aria-label={`${qtyInCart} dans le panier`}
          >
            ×{qtyInCart}
          </motion.span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl leading-tight">{product.name}</h3>
          <p className="shrink-0 text-right">
            <span className="block font-display text-xl text-croute">{formatPrice(product.price)}</span>
            {product.unit && <span className="block text-xs text-grege">{product.unit}</span>}
          </p>
        </div>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-cafe/70">{product.description}</p>
        {product.available === false ? (
          <p className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-mie/60 px-5 text-sm font-semibold text-grege">
            Momentanément indisponible
          </p>
        ) : (
        <button
          type="button"
          onClick={onAdd}
          className="relative mt-5 inline-flex h-12 items-center justify-center overflow-hidden rounded-full bg-cafe px-5 text-sm font-semibold text-creme transition-colors hover:bg-croute"
        >
          <motion.span
            className="flex items-center gap-2"
            animate={added ? { y: -40, opacity: 0 } : { y: 0, opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            <span className="text-lg leading-none">+</span> Ajouter au panier
          </motion.span>
          <motion.span
            className="absolute inset-0 flex items-center justify-center gap-2 bg-olive"
            initial={false}
            animate={added ? { y: 0 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            aria-hidden={!added}
          >
            ✓ Ajouté !
          </motion.span>
        </button>
        )}
      </div>
    </motion.article>
  );
}
