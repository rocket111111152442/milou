// Un « site généré » (tenant) : tout ce qui décrit une boutique ou une maison.
// Module partagé client / serveur : aucune dépendance serveur ici.
import { CATEGORIES, LIBRARY, type CategoryId, type Product } from "./catalog";
import { DAY_NAMES, formatTime, toMinutes, type Range } from "./hours";
import { phoneHref, type Shop } from "./shops";

export type Kind = "boulangerie" | "boulangerie-patisserie" | "patisserie";

export const KINDS: { id: Kind; label: string; tagline: string; noun: string }[] = [
  { id: "boulangerie", label: "Boulangerie", tagline: "Artisan Boulanger", noun: "boulangerie artisanale" },
  { id: "boulangerie-patisserie", label: "Boulangerie-pâtisserie", tagline: "Boulangerie · Pâtisserie", noun: "boulangerie-pâtisserie artisanale" },
  { id: "patisserie", label: "Pâtisserie", tagline: "Artisan Pâtissier", noun: "pâtisserie artisanale" },
];

export type PaletteId = "ble" | "olive" | "marine" | "rose" | "chocolat" | "bordeaux";

type Vars = { farine: string; creme: string; mie: string; sable: string; croute: string; caramel: string; dore: string; cafe: string; torref: string; olive: string; grege: string };

export const PALETTES: Record<PaletteId, { label: string; vars: Vars }> = {
  ble: { label: "Blé doré", vars: { farine: "#f6efe2", creme: "#fffaf2", mie: "#eadbc2", sable: "#d9c4a3", croute: "#b5652b", caramel: "#d69a4a", dore: "#e8b860", cafe: "#3b2416", torref: "#24160d", olive: "#6b7a4b", grege: "#8a7a68" } },
  chocolat: { label: "Chocolat", vars: { farine: "#f3ece6", creme: "#fffaf6", mie: "#e4d6ca", sable: "#cdb8a6", croute: "#8a4b2a", caramel: "#b87a4a", dore: "#e2b06e", cafe: "#2e1a12", torref: "#1a0f0a", olive: "#6b7a4b", grege: "#84766a" } },
  olive: { label: "Olive & crème", vars: { farine: "#f2f1e6", creme: "#fbfaf0", mie: "#e1e2cd", sable: "#c9cbab", croute: "#5d7040", caramel: "#8e9a4f", dore: "#dcc66e", cafe: "#2f3b24", torref: "#1b2414", olive: "#7a5a2b", grege: "#7d8068" } },
  marine: { label: "Bleu marine", vars: { farine: "#eef2f6", creme: "#fafcff", mie: "#dbe3ec", sable: "#bccadb", croute: "#2c5f7c", caramel: "#4a8bb0", dore: "#e7c36b", cafe: "#1c2b3a", torref: "#0f1b27", olive: "#4f7a6a", grege: "#6b7a8a" } },
  rose: { label: "Rose poudré", vars: { farine: "#fbeff0", creme: "#fffafa", mie: "#f3dcde", sable: "#e6c3c7", croute: "#c2506a", caramel: "#de7e93", dore: "#f2c4a0", cafe: "#4a2530", torref: "#2b1219", olive: "#7a8f6a", grege: "#94767c" } },
  bordeaux: { label: "Bordeaux", vars: { farine: "#f6eeea", creme: "#fffaf7", mie: "#ead9d3", sable: "#d6bbb2", croute: "#8e2a3a", caramel: "#c4666f", dore: "#e6b86a", cafe: "#3a1c20", torref: "#22100f", olive: "#6b7a4b", grege: "#8a7470" } },
};

export function paletteCss(id: PaletteId) {
  const v = (PALETTES[id] ?? PALETTES.ble).vars;
  return `:root{${Object.entries(v)
    .map(([k, c]) => `--color-${k}:${c}`)
    .join(";")}}`;
}

export type TenantConfig = {
  slug: string;
  createdAt: string;
  updatedAt: string;
  kind: Kind;
  name: string;
  tagline: string;
  /** Année d'ouverture */
  since?: number;
  /** Texte « La maison » (sinon généré) */
  story?: string;
  /** Phrase d'accroche sous le titre (sinon générée) */
  heroIntro?: string;
  /** Identifiant Instagram sans @ */
  instagram?: string;
  palette: PaletteId;
  heroImage?: string;
  shops: Shop[];
  /** Catalogue de départ choisi à la création (les réglages /admin se superposent) */
  products: Product[];
  /** Adresse(s) qui reçoivent les commandes (séparées par des virgules) */
  orderEmail?: string;
  /** Directeur de la publication, pour les mentions légales */
  director?: string;
  /** « salt:hash » du mot de passe de l'espace boutiques du site (scrypt) */
  passwordHash: string;
};

export type PublicTenant = Omit<TenantConfig, "passwordHash">;

