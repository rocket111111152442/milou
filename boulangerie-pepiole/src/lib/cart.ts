"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PRODUCTS_BY_ID, type Product } from "./catalog";
import { SHOP_IDS, type ShopId } from "./shops";

/** `picks` : option retenue pour chaque choix du produit (formules…), dans l'ordre des choix. */
export type CartLine = { id: string; qty: number; picks?: string[] };

/** Une même formule avec des options différentes forme deux lignes distinctes. */
export const lineKey = (l: { id: string; picks?: string[] }) => (l.picks?.length ? `${l.id}|${l.picks.join("|")}` : l.id);

type CartState = {
  lines: CartLine[];
  /** Boutique de retrait choisie (null tant que le client n'a pas choisi) */
  shop: ShopId | null;
  open: boolean;
  bump: number;
  add: (id: string, qty?: number, picks?: string[]) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
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
      add: (id, qty = 1, picks) =>
        set((s) => {
          const key = lineKey({ id, picks });
          const existing = s.lines.find((l) => lineKey(l) === key);
          const lines = existing
            ? s.lines.map((l) => (lineKey(l) === key ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l))
            : [...s.lines, { id, qty: Math.min(MAX_QTY, qty), ...(picks?.length ? { picks } : {}) }];
          return { lines, bump: s.bump + 1 };
        }),
      setQty: (key, qty) =>
        set((s) => ({
          lines:
            qty <= 0
              ? s.lines.filter((l) => lineKey(l) !== key)
              : s.lines.map((l) => (lineKey(l) === key ? { ...l, qty: Math.min(MAX_QTY, qty) } : l)),
        })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => lineKey(l) !== key) })),
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
        // Les produits disparus du catalogue sont ignorés à l'affichage (cartDetails)
        const lines = (p.lines ?? [])
          .filter((l) => typeof l?.id === "string" && Number.isInteger(l.qty) && l.qty > 0)
          .map((l) => ({ id: l.id, qty: l.qty, ...(Array.isArray(l.picks) ? { picks: l.picks.filter((x) => typeof x === "string") } : {}) }));
        const shop = SHOP_IDS.find((id) => id === p.shop) ?? null;
        return { ...current, lines, shop };
      },
    },
  ),
);

export function cartDetails(lines: CartLine[], byId: Map<string, Product> = PRODUCTS_BY_ID) {
  const items = lines
    .map((l) => {
      const product = byId.get(l.id);
      if (!product) return null;
      const groups = product.groups ?? [];
      const picks = l.picks ?? [];
      // Options à rechoisir si les choix du produit ont changé depuis l'ajout au panier
      const invalid = groups.length > 0 && (picks.length !== groups.length || groups.some((g, i) => !g.options.includes(picks[i])));
      const options = groups.length && !invalid ? groups.map((g, i) => `${g.label} : ${picks[i]}`).join(" · ") : "";
      return { key: lineKey(l), product, qty: l.qty, total: product.price * l.qty, picks, options, invalid };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const total = items.reduce((sum, i) => sum + i.total, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const leadHours = items.map((i) => i.product.leadHours ?? 0);
  return { items, total, count, leadHours };
}
