"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartLine } from "@/lib/types";

interface CartState {
  lines: CartLine[];
  open: boolean;
  bump: number; // incrémenté à chaque ajout (animations)
  add: (line: Omit<CartLine, "key">) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
}

const keyOf = (l: Omit<CartLine, "key">) =>
  l.productId
    ? `${l.productId}|${l.variantId || ""}|${[...l.addonIds].sort().join(",")}`
    : `custom|${Date.now()}|${Math.random().toString(36).slice(2, 7)}`;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      open: false,
      bump: 0,
      add: (line) =>
        set((s) => {
          const key = keyOf(line);
          const existing = s.lines.find((l) => l.key === key);
          const lines = existing
            ? s.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, l.quantity + line.quantity) } : l))
            : [...s.lines, { ...line, key }];
          return { lines, bump: s.bump + 1 };
        }),
      setQty: (key, qty) =>
        set((s) => ({ lines: qty <= 0 ? s.lines.filter((l) => l.key !== key) : s.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, qty) } : l)) })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [] }),
      setOpen: (open) => set({ open }),
    }),
    {
      name: "ev-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines }),
    },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);

/** Lignes envoyées au serveur (le prix est toujours recalculé côté serveur). */
export const toServerLines = (lines: CartLine[]) =>
  lines.map((l) => ({
    productId: l.productId,
    variantId: l.variantId,
    quantity: l.quantity,
    addonIds: l.addonIds,
    custom: l.custom ? { stems: l.custom.stems, wrappingId: l.custom.wrappingId, note: l.custom.note } : undefined,
  }));