export function publicTenant(t: TenantConfig): PublicTenant {
  const { passwordHash: _omit, ...rest } = t;
  void _omit;
  return rest;
}

export const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
export const RESERVED_SLUGS = new Set(["studio", "api", "s", "admin", "carte", "commande", "_next"]);

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

const IMAGE = /^\/(p\/[a-z0-9-]+\.(jpg|png|webp)|s\/[a-z0-9-]+\/api\/photo\/[a-z0-9-]+\.(jpg|png|webp)|images\/[\w/.-]+)$/;
export const isImagePath = (v: unknown): v is string => typeof v === "string" && IMAGE.test(v);

// --- Rayons types (formulaire de création) -------------------------------------------------------

const KIND_CATS: Record<Kind, CategoryId[]> = {
  boulangerie: ["pains", "viennoiseries", "snacking", "boissons", "formules"],
  "boulangerie-patisserie": ["pains", "viennoiseries", "patisseries", "gateaux", "snacking", "boissons", "formules"],
  patisserie: ["viennoiseries", "patisseries", "gateaux", "boissons"],
};

/** Produits de la bibliothèque cochés par défaut selon le type de commerce. */
export function defaultSelection(kind: Kind): string[] {
  const cats = new Set(KIND_CATS[kind]);
  return LIBRARY.filter((p) => cats.has(p.category)).map((p) => p.id);
}

// --- Textes générés ----------------------------------------------------------------------------

const STOP = new Set(["le", "la", "les", "l", "de", "du", "des", "d", "et", "au", "aux", "chez", "maison", "boulangerie", "patisserie", "boulanger", "patissier", "artisan"]);

/** Initiales du monogramme (2 lettres max). */
export function initials(name: string) {
  const words = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const main = words.filter((w) => !STOP.has(w.toLowerCase()));
  const pick = (main.length >= 2 ? main : words).slice(0, 2);
  const letters = pick.map((w) => w[0]).join("");
  return (letters || name.slice(0, 2) || "•").toUpperCase().slice(0, 2);
}

