import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env, catalogMode } from "@/config/env";
import { href, type Lang } from "@/i18n/config";
import { getInventory, getListing, CatalogUnavailable } from "@/lib/catalog/service";
import { filterListings, fold, impliedUsdDopRate, sortListings } from "@/lib/catalog/local-search";
import { formatArea, priceLabel, locationLabel, categoryLabel } from "@/lib/catalog/format";
import { DEFAULT_FILTERS } from "@/lib/catalog/filters";
import type { ListingDetail, ListingSummary, SearchFilters } from "@/lib/catalog/types";

/* ------------------------------------------------------------------ session state */

export const profileSchema = z
  .object({
    full_name: z.string().max(120).nullable(),
    whatsapp: z.string().max(40).nullable(),
    email: z.string().max(200).nullable(),
    country: z.string().max(80).nullable(),
    city: z.string().max(80).nullable(),
    intent: z.enum(["buy", "rent", "sell", "other"]).nullable(),
    property_types: z.array(z.string().max(60)).max(8).nullable(),
    zones: z.array(z.string().max(60)).max(8).nullable(),
    budget_min: z.number().positive().max(1e10).nullable(),
    budget_max: z.number().positive().max(1e10).nullable(),
    currency: z.enum(["USD", "DOP", "EUR"]).nullable(),
    payment_method: z.string().max(80).nullable(),
    usage: z.string().max(80).nullable(),
    timeline: z.string().max(80).nullable(),
    bedrooms: z.number().int().min(0).max(30).nullable(),
    must_haves: z.array(z.string().max(60)).max(10).nullable(),
    visit_preference: z.enum(["physical", "virtual"]).nullable(),
    availability: z.string().max(200).nullable(),
    preferred_language: z.string().max(30).nullable(),
    how_found: z.string().max(120).nullable(),
    title_deslindado: z.string().max(40).nullable(),
    has_mortgage: z.string().max(40).nullable(),
    expected_price: z.number().positive().max(1e10).nullable(),
    property_size: z.string().max(80).nullable(),
    guests: z.number().int().min(1).max(50).nullable(),
    dates: z.string().max(120).nullable(),
    multiple_units: z.boolean().nullable(),
    interested_property_slugs: z.array(z.string().max(200)).max(10).nullable(),
  })
  .partial();
export type Profile = z.infer<typeof profileSchema>;

export const HANDOFF_REASONS = [
  "visit",
  "reserve_offer_payment",
  "negotiation",
  "high_budget",
  "seller_listing",
  "existing_client",
  "human_request",
  "complaint",
  "legal_tax",
  "unknown_info",
  "partnership",
  "suspicious",
] as const;

export interface Handoff {
  reason: (typeof HANDOFF_REASONS)[number];
  summary: string;
  nextStep: string;
  includeVisitForm: boolean;
  propertySlug: string | null;
  status: "proposed" | "sent";
  contactId?: number;
}

export interface Card {
  slug: string;
  ref: string | null;
  title: string;
  image: string | null;
  price: string | null;
  pricePrefix: string | null;
  priceSuffix: string | null;
  location: string;
  type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area: string | null;
  url: string;
  reason: string;
}

export interface ToolContext {
  lang: Lang;
  pageSlug: string | null;
  profile: Profile;
  seenSlugs: Set<string>;
  handoff: Handoff | null;
  cards: Card[];
  executed: Map<string, number>;
  /** Slugs returned by the last search of this turn (for automatic cards). */
  lastSearch?: string[];
  /** Property types the visitor asked for in this turn's searches (cards of other types are refused). */
  requestedTypes?: string[];
}

/* ------------------------------------------------------------------ definitions */

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
const nStr = nullable({ type: "string" });
const nNum = nullable({ type: "number" });
const nInt = nullable({ type: "integer" });
const nStrArr = nullable({ type: "array", items: { type: "string" } });

