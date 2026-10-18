"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PRODUCTS_BY_ID } from "./catalog";
import { SHOP_IDS, type ShopId } from "./shops";

export type CartLine = { id: string; qty: number };

type CartState = {
  lines: CartLine[];
  /** Boutique de retrait choisie (null tant que le client n'a pas choisi) */
  shop: ShopId | null;
  open: boolean;
  bump: number;
  add: (id: string, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  setShop: (shop: ShopId) => void;
  setOpen: (open: boolean) => void;
};

export const MAX_QTY = 50;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      shop: null,
      open: false,
      bump: 0,
      add: (id, qty = 1) =>
        set((s) => {
          const existing = s.lines.find((l) => l.id === id);
          const lines = existing
            ? s.lines.map((l) => (l.id === id ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l))
            : [...s.lines, { id, qty: Math.min(MAX_QTY, qty) }];
          return { lines, bump: s.bump + 1 };
        }),
      setQty: (id, qty) =>
        set((s) => ({
          lines:
            qty <= 0
              ? s.lines.filter((l) => l.id !== id)
              : s.lines.map((l) => (l.id === id ? { ...l, qty: Math.min(MAX_QTY, qty) } : l)),
        })),
      remove: (id) => set((s) => ({ lines: s.lines.filter((l) => l.id !== id) })),
      clear: () => set({ lines: [] }),
      setShop: (shop) => set({ shop }),
      setOpen: (open) => set({ open }),
    }),
    {
      name: "pepiole-panier",
      // Réhydraté après le montage (voir CartHydrator) pour éviter tout décalage SSR/client
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines, shop: s.shop }),
      // Écarte les produits retirés du catalogue depuis la dernière visite
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { lines?: CartLine[]; shop?: string | null };
        const lines = (p.lines ?? []).filter((l) => PRODUCTS_BY_ID.has(l.id));
        const shop = SHOP_IDS.find((id) => id === p.shop) ?? null;
        return { ...current, lines, shop };
      },
    },
  ),
);

export function cartDetails(lines: CartLine[]) {
  const items = lines
    .map((l) => {
      const product = PRODUCTS_BY_ID.get(l.id);
      return product ? { product, qty: l.qty, total: product.price * l.qty } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const total = items.reduce((sum, i) => sum + i.total, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const leadHours = items.map((i) => i.product.leadHours ?? 0);
  return { items, total, count, leadHours };
}
