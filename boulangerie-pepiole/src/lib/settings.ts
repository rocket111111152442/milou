// Réglages modifiables depuis /admin (prix, disponibilités, fermetures, mise en service).
// Ce module est partagé client / serveur : aucune dépendance serveur ici.
import { PRODUCTS, type Product } from "./catalog";
import { SHOPS, type Shop, type ShopId } from "./shops";

export type Settings = {
  /** Commandes réellement traitées pour cette boutique (sinon : mode démonstration) */
  live: Partial<Record<ShopId, boolean>>;
  /** Prix modifiés, en centimes */
  prices: Record<string, number>;
  /** Produits momentanément indisponibles */
  unavailable: string[];
  /** Fermetures exceptionnelles (AAAA-MM-JJ) par boutique */
  closedDates: Partial<Record<ShopId, string[]>>;
  updatedAt?: string;
};

export const DEFAULT_SETTINGS: Settings = { live: {}, prices: {}, unavailable: [], closedDates: {} };

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Settings>;
  const ids = new Set(PRODUCTS.map((p) => p.id));
  const shopIds = new Set(SHOPS.map((s) => s.id as string));
  const prices: Record<string, number> = {};
  for (const [id, v] of Object.entries(r.prices ?? {})) {
    if (ids.has(id) && Number.isInteger(v) && v > 0 && v < 100_000) prices[id] = v;
  }
  const closedDates: Settings["closedDates"] = {};
  for (const [id, dates] of Object.entries(r.closedDates ?? {})) {
    if (shopIds.has(id) && Array.isArray(dates)) {
      closedDates[id as ShopId] = [...new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
    }
  }
  const live: Settings["live"] = {};
  for (const [id, v] of Object.entries(r.live ?? {})) if (shopIds.has(id)) live[id as ShopId] = v === true;
  return {
    live,
    prices,
    unavailable: (r.unavailable ?? []).filter((id) => ids.has(id)),
    closedDates,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : undefined,
  };
}

/** Catalogue avec les prix et disponibilités du moment. */
export function applyProducts(settings: Settings): Product[] {
  const off = new Set(settings.unavailable);
  return PRODUCTS.map((p) => ({
    ...p,
    price: settings.prices[p.id] ?? p.price,
    available: p.available !== false && !off.has(p.id),
  }));
}

/** Boutique avec ses fermetures exceptionnelles. */
export function applyShop(shop: Shop, settings: Settings): Shop {
  const extra = settings.closedDates[shop.id] ?? [];
  return extra.length ? { ...shop, closedDates: [...new Set([...shop.closedDates, ...extra])] } : shop;
}

export function applyShops(settings: Settings): Shop[] {
  return SHOPS.map((s) => applyShop(s, settings));
}