const TYPE_KEYS = ["land", "villa", "apartment", "house", "farm", "commercial", "hotel", "townhouse", "building", "office", "penthouse"] as const;
const TYPE_PATTERNS: Record<(typeof TYPE_KEYS)[number], RegExp> = {
  land: /terreno|solar|lote|land|lot/,
  villa: /villa/,
  apartment: /apartament|apartment|apto/,
  house: /casa|house/,
  farm: /finca|farm/,
  commercial: /local|comercial|commercial|nave/,
  hotel: /hotel/,
  townhouse: /townhouse/,
  building: /edificio|building/,
  office: /oficina|office/,
  penthouse: /penthouse/,
};

function obj(properties: Record<string, unknown>) {
  return { type: "object" as const, properties, required: Object.keys(properties), additionalProperties: false };
}

export const TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_properties",
    description:
      "Search the agency's live property catalogue. Use it for every property recommendation. Returns matching listings (with slug), the total number of matches and, when nothing matches, how many listings broader criteria would return. Use null for criteria the visitor did not give.",
    strict: true,
    input_schema: obj({
      operation: { type: "string", enum: ["sale", "rent", "any"], description: "sale = to buy, rent = to rent" },
      property_types: nullable({ type: "array", items: { type: "string", enum: [...TYPE_KEYS] } }),
      location: { ...nStr, description: "City, area, sector or development name ONLY if the visitor named one, e.g. 'Cabrera', 'Río San Juan', 'Coco Bay'. Otherwise null." },
      budget_min: nNum,
      budget_max: nNum,
      currency: { type: "string", enum: ["USD", "DOP"], description: "Currency of the budget. USD if unspecified." },
      bedrooms_min: nInt,
      bathrooms_min: nInt,
      condition: { type: "string", enum: ["ready", "construction", "any"] },
      keywords: { ...nStr, description: "Features to require, matched in title, description and amenities, preferably in Spanish (listings are in Spanish), e.g. 'piscina', 'vista al mar', 'amueblado'" },
      sort: { type: "string", enum: ["recent", "price_asc", "price_desc"] },
      limit: { type: "integer", description: "1 to 6" },
    }),
  },
  {
    name: "get_property",
    description:
      "Get the full published details of one listing (description, features, amenities, units of a development, price, location as published). Accepts a slug or the listing reference number.",
    strict: true,
    input_schema: obj({ slug_or_ref: { type: "string" } }),
  },
  {
    name: "show_properties",
    description:
      "Display up to 4 listings to the visitor as clickable cards with their real photo, price and features. Only slugs returned by search_properties or get_property in this conversation are accepted. Give a one-line reason per listing explaining why it fits the visitor's criteria (or how it differs).",
    strict: true,
    input_schema: obj({
      items: { type: "array", items: obj({ slug: { type: "string" }, reason: { type: "string" } }) },
    }),
  },
  {
    name: "update_prospect_profile",
    description:
      "Save or correct details the visitor has explicitly shared (only what they said). Fields you don't want to change must be null. Returns the saved profile. Do not ask follow-up questions because of this call.",
    strict: true,
    input_schema: obj({
      full_name: nStr,
      whatsapp: { ...nStr, description: "With country code if given" },
      email: nStr,
      country: nStr,
      city: nStr,
      intent: nullable({ type: "string", enum: ["buy", "rent", "sell", "other"] }),
      property_types: nStrArr,
      zones: nStrArr,
      budget_min: nNum,
      budget_max: nNum,
      currency: nullable({ type: "string", enum: ["USD", "DOP", "EUR"] }),
      payment_method: { ...nStr, description: "cash, bank loan, instalments, developer financing…" },
      usage: { ...nStr, description: "home, vacation, investment, rental income" },
      timeline: nStr,
      bedrooms: nInt,
      must_haves: nStrArr,
      visit_preference: nullable({ type: "string", enum: ["physical", "virtual"] }),
      availability: { ...nStr, description: "Best day/time for a call or visit" },
      preferred_language: nStr,
      how_found: nStr,
      title_deslindado: { ...nStr, description: "Sellers: surveyed title yes/no/unknown" },
      has_mortgage: nStr,
      expected_price: nNum,
      property_size: nStr,
      guests: nInt,
      dates: nStr,
      multiple_units: nullable({ type: "boolean" }),
      interested_property_slugs: nStrArr,
    }),
  },
  {
    name: "propose_handoff",
    description:
      "Show the visitor a card to send their request to Elvyn (they review their details and press a button; nothing is sent automatically), with WhatsApp and phone options. Use it in the hand-off situations of the knowledge base.",
    strict: true,
    input_schema: obj({
      reason: { type: "string", enum: [...HANDOFF_REASONS] },
      summary: { type: "string", description: "Knowledge-base format: Name · WhatsApp · Country · Buy/Sell/Rent · Type and area · Budget · Payment · Timeline · Concrete interest · Level · Agreed next step. Use 'no indicado' for unknowns." },
      next_step: { type: "string" },
      include_visit_form: { type: "boolean" },
      property_slug: nStr,
    }),
  },
];

