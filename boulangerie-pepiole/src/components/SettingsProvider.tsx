"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_SETTINGS, applyProducts, applyShops, type Settings } from "@/lib/settings";
import type { Product } from "@/lib/catalog";
import type { Shop, ShopId } from "@/lib/shops";

type Ctx = { settings: Settings; products: Product[]; byId: Map<string, Product>; shops: Shop[]; shopById: (id: ShopId) => Shop };

const SettingsContext = createContext<Ctx | null>(null);

function build(settings: Settings): Ctx {
  const products = applyProducts(settings);
  const shops = applyShops(settings);
  return {
    settings,
    products,
    byId: new Map(products.map((p) => [p.id, p])),
    shops,
    shopById: (id) => shops.find((s) => s.id === id) ?? shops[0],
  };
}

const FALLBACK = build(DEFAULT_SETTINGS);

export function SettingsProvider({ settings, children }: { settings: Settings; children: ReactNode }) {
  const value = useMemo(() => build(settings), [settings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** Catalogue et boutiques tenant compte des réglages /admin. */
export function useSiteData() {
  return useContext(SettingsContext) ?? FALLBACK;
}
