// Réglages modifiables depuis /admin (prix, disponibilités, fermetures, mise en service).
// Ce module est partagé client / serveur : aucune dépendance serveur ici.
import { CATEGORIES, PRODUCTS, type CategoryId, type Product } from "./catalog";
import { SHOPS, type Shop, type ShopId } from "./shops";

/** Produit ajouté par la boutique depuis /admin/carte. */
export type CustomProduct = {
  id: string;
  name: string;
  category: CategoryId;
  price: number;
  unit?: string;
  description: string;
  image?: string;
  /** Délai de commande minimum en heures (0 = délai standard) */
  leadHours?: number;
};

export type Settings = {
  /** Commandes réellement traitées pour cette boutique (sinon : mode démonstration) */
  live: Partial<Record<ShopId, boolean>>;
  /** Prix modifiés, en centimes */
  prices: Record<string, number>;
  /** Produits momentanément indisponibles */
  unavailable: string[];
  /** Produits d'origine retirés de la carte */
  hidden: string[];
  /** Produits ajoutés par la boutique */
  custom: CustomProduct[];
  /** Fermetures exceptionnelles (AAAA-MM-JJ) par boutique */
  closedDates: Partial<Record<ShopId, string[]>>;
  updatedAt?: string;
};

export const DEFAULT_SETTINGS: Settings = { live: {}, prices: {}, unavailable: [], hidden: [], custom: [], closedDates: {} };

export const CUSTOM_ID = /^perso-[a-z0-9]{6,12}$/;
const IMAGE_PATH = /^\/(api\/photo\/[a-z0-9-]+\.(jpg|png|webp)|images\/[\w/.-]+)$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

function normalizeCustom(raw: unknown): CustomProduct | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const name = clean(r.name, 60);
  const price = Number(r.price);
  const category = CATEGORIES.find((c) => c.id === r.category)?.id;
  if (!CUSTOM_ID.test(id) || !name || !category || !Number.isInteger(price) || price <= 0 || price >= 100_000) return null;
  const lead = Number(r.leadHours);
  const image = typeof r.image === "string" && IMAGE_PATH.test(r.image) ? r.image : undefined;
  return {
    id,
    name,
    category,
    price,
    unit: clean(r.unit, 30) || undefined,
    description: clean(r.description, 300),
    image,
    leadHours: Number.isInteger(lead) && lead > 0 && lead <= 168 ? lead : undefined,
  };
}

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Settings>;
  const seen = new Set<string>();
  const custom = (Array.isArray(r.custom) ? r.custom : [])
    .map(normalizeCustom)
    .filter((p): p is CustomProduct => p !== null && !seen.has(p.id) && (seen.add(p.id), true))
    .slice(0, 200);
  const builtin = new Set(PRODUCTS.map((p) => p.id));
  const ids = new Set([...builtin, ...custom.map((p) => p.id)]);
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
    hidden: (Array.isArray(r.hidden) ? r.hidden : []).filter((id) => builtin.has(id)),
    custom,
    closedDates,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : undefined,
  };
}

/** Catalogue du moment : produits d'origine (sauf retirés) + produits ajoutés, avec prix et disponibilités. */
export function applyProducts(settings: Settings): Product[] {
  const off = new Set(settings.unavailable);
  const hidden = new Set(settings.hidden);
  const added: Product[] = settings.custom.map((c) => ({
    ...c,
    badges: c.leadHours ? [`Sur commande ${c.leadHours} h`] : undefined,
  }));
  return [...PRODUCTS.filter((p) => !hidden.has(p.id)), ...added].map((p) => ({
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