/* ------------------------------------------------------------------ helpers */

const REQUIRED: Record<string, (keyof Profile)[]> = {
  buy: ["full_name", "whatsapp", "country", "property_types", "zones", "budget_max", "payment_method", "timeline", "availability"],
  rent: ["full_name", "whatsapp", "property_types", "zones", "budget_max", "timeline"],
  sell: ["full_name", "whatsapp", "property_types", "zones", "expected_price", "property_size", "title_deslindado", "availability"],
  other: ["full_name", "whatsapp"],
};

export function missingFields(p: Profile): string[] {
  const req = REQUIRED[p.intent ?? "other"] ?? REQUIRED.other;
  return req.filter((k) => {
    const v = p[k];
    if (k === "budget_max") return !(p.budget_max || p.budget_min);
    return v === null || v === undefined || (Array.isArray(v) && v.length === 0) || v === "";
  });
}

function compact(l: ListingSummary, lang: Lang) {
  const price = priceLabel(l, lang);
  return {
    slug: l.slug,
    ref: l.ref,
    title: l.title,
    type: categoryLabel(l, lang),
    operations: l.operations,
    is_development: l.isProject,
    price: price ? [price.prefix, price.main, price.suffix].filter(Boolean).join(" ") : "price on request",
    price_raw: l.price.sale ?? l.price.projectFrom ?? l.price.rent ?? l.price.rental ?? null,
    location: locationLabel(l),
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    built_area: l.area ? formatArea(l.area, lang) : null,
    land_area: l.landArea ? formatArea(l.landArea, lang) : null,
    condition: l.condition.label,
    url: href(lang, "listing", l.slug),
  };
}

export function toCard(l: ListingSummary, lang: Lang, reason: string): Card {
  const price = priceLabel(l, lang);
  const area = l.area ?? l.landArea;
  return {
    slug: l.slug,
    ref: l.ref,
    title: l.title,
    image: l.image,
    price: price?.main ?? null,
    pricePrefix: price?.prefix ?? null,
    priceSuffix: price?.suffix ?? null,
    location: locationLabel(l),
    type: categoryLabel(l, lang),
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    area: area ? formatArea(area, lang) : null,
    url: href(lang, "listing", l.slug),
    reason: reason.slice(0, 220),
  };
}

const searchInput = z.object({
  operation: z.enum(["sale", "rent", "any"]),
  property_types: z.array(z.enum(TYPE_KEYS)).max(11).nullable(),
  location: z.string().max(80).nullable(),
  budget_min: z.number().positive().max(1e10).nullable(),
  budget_max: z.number().positive().max(1e10).nullable(),
  currency: z.enum(["USD", "DOP"]),
  bedrooms_min: z.number().int().min(0).max(30).nullable(),
  bathrooms_min: z.number().int().min(0).max(30).nullable(),
  condition: z.enum(["ready", "construction", "any"]),
  keywords: z.string().max(80).nullable(),
  sort: z.enum(["recent", "price_asc", "price_desc"]),
  limit: z.number().int(),
});

