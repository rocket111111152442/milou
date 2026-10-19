"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { applyProducts, applyShops, type Settings } from "@/lib/settings";
import type { Category, Product } from "@/lib/catalog";
import type { Shop, ShopId } from "@/lib/shops";
import { categoriesFor, copyOf, siteOf, type Copy, type PublicTenant } from "@/lib/tenant";

type Ctx = {
  slug: string;
  /** Préfixe de toutes les adresses du site : /s/<slug> */
  base: string;
  tenant: PublicTenant;
  site: ReturnType<typeof siteOf>;
  copy: Copy;
  settings: Settings;
  products: Product[];
  byId: Map<string, Product>;
  categories: Category[];
  shops: Shop[];
  shopById: (id: ShopId) => Shop;
};

const SettingsContext = createContext<Ctx | null>(null);

function build(tenant: PublicTenant, settings: Settings): Ctx {
  const products = applyProducts(settings, tenant.products);
  const shops = applyShops(tenant.shops, settings);
  return {
    slug: tenant.slug,
    base: `/s/${tenant.slug}`,
    tenant,
    site: siteOf(tenant),
    copy: copyOf(tenant, products),
    settings,
    products,
    byId: new Map(products.map((p) => [p.id, p])),
    categories: categoriesFor(products),
    shops,
    shopById: (id) => shops.find((s) => s.id === id) ?? shops[0],
  };
}

export function SettingsProvider({ tenant, settings, children }: { tenant: PublicTenant; settings: Settings; children: ReactNode }) {
  const value = useMemo(() => build(tenant, settings), [tenant, settings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useOptionalSiteData() {
  return useContext(SettingsContext);
}

/** Site, catalogue, boutiques et textes du site affiché (réglages de l'/admin compris). */
export function useSiteData() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSiteData doit être utilisé dans un site généré");
  return ctx;
}
