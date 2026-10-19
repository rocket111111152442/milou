// Saisie du formulaire du Studio → site généré (validation et valeurs par défaut).
// Module partagé : le formulaire s'en sert pour l'aperçu des textes, le serveur pour valider.
import { LIBRARY, type Product } from "./catalog";
import { clean, defaultSelection, hoursFromInput, hoursToInput, isImagePath, KINDS, newShopId, PALETTES, phoneHref, slugify, type HoursInput, type Kind, type PaletteId, type PublicTenant, type TenantConfig } from "./tenant";
import type { Shop } from "./shops";

export type ShopInput = {
  id?: string;
  name: string;
  city: string;
  street: string;
  postalCode: string;
  phone: string;
  landmark: string;
  tagline: string;
  hours: HoursInput;
  services: string[];
  image?: string;
  orderEmail: string;
  company: string;
  form: string;
  siren: string;
  siret: string;
  vat: string;
  rcs: string;
  created: string;
};

export type TenantInput = {
  kind: Kind;
  name: string;
  tagline: string;
  since: string;
  story: string;
  heroIntro: string;
  instagram: string;
  palette: PaletteId;
  heroImage?: string;
  shops: ShopInput[];
  /** Produits retenus dans la bibliothèque, avec leur prix en centimes */
  products: { id: string; price: number }[];
  orderEmail: string;
  director: string;
  slug: string;
  /** Vide : mot de passe généré (création) ou conservé (modification) */
  password: string;
};

const DEFAULT_HOURS: HoursInput = [
  ...Array.from({ length: 6 }, () => ({ open: true, from: "07:00", to: "19:00" })),
  { open: true, from: "07:00", to: "13:00" },
];

export function emptyShop(): ShopInput {
  return {
    name: "",
    city: "",
    street: "",
    postalCode: "",
    phone: "",
    landmark: "",
    tagline: "",
    hours: DEFAULT_HOURS.map((h) => ({ ...h })),
    services: ["Vente à emporter"],
    orderEmail: "",
    company: "",
    form: "",
    siren: "",
    siret: "",
    vat: "",
    rcs: "",
    created: "",
  };
}

export function emptyInput(): TenantInput {
  const kind: Kind = "boulangerie-patisserie";
  return {
    kind,
    name: "",
    tagline: "",
    since: "",
    story: "",
    heroIntro: "",
    instagram: "",
    palette: "ble",
    shops: [emptyShop()],
    products: LIBRARY.filter((p) => defaultSelection(kind).includes(p.id)).map((p) => ({ id: p.id, price: p.price })),
    orderEmail: "",
    director: "",
    slug: "",
    password: "",
  };
}

/** Saisie à partir d'un site existant (modification). */
export function inputFromTenant(t: PublicTenant): TenantInput {
  const price = new Map(t.products.map((p) => [p.id, p.price]));
  return {
    kind: t.kind,
    name: t.name,
    tagline: t.tagline,
    since: t.since ? String(t.since) : "",
    story: t.story ?? "",
    heroIntro: t.heroIntro ?? "",
    instagram: t.instagram ?? "",
    palette: t.palette,
    heroImage: t.heroImage,
    shops: t.shops.map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      street: s.address.street,
      postalCode: s.address.postalCode,
      phone: s.phone.display,
      landmark: s.landmark,
      tagline: s.tagline === (KINDS.find((k) => k.id === t.kind)?.tagline ?? "") ? "" : s.tagline,
      hours: hoursToInput(s.hours),
      services: s.services,
      image: s.image.startsWith("/images/") ? undefined : s.image,
      orderEmail: s.orderEmail ?? "",
      company: s.legal.company,
      form: s.legal.form,
      siren: s.legal.siren,
      siret: s.legal.siret,
      vat: s.legal.vat,
      rcs: s.legal.rcs,
      created: s.legal.created,
    })),
    products: LIBRARY.filter((p) => price.has(p.id)).map((p) => ({ id: p.id, price: price.get(p.id)! })),
    orderEmail: t.orderEmail ?? "",
    director: t.director ?? "",
    slug: t.slug,
    password: "",
  };
}

const EMAILS = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+(\s*,\s*[^\s@,]+@[^\s@,]+\.[^\s@,]+)*$/;

function emails(v: string) {
  const s = v.trim();
  return s ? (EMAILS.test(s) ? s.replace(/\s+/g, "") : null) : "";
}

function igHandle(v: string) {
  const h = v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "").replace(/\?.*$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : "";
}