function locationMatch(l: ListingSummary, loc: string): boolean {
  const q = fold(loc);
  if (!q) return true;
  const hay = fold([l.location.city, l.location.sector, l.location.province, l.title].join(" "));
  return q.split(/[\s,]+/).filter((w) => w.length > 2).every((w) => hay.includes(w));
}

/**
 * Keyword synonyms (listings are written in Spanish; visitors may write in English).
 * Each keyword matches if any of its variants appears in the title, description or amenities.
 */
const SYNONYMS: Record<string, string[]> = {
  pool: ["piscina", "pool"],
  piscina: ["piscina", "pool"],
  beach: ["playa", "beach"],
  playa: ["playa", "beach"],
  ocean: ["mar", "ocean", "oceano"],
  sea: ["mar", "sea"],
  view: ["vista", "view"],
  garden: ["jardin", "garden"],
  furnished: ["amueblad", "furnished"],
  gated: ["cerrado", "privado", "gated", "seguridad", "vigilancia"],
  security: ["seguridad", "vigilancia", "security"],
  parking: ["parqueo", "estacionamiento", "parking"],
  terrace: ["terraza", "terrace"],
  gym: ["gimnasio", "gym"],
  airbnb: ["airbnb"],
};
const STOP = new Set(["con", "and", "the", "with", "for", "una", "uno", "los", "las", "del", "que", "near", "cerca"]);

function keywordGroups(keywords: string): string[][] {
  return fold(keywords)
    .split(/[\s,]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => SYNONYMS[w] ?? [w.replace(/(es|s)$/, "")]);
}

async function haystackFor(l: ListingSummary): Promise<string> {
  const base = `${l.title} ${l.shortDescription ?? ""}`;
  const d = "amenities" in l ? (l as ListingDetail) : await getListing(l.slug).catch(() => null);
  if (!d) return fold(base);
  return fold(`${base} ${d.descriptionText.slice(0, 4000)} ${d.amenities.join(" ")}`);
}

async function runSearch(items: ListingSummary[], i: z.infer<typeof searchInput>): Promise<ListingSummary[]> {
  const rate = impliedUsdDopRate(items);
  const f: SearchFilters = {
    ...DEFAULT_FILTERS,
    operation: i.operation === "any" ? null : i.operation,
    currency: i.currency,
    priceMin: i.budget_min,
    priceMax: i.budget_max,
    bedroomsMin: i.bedrooms_min || null,
    bathroomsMin: i.bathrooms_min || null,
    condition: i.condition === "any" ? null : i.condition,
    sort: i.sort,
  };
  let list = filterListings(items, f, rate);
  if (i.property_types?.length) {
    const pats = i.property_types.map((t) => TYPE_PATTERNS[t]);
    list = list.filter((l) => pats.some((p) => p.test(fold(`${l.category?.name ?? ""} ${l.category?.nameEn ?? ""}`))));
  }
  if (i.location) list = list.filter((l) => locationMatch(l, i.location!));
  if (i.keywords) {
    const groups = keywordGroups(i.keywords);
    if (groups.length) {
      // Amenities and full descriptions come from the (cached) detail; limited to 60 candidates.
      const candidates = sortListings(list, f, rate).slice(0, 60);
      const kept: ListingSummary[] = [];
      for (let k = 0; k < candidates.length; k += 6) {
        const batch = candidates.slice(k, k + 6);
        const hays = await Promise.all(batch.map(haystackFor));
        batch.forEach((l, j) => {
          if (groups.every((variants) => variants.some((v) => hays[j].includes(v)))) kept.push(l);
        });
      }
      list = kept;
    }
  }
  return sortListings(list, f, rate);
}

/* ------------------------------------------------------------------ executor */