/** Coupe le nom en deux lignes équilibrées pour le grand titre (sans finir une ligne sur « le », « de »…). */
export function titleLines(name: string): [string, string] {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return [name.trim(), ""];
  let best = 1;
  let bestScore = Infinity;
  for (let k = 1; k < words.length; k++) {
    const l1 = words.slice(0, k).join(" ");
    const l2 = words.slice(k).join(" ");
    const last = words[k - 1].toLowerCase().replace(/['’]$/, "");
    const score = Math.max(l1.length, l2.length) + (STOP.has(last) && last !== "boulangerie" && last !== "patisserie" && last !== "maison" ? 1000 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = k;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

function listFr(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

function openDays(shops: Shop[]) {
  return Math.max(0, ...shops.map((s) => Object.values(s.hours).filter((r) => r.length > 0).length));
}

function earliestOpening(shops: Shop[]) {
  const all = shops.flatMap((s) => Object.values(s.hours).flatMap((r) => r.map(([o]) => o)));
  if (!all.length) return null;
  return all.reduce((a, b) => (toMinutes(a) <= toMinutes(b) ? a : b));
}

export function categoriesFor(products: Product[]) {
  return CATEGORIES.filter((c) => products.some((p) => p.category === c.id));
}

export type Copy = {
  titleLines: [string, string];
  monogram: string;
  heroIntro: string;
  story: string;
  stats: { value: number; suffix: string; label: string; from?: number }[];
  marquee1: string[];
  marquee2: string[];
  footerLine: string;
  badge: string;
  citiesText: string;
  infoTitle: string;
  bandText: string;
  siteDescription: string;
  cityLine: string;
  days: number;
};

/** Tous les textes du site, déduits des informations saisies (modifiables : les champs saisis priment). */
export function copyOf(t: PublicTenant, products: Product[] = t.products): Copy {
  const kind = KINDS.find((k) => k.id === t.kind) ?? KINDS[0];
  const cities = [...new Set(t.shops.map((s) => s.city).filter(Boolean))];
  const citiesText = listFr(cities) || "chez vous";
  const days = openDays(t.shops);
  const first = earliestOpening(t.shops);
  const cats = categoriesFor(products).map((c) => c.label);
  const sunday = t.shops.some((s) => (s.hours[0] ?? []).length > 0);

  const heroIntro =
    t.heroIntro ||
    `Ici, tout est fait sur place, chaque jour : ${
      t.kind === "patisserie" ? "entremets, tartelettes, macarons et douceurs du moment" : "baguettes de tradition, pains spéciaux, viennoiseries et pâtisseries"
    } — à ${citiesText}.`;

  const story =
    t.story ||
    `${t.name}, ${kind.noun} à ${citiesText}${t.since ? `, ouverte depuis ${t.since}` : ""}. Nos artisans ${
      t.kind === "patisserie" ? "préparent chaque jour" : "pétrissent, façonnent et cuisent le pain sur place, chaque jour, en respectant les temps de fermentation, et préparent"
    } des viennoiseries et des douceurs avec des produits choisis. Passez la porte : ça sent bon.`;

  const stats: Copy["stats"] = [
    { value: t.shops.length, suffix: "", label: t.shops.length > 1 ? "Boutiques, une même maison" : "Boutique, faite avec cœur" },
    { value: days, suffix: "j/7", label: days === 7 ? "Ouvert toute la semaine" : "Jours d'ouverture" },
  ];
  if (first) {
    const [h, m] = first.split(":").map(Number);
    stats.push({ value: h, suffix: `h${m ? String(m).padStart(2, "0") : ""}`, label: "Premières fournées" });
  }
  stats.push(t.since ? { value: t.since, from: Math.max(1900, t.since - 24), suffix: "", label: "Année d'ouverture" } : { value: products.length, suffix: "", label: "Produits à la carte" });

  return {
    titleLines: titleLines(t.name),
    monogram: initials(t.name),
    heroIntro,
    story,
    stats,
    marquee1: (cats.length ? cats : ["Pains", "Viennoiseries"]).slice(0, 6),
    marquee2: [
      t.kind === "patisserie" ? "Préparé sur place" : "Pétri sur place",
      "Fait à la main",
      "Produits chaque jour",
      days === 7 ? "Ouvert 7j/7" : sunday ? "Ouvert le dimanche" : `Ouvert ${days}j/7`,
      ...cities.slice(0, 2),
    ],
    footerLine: `Du frais tous les jours, à ${citiesText}.`,
    badge: `${t.kind === "patisserie" ? "Préparé" : "Pétri"} · Fait main · ${cities.join(" · ") || t.name} · `,
    citiesText,
    infoTitle: t.shops.length > 1 ? `${t.shops.length} adresses, une même maison.` : "Venez nous voir.",
    bandText: cities.length > 1 ? `Entre ${cities.slice(0, 2).join(" et ")}` : `À ${cities[0] ?? "deux pas de chez vous"}`,
    siteDescription: `${kind.noun[0].toUpperCase()}${kind.noun.slice(1)} à ${citiesText} : ${cats.join(", ").toLowerCase() || "pains et viennoiseries"}. Commande en ligne et retrait en boutique.`,
    cityLine: citiesText,
    days,
  };
}

export function siteOf(t: PublicTenant) {
  return {
    name: t.name,
    shortName: t.name,
    tagline: t.tagline,
    instagram: t.instagram ? { handle: `@${t.instagram}`, url: `https://www.instagram.com/${t.instagram}/` } : null,
  };
}

// --- Horaires : saisie ↔ stockage -----------------------------------------------------------------

export type HoursInput = { open: boolean; from: string; to: string; from2?: string; to2?: string }[]; // index 0 = lundi … 6 = dimanche

export function hoursFromInput(h: HoursInput): Record<number, readonly Range[]> {
  const out: Record<number, readonly Range[]> = {};
  h.slice(0, 7).forEach((d, i) => {
    const day = (i + 1) % 7; // lundi → 1 … dimanche → 0
    const ranges: Range[] = [];
    const ok = (a?: string, b?: string) => a && b && /^\d{2}:\d{2}$/.test(a) && /^\d{2}:\d{2}$/.test(b) && toMinutes(a) < toMinutes(b);
    if (d.open && ok(d.from, d.to)) ranges.push([d.from, d.to]);
    if (d.open && ok(d.from2, d.to2) && ranges.length && toMinutes(d.from2!) >= toMinutes(ranges[0][1])) ranges.push([d.from2!, d.to2!]);
    out[day] = ranges;
  });
  return out;
}

export function hoursToInput(hours: Record<number, readonly Range[]>): HoursInput {
  return [1, 2, 3, 4, 5, 6, 0].map((day) => {
    const r = hours[day] ?? [];
    return { open: r.length > 0, from: r[0]?.[0] ?? "08:00", to: r[0]?.[1] ?? "19:00", from2: r[1]?.[0], to2: r[1]?.[1] };
  });
}

export const WEEK_LABELS = [1, 2, 3, 4, 5, 6, 0].map((d) => DAY_NAMES[d]);

export function describeHours(hours: Record<number, readonly Range[]>) {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => `${DAY_NAMES[d]} : ${(hours[d] ?? []).map(([o, c]) => `${formatTime(o)}–${formatTime(c)}`).join(" / ") || "fermé"}`);
}

export const SERVICES = ["Vente à emporter", "Parking", "Terrasse", "Accès fauteuil roulant", "Titres-restaurant", "Ouvert le dimanche", "Pause café", "Wi-Fi", "Paiement sans contact", "Sur commande"];

export function newShopId(city: string, taken: string[]) {
  const base = slugify(city) || "boutique";
  let id = base;
  let n = 2;
  while (taken.includes(id)) id = `${base}-${n++}`;
  return id;
}

export { phoneHref };
