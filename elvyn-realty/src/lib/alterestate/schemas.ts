import { z } from "zod";

/**
 * Lenient schemas for AlterEstate public API responses
 * (https://dev.alterestate.com/properties/list and /properties/retrieve, read 24/11/2026).
 * Fields are optional/nullable because the documentation states that public fields
 * depend on each agency's configuration. Unknown fields are kept (looseObject).
 */
const numish = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  });
const strish = z.union([z.string(), z.null(), z.undefined()]).transform((v) => (v ?? null));
const boolish = z.union([z.boolean(), z.null(), z.undefined()]).transform((v) => (v ?? null));

export const aeCategory = z.looseObject({ id: numish, name: strish, name_en: strish.optional() });
export const aeListingType = z.looseObject({ id: numish, listing: strish });
export const aeAgent = z.looseObject({
  id: numish.optional(),
  uid: strish.optional(),
  slug: strish.optional(),
  company: numish.optional(),
  first_name: strish.optional(),
  last_name: strish.optional(),
  full_name: strish.optional(),
  email: strish.optional(),
  phone: strish.optional(),
  position: strish.optional(),
  avatar: strish.optional(),
});
/**
 * Agents: the detail endpoint returns objects; the list endpoint was observed (24/11/2026,
 * live account) returning plain strings. Strings are dropped (no usable contact data).
 */
const aeAgents = z
  .array(z.union([aeAgent, z.string(), z.number(), z.null()]))
  .nullable()
  .optional()
  .transform((arr) => (arr ? arr.filter((a): a is z.infer<typeof aeAgent> => typeof a === "object" && a !== null) : arr));

export const aeGalleryImage = z.looseObject({ image: strish, priority: numish.optional() });
export const aeLatLong = z.union([
  z.literal(false),
  z.null(),
  z.undefined(),
  z.looseObject({ latitude: numish.optional(), longitude: numish.optional(), lat: numish.optional(), lng: numish.optional() }),
]);
export const aeVariation = z.looseObject({
  cid: numish.optional(),
  uid: strish.optional(),
  project_model: strish.optional(),
  room: numish.optional(),
  bathroom: numish.optional(),
  parkinglot: numish.optional(),
  currency_sale: strish.optional(),
  sale_price: numish.optional(),
  property_area: numish.optional(),
  property_area_measurer: strish.optional(),
  status: strish.optional(),
  floor_level: numish.optional(),
});
export const aeProjectValues = z
  .looseObject({
    min_sale: numish.optional(),
    max_sale: numish.optional(),
    currency_min_sale: strish.optional(),
    currency_max_sale: strish.optional(),
    min_room: numish.optional(),
    max_room: numish.optional(),
    min_property_area: numish.optional(),
    max_property_area: numish.optional(),
  })
  .nullable()
  .optional();

/** Fields shared by list results, related listings and detail. */
export const aeListingBase = z.looseObject({
  cid: numish.optional(),
  uid: z.string(),
  slug: z.string(),
  name: strish.optional(),
  short_description: strish.optional(),
  category: aeCategory.nullable().optional(),
  listing_type: z.array(aeListingType).nullable().optional(),
  condition: numish.optional(),
  condition_read: strish.optional(),
  sale_price: numish.optional(),
  rent_price: numish.optional(),
  rental_price: numish.optional(),
  furnished_price: numish.optional(),
  furnished_sale_price: numish.optional(),
  maintenance_fee: numish.optional(),
  currency_sale: strish.optional(),
  currency_rent: strish.optional(),
  currency_rental: strish.optional(),
  currency_furnished: strish.optional(),
  currency_sale_furnished: strish.optional(),
  currency_maintenance: strish.optional(),
  us_saleprice: numish.optional(),
  us_rentprice: numish.optional(),
  us_rentalprice: numish.optional(),
  forSale: boolish.optional(),
  forRent: boolish.optional(),
  forRental: boolish.optional(),
  furnished: boolish.optional(),
  province: strish.optional(),
  city: strish.optional(),
  sector: strish.optional(),
  hide_location: boolish.optional(),
  room: numish.optional(),
  bathroom: numish.optional(),
  half_bathrooms: numish.optional(),
  parkinglot: numish.optional(),
  property_area: numish.optional(),
  property_area_measurer: strish.optional(),
  terrain_area: numish.optional(),
  terrain_area_measurer: strish.optional(),
  featured_image: strish.optional(),
  is_project_v2: boolish.optional(),
  project_values: aeProjectValues,
  exclusive: boolish.optional(),
  featured: boolish.optional(),
  timestamp: strish.optional(),
  agents: aeAgents,
});

export const aeListingDetail = aeListingBase.extend({
  description: strish.optional(),
  amenities: z.array(z.string()).nullable().optional(),
  gallery_image: z.array(aeGalleryImage).nullable().optional(),
  lat_long: aeLatLong.optional(),
  virtual_tour: strish.optional(),
  youtubeiframe: strish.optional(),
  delivery_date: strish.optional(),
  floor_level: numish.optional(),
  total_floors: numish.optional(),
  year_construction: z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((v) => (v == null ? null : String(v))).optional(),
  terrace_area: numish.optional(),
  terrace_area_measurer: strish.optional(),
  show_on_website: boolish.optional(),
  variations: z.array(aeVariation).nullable().optional(),
  related_properties: z.array(aeListingBase).nullable().optional(),
});

const aeListEnvelope = z.looseObject({
  count: numish,
  next: strish.optional(),
  previous: strish.optional(),
  results: z.array(z.unknown()),
});

/**
 * Parses a list page item by item: one unexpected listing is skipped (and counted) instead of
 * making the whole catalogue unavailable.
 */
export function parseListPage(raw: unknown) {
  const env = aeListEnvelope.parse(raw);
  const results: AeListingBase[] = [];
  let skipped = 0;
  let firstIssue: string | null = null;
  for (const item of env.results) {
    const r = aeListingBase.safeParse(item);
    if (r.success) results.push(r.data);
    else {
      skipped++;
      firstIssue ??= r.error.issues.slice(0, 2).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    }
  }
  return { count: env.count, next: env.next ?? null, results, skipped, firstIssue };
}
export const aeListPage = { parse: parseListPage };

export const aeAgentsList = z.array(aeAgent.extend({ bio: strish.optional(), properties: numish.optional() }));

export type AeListingBase = z.infer<typeof aeListingBase>;
export type AeListingDetail = z.infer<typeof aeListingDetail>;
export type AeListPage = ReturnType<typeof parseListPage>;
export type AeAgent = z.infer<typeof aeAgent>;