export async function executeTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<{ content: string; isError?: boolean }> {
  const sig = `${name}:${JSON.stringify(rawInput)}`;
  const count = (ctx.executed.get(sig) ?? 0) + 1;
  ctx.executed.set(sig, count);
  if (count > 1 && name !== "update_prospect_profile")
    return { content: JSON.stringify({ error: "duplicate_call", message: "This exact call already ran in this turn; use its result." }), isError: true };

  try {
    switch (name) {
      case "search_properties": {
        const i = searchInput.parse(rawInput);
        const limit = Math.min(Math.max(i.limit || 4, 1), 6);
        const items = await getInventory();
        const matches = await runSearch(items, i);
        if (i.property_types?.length) ctx.requestedTypes = [...new Set([...(ctx.requestedTypes ?? []), ...i.property_types])];
        const shown = matches.slice(0, limit);
        shown.forEach((l) => ctx.seenSlugs.add(l.slug));
        ctx.lastSearch = shown.map((l) => l.slug);
        const result: Record<string, unknown> = {
          total_matches: matches.length,
          listings: shown.map((l) => compact(l, ctx.lang)),
          catalogue: catalogMode() === "demo" ? "DEMO snapshot captured 2026-11-24 (not live): say availability must be confirmed" : "live AlterEstate catalogue",
        };
        if (matches.length === 0) {
          const tries: { change: string; input: z.infer<typeof searchInput> }[] = [];
          if (i.budget_max) tries.push({ change: "budget_max +20%", input: { ...i, budget_max: Math.round(i.budget_max * 1.2) } });
          if (i.location) tries.push({ change: "any location", input: { ...i, location: null } });
          if (i.property_types?.length) tries.push({ change: "any property type", input: { ...i, property_types: null } });
          if (i.bedrooms_min) tries.push({ change: `bedrooms_min ${Math.max(i.bedrooms_min - 1, 0)}`, input: { ...i, bedrooms_min: Math.max(i.bedrooms_min - 1, 0) } });
          if (i.keywords) tries.push({ change: "without keywords", input: { ...i, keywords: null } });
          result.broader_options = await Promise.all(tries.map(async (t) => ({ change: t.change, matches: (await runSearch(items, t.input)).length })));
          result.instruction = "No exact match: in this same reply, search again with the broader option that has matches and show the closest listings, clearly labelled as alternatives (say how they differ). Keep it positive and end with a proposal.";
        }
        return { content: JSON.stringify(result) };
      }
      case "get_property": {
        const { slug_or_ref } = z.object({ slug_or_ref: z.string().min(1).max(220) }).parse(rawInput);
        let slug = slug_or_ref.trim();
        if (/^\d{1,8}$/.test(slug.replace(/^ref\.?\s*/i, ""))) {
          const ref = slug.replace(/\D/g, "");
          const hit = (await getInventory()).find((l) => l.ref === ref);
          if (!hit) return { content: JSON.stringify({ found: false, message: `No published listing with reference ${ref}.` }) };
          slug = hit.slug;
        }
        const d = await getListing(slug);
        if (!d) return { content: JSON.stringify({ found: false, message: "This listing is not published in the catalogue (it may have been sold, rented or withdrawn)." }) };
        ctx.seenSlugs.add(d.slug);
        const available = d.units.filter((u) => u.status === "available");
        return {
          content: JSON.stringify({
            found: true,
            ...compact(d, ctx.lang),
            description: d.descriptionText.slice(0, 2500),
            amenities: d.amenities.slice(0, 40),
            half_bathrooms: d.halfBathrooms,
            parking: d.parking,
            floor: d.floorLevel,
            year_built: d.yearBuilt,
            delivery_date: d.deliveryDate,
            maintenance_fee: d.prices.maintenance,
            location_note: d.hideLocation ? "Exact location not public; shared when a visit is arranged." : null,
            has_video: Boolean(d.videoUrl || d.virtualTourUrl),
            development_units: d.units.length
              ? { total: d.units.length, listed_available: available.length, available_prices: available.slice(0, 15).map((u) => u.price) }
              : null,
            agent: d.agents[0]?.name ?? null,
            availability_note: "Published in the catalogue at the time of this query; final availability and price are confirmed by Elvyn.",
          }),
        };
      }
      case "show_properties": {
        const { items } = z.object({ items: z.array(z.object({ slug: z.string(), reason: z.string().max(400) })).min(1).max(6) }).parse(rawInput);
        const inv = await getInventory();
        const shown: string[] = [];
        const rejected: string[] = [];
        const wrongType: string[] = [];
        for (const it of items.slice(0, 4)) {
          const l = ctx.seenSlugs.has(it.slug) ? inv.find((x) => x.slug === it.slug) : undefined;
          if (!l) {
            rejected.push(it.slug);
            continue;
          }
          if (!matchesRequestedType(l, ctx)) {
            wrongType.push(it.slug);
            continue;
          }
          if (!ctx.cards.some((c) => c.slug === l.slug)) ctx.cards.push(toCard(l, ctx.lang, it.reason));
          shown.push(l.slug);
        }
        const notes = [
          rejected.length ? "Rejected slugs were not returned by a tool in this conversation." : null,
          wrongType.length ? `Not shown: ${wrongType.join(", ")} (property type differs from what the visitor asked for: ${ctx.requestedTypes?.join("/")}). Do not mention them as matches.` : null,
        ].filter(Boolean);
        return { content: JSON.stringify({ shown, rejected: [...rejected, ...wrongType], note: notes.length ? notes.join(" ") : undefined }), isError: shown.length === 0 };
      }
      case "update_prospect_profile": {
        const parsed = profileSchema.parse(rawInput);
        for (const [k, v] of Object.entries(parsed)) {
          if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) continue;
          (ctx.profile as Record<string, unknown>)[k] = v;
        }
        return { content: JSON.stringify({ saved: true, profile: ctx.profile }) };
      }
      case "propose_handoff": {
        const i = z
          .object({ reason: z.enum(HANDOFF_REASONS), summary: z.string().max(1500), next_step: z.string().max(300), include_visit_form: z.boolean(), property_slug: z.string().max(220).nullable() })
          .parse(rawInput);
        const slug = i.property_slug ?? ctx.pageSlug;
        ctx.handoff = {
          reason: i.reason,
          summary: i.summary,
          nextStep: i.next_step,
          includeVisitForm: i.include_visit_form,
          propertySlug: slug && (ctx.seenSlugs.has(slug) || slug === ctx.pageSlug) ? slug : null,
          status: "proposed",
        };
        return {
          content: JSON.stringify({
            shown: true,
            note: "A card is now displayed with the visitor's details to review and a 'Send to Elvyn' button, plus WhatsApp and phone. Nothing has been sent yet. Tell the visitor briefly what happens next.",
            calendar_connected: false,
          }),
        };
      }
      default:
        return { content: JSON.stringify({ error: "unknown_tool" }), isError: true };
    }
  } catch (err) {
    if (err instanceof CatalogUnavailable)
      return { content: JSON.stringify({ error: "catalogue_unavailable", message: "The catalogue cannot be reached right now. Apologise, suggest browsing later or contacting Elvyn." }), isError: true };
    if (err instanceof z.ZodError) return { content: JSON.stringify({ error: "invalid_input", issues: err.issues.slice(0, 5).map((x) => `${x.path.join(".")}: ${x.message}`) }), isError: true };
    return { content: JSON.stringify({ error: "tool_failed" }), isError: true };
  }
}

