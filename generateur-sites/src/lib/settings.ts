// Réglages d'un site, modifiables par la boutique depuis son /admin (prix, produits, disponibilités, fermetures, mise en service).
// Ce module est partagé client / serveur : aucune dépendance serveur ici.
import { CATEGORIES, type CategoryId, type Product, type ProductGroup } from "./catalog";
import type { Shop, ShopId } from "./shops";
import { clean, isImagePath } from "./tenant";

/** Champs modifiables d'un produit. */
export type ProductFields = {
  name: string;
  category: CategoryId;
  unit?: string;
  description: string;
  image?: string;
  /** Délai de commande minimum en heures (0 = délai standard) */
  leadHours?: number;
  /** Choix à faire par le client (formules…) */
  groups?: ProductGroup[];
};

/** Produit ajouté par la boutique depuis /admin/carte. */
export type CustomProduct = ProductFields & { id: string; price: number };

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
  /** Produits d'origine modifiés par la boutique (nom, photo, description, choix…) */
  edits: Record<string, ProductFields>;
  /** Fermetures exceptionnelles (AAAA-MM-JJ) par boutique */
  closedDates: Partial<Record<ShopId, string[]>>;
  updatedAt?: string;
};

export const DEFAULT_SETTINGS: Settings = { live: {}, prices: {}, unavailable: [], hidden: [], custom: [], edits: {}, closedDates: {} };

export const CUSTOM_ID = /^perso-[a-z0-9]{6,12}$/;

function normalizeGroups(raw: unknown): ProductGroup[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const groups = raw
    .slice(0, 6)
    .map((g): ProductGroup => {
      const r = (g ?? {}) as Record<string, unknown>;
      const options = (Array.isArray(r.options) ? r.options : []).map((o) => clean(o, 60)).filter(Boolean);
      return { label: clean(r.label, 40), options: [...new Set(options)].slice(0, 20) };
    })
    .filter((g) => g.label && g.options.length > 0);
  return groups.length ? groups : undefined;
}

function normalizeFields(r: Record<string, unknown>): ProductFields | null {
  const name = clean(r.name, 60);
  const category = CATEGORIES.find((c) => c.id === r.category)?.id;
  if (!name || !category) return null;
  const lead = Number(r.leadHours);
  return {
    name,
    category,
    unit: clean(r.unit, 30) || undefined,
    description: clean(r.description, 300),
    image: isImagePath(r.image) ? r.image : undefined,
    leadHours: Number.isInteger(lead) && lead > 0 && lead <= 168 ? lead : undefined,
    groups: normalizeGroups(r.groups),
  };
}

function normalizeCustom(raw: unknown): CustomProduct | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const price = Number(r.price);
  const fields = normalizeFields(r);
  if (!CUSTOM_ID.test(id) || !fields || !Number.isInteger(price) || price <= 0 || price >= 100_000) return null;
  return { id, price, ...fields };
}

/** `base` : catalogue de départ du site (les identifiants valides pour les prix, retraits et modifications). */
export function normalizeSettings(raw: unknown, base: Product[]): Settings {
  const r = (raw ?? {}) as Partial<Settings>;
  const seen = new Set<string>();
  const custom = (Array.isArray(r.custom) ? r.custom : [])
    .map(normalizeCustom)
    .filter((p): p is CustomProduct => p !== null && !seen.has(p.id) && (seen.add(p.id), true))
    .slice(0, 200);
  const builtin = new Set(base.map((p) => p.id));
  const ids = new Set([...builtin, ...custom.map((p) => p.id)]);
  const edits: Settings["edits"] = {};
  for (const [id, v] of Object.entries(r.edits ?? {})) {
    const f = builtin.has(id) ? normalizeFields((v ?? {}) as Record<string, unknown>) : null;
    if (f) edits[id] = f;
  }
  const prices: Record<string, number> = {};
  for (const [id, v] of Object.entries(r.prices ?? {})) {
    if (ids.has(id) && Number.isInteger(v) && v > 0 && v < 100_000) prices[id] = v;
  }
  const closedDates: Settings["closedDates"] = {};
  for (const [id, dates] of Object.entries(r.closedDates ?? {})) {
    if (/^[a-z0-9-]{1,40}$/.test(id) && Array.isArray(dates)) {
      closedDates[id as ShopId] = [...new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
    }
  }
  const live: Settings["live"] = {};
  for (const [id, v] of Object.entries(r.live ?? {})) if (/^[a-z0-9-]{1,40}$/.test(id)) live[id as ShopId] = v === true;
  return {
    live,
    prices,
    unavailable: (r.unavailable ?? []).filter((id) => ids.has(id)),
    hidden: (Array.isArray(r.hidden) ? r.hidden : []).filter((id) => builtin.has(id)),
    custom,
    edits,
    closedDates,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : undefined,
  };
}

/** Catalogue du moment : produits d'origine (sauf retirés) + produits ajoutés, avec prix et disponibilités. */
export function applyProducts(settings: Settings, base: Product[]): Product[] {
  const off = new Set(settings.unavailable);
  const hidden = new Set(settings.hidden);
  const leadBadge = (h?: number) => (h ? [`Sur commande ${h} h`] : []);
  const added: Product[] = settings.custom.map((c) => ({ ...c, badges: leadBadge(c.leadHours).length ? leadBadge(c.leadHours) : undefined }));
  const original = base.filter((p) => !hidden.has(p.id)).map((p): Product => {
    const e = settings.edits[p.id];
    if (!e) return p;
    const badges = [...(p.badges ?? []).filter((b) => !b.startsWith("Sur commande")), ...leadBadge(e.leadHours)];
    return { ...p, ...e, badges: badges.length ? badges : undefined };
  });
  return [...original, ...added].map((p) => ({
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

export function applyShops(shops: readonly Shop[], settings: Settings): Shop[] {
  return shops.map((s) => applyShop(s, settings));
}