/** Construit les boutiques d'un site à partir de la saisie ; message d'erreur si une information manque. */
export function buildShops(input: TenantInput, kind: Kind): { shops: Shop[] } | { error: string } {
  const kindTagline = KINDS.find((k) => k.id === kind)!.tagline;
  if (input.shops.length < 1 || input.shops.length > 4) return { error: "Un site compte de 1 à 4 boutiques." };
  const shops: Shop[] = [];
  const taken: string[] = [];
  for (const [i, s] of input.shops.entries()) {
    const label = input.shops.length > 1 ? `Boutique ${i + 1} : ` : "";
    const city = clean(s.city, 60);
    const street = clean(s.street, 100);
    const postalCode = clean(s.postalCode, 10);
    const phone = clean(s.phone, 25);
    if (!city || !street || !postalCode) return { error: `${label}adresse incomplète (rue, code postal et ville).` };
    if (phone.replace(/\D/g, "").length < 8) return { error: `${label}numéro de téléphone manquant ou invalide.` };
    const hours = hoursFromInput(s.hours);
    if (!Object.values(hours).some((r) => r.length > 0)) return { error: `${label}indiquez au moins un jour d'ouverture avec ses horaires.` };
    const oe = emails(s.orderEmail ?? "");
    if (oe === null) return { error: `${label}adresse e-mail de commandes invalide.` };
    const id = s.id && /^[a-z0-9-]{1,40}$/.test(s.id) && !taken.includes(s.id) ? s.id : newShopId(city, taken);
    taken.push(id);
    const name = clean(s.name, 60) || clean(input.name, 60);
    const sameCity = input.shops.filter((o) => clean(o.city, 60).toLowerCase() === city.toLowerCase()).length > 1;
    shops.push({
      id,
      name,
      city,
      short: sameCity ? street.replace(/^\d+\s*(bis|ter)?,?\s*/i, "").slice(0, 24) : city.length > 22 ? city.slice(0, 22) : city,
      tagline: clean(s.tagline, 70) || kindTagline,
      address: { street, postalCode, city },
      landmark: clean(s.landmark, 110),
      phone: { display: phone, href: phoneHref(phone) },
      hours,
      closedDates: [],
      image: isImagePath(s.image) ? s.image : `/images/boutique-${(i % 3) + 1}.jpg`,
      imageAlt: `Boutique ${name} à ${city}`,
      services: [...new Set(s.services.map((x) => clean(x, 40)).filter(Boolean))].slice(0, 12),
      orderEmail: oe || undefined,
      legal: {
        company: clean(s.company, 80),
        form: clean(s.form, 80),
        siren: clean(s.siren, 20),
        siret: clean(s.siret, 24),
        vat: clean(s.vat, 24),
        rcs: clean(s.rcs, 60),
        created: clean(s.created, 4),
      },
    });
  }
  return { shops };
}

export type BuildResult = { tenant: Omit<TenantConfig, "passwordHash" | "slug" | "createdAt" | "updatedAt"> } | { error: string };

export function buildTenant(input: TenantInput): BuildResult {
  const kind = KINDS.find((k) => k.id === input.kind)?.id;
  if (!kind) return { error: "Type de commerce invalide." };
  const name = clean(input.name, 60);
  if (name.length < 2) return { error: "Donnez le nom du commerce." };
  const built = buildShops(input, kind);
  if ("error" in built) return built;

  const byId = new Map(LIBRARY.map((p) => [p.id, p]));
  const products: Product[] = [];
  for (const sel of input.products) {
    const base = byId.get(sel.id);
    if (!base) continue;
    if (!Number.isInteger(sel.price) || sel.price <= 0 || sel.price >= 100_000) return { error: `Prix invalide pour « ${base.name} ».` };
    products.push({ ...base, price: sel.price });
  }
  if (products.length === 0) return { error: "Choisissez au moins un produit pour la carte." };

  const orderEmail = emails(input.orderEmail);
  if (orderEmail === null) return { error: "Adresse e-mail de réception des commandes invalide." };
  const since = Number(input.since);
  const palette = input.palette in PALETTES ? input.palette : "ble";

  return {
    tenant: {
      kind,
      name,
      tagline: clean(input.tagline, 40) || KINDS.find((k) => k.id === kind)!.tagline,
      since: Number.isInteger(since) && since >= 1800 && since <= new Date().getFullYear() ? since : undefined,
      story: clean(input.story, 600) || undefined,
      heroIntro: clean(input.heroIntro, 260) || undefined,
      instagram: igHandle(input.instagram) || undefined,
      palette,
      heroImage: isImagePath(input.heroImage) ? input.heroImage : undefined,
      shops: built.shops,
      products,
      orderEmail: orderEmail || undefined,
      director: clean(input.director, 80) || undefined,
    },
  };
}

export { slugify };