export const __test = { runSearch, searchInput, envPriority: () => env.crm.priorityBudgetUsd };

/* ------------------------------------------------------------------ deterministic safety nets */

const VISIT_RE = /\b(visit\w*|ver (la|el|esa|ese) (propiedad|solar|casa|villa|apartamento)|agend\w*|cita|videollamada|video ?call|tour|recorrido)\b/i;
const HUMAN_RE = /\b(hablar con (una persona|alguien|elvyn|un humano|un agente)|talk to (a person|someone|elvyn|a human|an agent)|llamad\w*|ll[aá]m(a|e)me|call me|reserv\w*|ofert\w*|make an offer|negoci\w*)\b/i;

/**
 * If the visitor asked for a visit, a person, a reservation, an offer or a negotiation and the model
 * did not show the hand-off card, the server shows it (knowledge base, section 4).
 */
export function ensureHandoff(userText: string, ctx: ToolContext): void {
  if (ctx.handoff && ctx.handoff.status === "proposed") return;
  if (ctx.handoff?.status === "sent") return;
  const visit = VISIT_RE.test(userText);
  const human = HUMAN_RE.test(userText);
  if (!visit && !human) return;
  const p = ctx.profile;
  const reason = visit ? "visit" : /reserv|ofert|offer/i.test(userText) ? "reserve_offer_payment" : /negoci/i.test(userText) ? "negotiation" : "human_request";
  const slug = ctx.pageSlug ?? (ctx.cards.length === 1 ? ctx.cards[0].slug : null);
  const fmt = (v: unknown) => (Array.isArray(v) ? v.join("/") : v ? String(v) : "no indicado");
  ctx.handoff = {
    reason,
    summary: [
      fmt(p.full_name), fmt(p.whatsapp), fmt(p.country),
      p.intent === "sell" ? "Venta" : p.intent === "rent" ? "Alquiler" : "Compra",
      `${fmt(p.property_types)} en ${fmt(p.zones)}`,
      p.budget_max ? `${p.currency ?? "USD"} ${p.budget_max}` : "Presupuesto no indicado",
      fmt(p.payment_method), fmt(p.timeline),
      slug ? `Propiedad: ${slug}` : "Sin propiedad concreta",
      `Próximo paso: ${visit ? "coordinar visita" : "contacto con Elvyn"}`,
    ].join(" · "),
    nextStep: visit ? "Coordinar visita" : "Contacto con Elvyn",
    includeVisitForm: visit,
    propertySlug: slug,
    status: "proposed",
  };
}

/** If the model described search results without calling show_properties, show them as cards. */
export async function ensureCards(ctx: ToolContext, text: string): Promise<void> {
  if (ctx.cards.length || !ctx.lastSearch?.length || !text) return;
  const inv = await getInventory().catch(() => []);
  for (const slug of ctx.lastSearch.slice(0, 4)) {
    const l = inv.find((x) => x.slug === slug);
    if (l && matchesRequestedType(l, ctx)) ctx.cards.push(toCard(l, ctx.lang, ""));
  }
}

const LAND_WORDS = /(?<![\p{L}])(terrenos?|solar(es)?|lotes?|land|plots?)(?![\p{L}])/iu;
const BUILT_WORDS = /(?<![\p{L}])(villas?|casas?|houses?|homes?|apartamentos?|apartments?|aptos?|condos?|penthouses?|locales?|hotel(es)?|fincas?|farms?|edificios?|buildings?|oficinas?|offices?)(?![\p{L}])/iu;

/** Types stated in the visitor's own words (only the unambiguous "land, nothing built" case). */
export function typesFromText(text: string): string[] | undefined {
  return LAND_WORDS.test(text) && !BUILT_WORDS.test(text) ? ["land"] : undefined;
}

/** A listing matches when no type was requested in this turn, or its category is one of the requested types. */
function matchesRequestedType(l: ListingSummary, ctx: ToolContext): boolean {
  const types = (ctx.requestedTypes ?? []).filter((t): t is keyof typeof TYPE_PATTERNS => t in TYPE_PATTERNS);
  if (!types.length) return true;
  const cat = fold(`${l.category?.name ?? ""} ${l.category?.nameEn ?? ""}`);
  return types.some((t) => TYPE_PATTERNS[t].test(cat));
}

/* Sentences claiming the request was already sent, booked or confirmed. */
const END = "(?![\\p{L}\\p{N}])"; // word end that also works after accented letters (\b does not)
// Verbs that only mean "sent to Elvyn" when the object is the request (not "te dejé las opciones abajo").
const OBJ_ES = String.raw`[^.!?\n]{0,40}(?<![\p{L}])(visita|cita|solicitud|reserva|petición|datos|información|mensaje|a\s+Elvyn|con\s+Elvyn)`;
const OBJ_EN = String.raw`[^.!?\n]{0,40}(?<![\p{L}])(visit|viewing|request|booking|appointment|details|information|message|to\s+Elvyn|with\s+Elvyn)`;
const CLAIM_RES = [
  String.raw`(?<![\p{L}])(agendé|reservé|confirmé|programé|coordiné|notifiqué|avisé|transmití)` + END,
  String.raw`(?<![\p{L}])(dejé|envié|mandé|pasé|registré|solicité)` + END + OBJ_ES,
  String.raw`(?<![\p{L}])(he|hemos)\s+(ya\s+)?(agendado|reservado|confirmado|programado|coordinado|notificado|avisado|transmitido)` + END,
  String.raw`(?<![\p{L}])(he|hemos)\s+(ya\s+)?(dejado|enviado|mandado|pasado|registrado|solicitado)` + END + OBJ_ES,
  String.raw`(?<![\p{L}])(visita|cita|solicitud|reserva|petición)[^.!?\n]{0,40}(?<![\p{L}])(está|quedó|ha quedado|ha sido|fue)\s+(ya\s+)?(confirmad|agendad|reservad|enviad|registrad|programad)[ao]s?` + END,
  String.raw`(?<![\p{L}])I(?:'ve|’ve|\s+have)?\s+(?:already\s+|just\s+)?(?:booked|scheduled|confirmed|reserved|arranged|notified)` + END,
  String.raw`(?<![\p{L}])I(?:'ve|’ve|\s+have)?\s+(?:already\s+|just\s+)?(?:sent|forwarded|passed|submitted|registered|requested)` + END + OBJ_EN,
  String.raw`(?<![\p{L}])(visit|viewing|request|appointment|booking|tour)[^.!?\n]{0,40}(?<![\p{L}])(is|has been|was)\s+(now\s+)?(booked|confirmed|scheduled|sent|submitted|registered|arranged|reserved)` + END,
].map((src) => new RegExp(src, "iu"));

/**
 * Nothing reaches Elvyn until the visitor presses the button on the hand-off card. If the model
 * claims otherwise, the false sentences are removed and replaced by the real next step.
 * Returns the (possibly corrected) text.
 */
export function correctFalseClaims(text: string, ctx: ToolContext, cardShown = false): string {
  if (!text || ctx.handoff?.status === "sent") return text;
  const parts = text.split(/(?<=[.!?])\s+|\n/);
  const kept = parts.filter((p) => !CLAIM_RES.some((re) => re.test(p)));
  if (kept.length === parts.length) {
    // Whatever the wording, when the card appears the visitor reads the real next step.
    if (!cardShown) return text;
    const step =
      ctx.lang === "es"
        ? "Para que Elvyn reciba tu solicitud, completa tus datos en la tarjeta de abajo y pulsa el botón de envío: hasta entonces no se le envía nada."
        : "For Elvyn to receive your request, fill in your details on the card below and press the send button: nothing is sent until then.";
    return `${text.trim()}\n\n${step}`;
  }
  const notice =
    ctx.lang === "es"
      ? ctx.handoff
        ? "Todavía no se ha enviado nada: para que Elvyn reciba tu solicitud, completa tus datos y pulsa el botón de la tarjeta de abajo. La visita quedará pendiente de su confirmación."
        : "Todavía no se ha enviado nada a Elvyn. Puedes escribirle directamente por WhatsApp o dejar tus datos para que te contacte."
      : ctx.handoff
        ? "Nothing has been sent yet: for Elvyn to receive your request, fill in your details and press the button on the card below. The visit will then be pending his confirmation."
        : "Nothing has been sent to Elvyn yet. You can message him directly on WhatsApp or leave your details so he can contact you.";
  const body = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return body ? `${notice}\n\n${body}` : notice;
}
