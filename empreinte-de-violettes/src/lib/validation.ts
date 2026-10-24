import { z } from "zod";

const str = (max = 500) => z.string().trim().max(max);
const money = z.coerce.number().int().min(0).max(10_000_000);
const img = z.string().trim().max(3_000_000); // URL ou data-URL compressée

export const cartLineSchema = z.object({
  productId: z.string().max(80).nullable(),
  variantId: z.string().max(120).optional(),
  quantity: z.coerce.number().int().min(1).max(20),
  addonIds: z.array(z.string().max(80)).max(10).optional(),
  custom: z
    .object({
      stems: z.array(z.object({ flowerId: z.string().max(80), quantity: z.coerce.number().int().min(0).max(60) })).max(40),
      wrappingId: z.string().max(80).optional(),
      note: str(300).optional(),
    })
    .optional(),
});

export const checkoutSchema = z.object({
  lines: z.array(cartLineSchema).min(1).max(50),
  mode: z.enum(["delivery", "pickup", "drive"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotId: z.string().max(80),
  customer: z.object({
    firstName: str(80).min(1, "Prénom requis"),
    lastName: str(80).min(1, "Nom requis"),
    email: z.string().trim().email("E-mail invalide").max(200),
    phone: str(30).min(6, "Téléphone requis"),
  }),
  recipient: z
    .object({
      name: str(120).min(1, "Nom du destinataire requis"),
      phone: str(30).min(6, "Téléphone du destinataire requis"),
      company: str(120).optional(),
      address: str(200).min(3, "Adresse requise"),
      address2: str(200).optional(),
      postcode: z.string().trim().regex(/^\d{5}$/, "Code postal invalide"),
      city: str(120).min(1, "Ville requise"),
      instructions: str(500).optional(),
    })
    .optional(),
  cardMessage: str(400).optional(),
  cardSignature: str(80).optional(),
  anonymous: z.boolean().optional(),
  promoCode: str(40).optional(),
  payInStore: z.boolean().optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Veuillez accepter les conditions de vente" }) }),
});

export const contactSchema = z.object({
  type: z.enum(["contact", "mariage", "evenement", "deuil", "entreprise"]).default("contact"),
  name: str(120).min(2, "Votre nom"),
  email: z.string().trim().email("E-mail invalide").max(200),
  phone: str(30).optional(),
  subject: str(200).optional(),
  message: str(4000).min(5, "Votre message"),
  eventDate: str(40).optional(),
  budget: str(60).optional(),
  guests: str(40).optional(),
  venue: str(200).optional(),
  website: z.string().max(0).optional(), // pot de miel anti-spam
});

// ---------- Administration ----------

const variant = z.object({ id: str(120).min(1), name: str(80).min(1), price: money, description: str(300).optional() });

export const adminSchemas = {
  products: z.object({
    id: str(80).optional(),
    slug: str(120).optional(),
    name: str(120).min(1),
    subtitle: str(200).default(""),
    description: str(4000).default(""),
    details: str(4000).optional(),
    categoryId: str(80).min(1),
    occasionIds: z.array(str(80)).default([]),
    price: money,
    compareAtPrice: money.nullable().optional(),
    variants: z.array(variant).max(12).default([]),
    images: z.array(img).max(12).default([]),
    stock: z.coerce.number().int().min(0).nullable().default(null),
    active: z.boolean().default(true),
    featured: z.boolean().default(false),
    isNew: z.boolean().default(false),
    seasonal: z.boolean().default(false),
    deliveryOnly: z.boolean().optional(),
    pickupOnly: z.boolean().optional(),
    colors: z.array(str(20)).max(8).default([]),
    tags: z.array(str(40)).max(20).default([]),
    star: str(80).optional(),
    plate: str(40).optional(),
    sortOrder: z.coerce.number().default(0),
  }),
  categories: z.object({
    id: str(80).optional(),
    slug: str(120).optional(),
    name: str(80).min(1),
    description: str(1000).default(""),
    image: img.default(""),
    plate: str(40).optional(),
    active: z.boolean().default(true),
    showInMenu: z.boolean().default(true),
    sortOrder: z.coerce.number().default(0),
  }),
  occasions: z.object({
    id: str(80).optional(),
    slug: str(120).optional(),
    name: str(80).min(1),
    active: z.boolean().default(true),
    sortOrder: z.coerce.number().default(0),
  }),
  addons: z.object({
    id: str(80).optional(),
    name: str(120).min(1),
    description: str(500).default(""),
    price: money,
    image: img.default(""),
    active: z.boolean().default(true),
    sortOrder: z.coerce.number().default(0),
  }),
  promos: z.object({
    id: str(80).optional(),
    code: z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9_-]+$/, "Lettres, chiffres, - et _ uniquement"),
    type: z.enum(["percent", "fixed", "free_delivery"]),
    value: z.coerce.number().min(0),
    minSubtotal: money.default(0),
    startsAt: z.string().nullable().optional(),
    endsAt: z.string().nullable().optional(),
    maxUses: z.coerce.number().int().min(0).nullable().optional(),
    uses: z.coerce.number().int().min(0).default(0),
    active: z.boolean().default(true),
    description: str(300).optional(),
  }),
  reviews: z.object({
    id: str(80).optional(),
    author: str(80).min(1),
    text: str(2000).min(1),
    rating: z.coerce.number().min(1).max(5),
    source: str(80).default("Google"),
    date: str(40).default(""),
    active: z.boolean().default(true),
    featured: z.boolean().default(false),
  }),
  faqs: z.object({
    id: str(80).optional(),
    question: str(300).min(1),
    answer: str(4000).min(1),
    category: str(80).default("Général"),
    sortOrder: z.coerce.number().default(0),
    active: z.boolean().default(true),
  }),
  gallery: z.object({
    id: str(80).optional(),
    image: img.min(1),
    caption: str(200).default(""),
    category: z.enum(["mariage", "deuil", "boutique", "evenement", "atelier"]),
    sortOrder: z.coerce.number().default(0),
    active: z.boolean().default(true),
  }),
  messages: z.object({
    id: str(80).optional(),
    type: z.enum(["contact", "mariage", "evenement", "deuil", "entreprise"]),
    name: str(120),
    email: str(200),
    phone: str(30).optional(),
    subject: str(200).optional(),
    message: str(4000),
    eventDate: str(40).optional(),
    budget: str(60).optional(),
    guests: str(40).optional(),
    venue: str(200).optional(),
    status: z.enum(["new", "read", "replied", "archived"]),
    createdAt: str(40),
  }),
  subscribers: z.object({ id: str(80).optional(), email: z.string().email(), createdAt: str(40).default(() => new Date().toISOString()) }),
} as const;

export type AdminCollection = keyof typeof adminSchemas;

export function firstError(e: z.ZodError) {
  const i = e.issues[0];
  return i ? `${i.path.join(".") || "champ"} : ${i.message}` : "Données invalides";
}

// ---------- Documents (paramètres) ----------

const time = z.string().regex(/^\d{2}:\d{2}$/, "Heure au format HH:MM");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format AAAA-MM-JJ");
const mode = z.enum(["delivery", "pickup", "drive"]);

export const docSchemas = {
  settings: z.object({
    shopName: str(120).min(1),
    tagline: str(200),
    legalName: str(200),
    siret: str(40),
    phone: str(40),
    email: z.string().trim().email(),
    address: str(200),
    postcode: str(10),
    city: str(120),
    mapsUrl: str(1000),
    lat: z.coerce.number(),
    lng: z.coerce.number(),
    instagram: str(300),
    facebook: str(300),
    hours: z.array(z.object({ day: z.number().int().min(0).max(6), closed: z.boolean(), ranges: z.array(z.object({ from: time, to: time })).max(4) })).length(7),
    closures: z.array(z.object({ id: str(80), from: isoDate, to: isoDate, label: str(120) })).max(60),
    announcement: z.object({ active: z.boolean(), text: str(300), link: str(300) }),
    intro: z.object({ enabled: z.boolean(), oncePerSession: z.boolean() }),
    maintenance: z.object({ enabled: z.boolean(), message: str(500) }),
    seo: z.object({ title: str(200), description: str(400) }),
    notifyEmail: z.string().trim().email(),
    allowPayInStore: z.boolean(),
    googleRating: z.coerce.number().min(0).max(5),
    googleReviews: z.coerce.number().int().min(0),
  }),
  delivery: z.object({
    deliveryEnabled: z.boolean(),
    pickupEnabled: z.boolean(),
    driveEnabled: z.boolean(),
    zones: z
      .array(
        z.object({
          id: str(80).min(1),
          name: str(120).min(1),
          postcodes: z.array(z.string().regex(/^\d{5}$/, "Code postal à 5 chiffres")).min(1),
          cities: z.array(str(120)),
          fee: money,
          minOrder: money,
          freeFrom: money.nullable(),
          active: z.boolean(),
        }),
      )
      .max(40),
    slots: z
      .array(
        z.object({
          id: str(80).min(1),
          label: str(120).min(1),
          from: time,
          to: time,
          days: z.array(z.number().int().min(0).max(6)),
          modes: z.array(mode).min(1),
          capacity: z.coerce.number().int().min(0).nullable(),
        }),
      )
      .min(1)
      .max(20),
    leadTimeHours: z.coerce.number().min(0).max(240),
    sameDayCutoff: time,
    maxDaysAhead: z.coerce.number().int().min(1).max(365),
    closedDays: z.array(z.number().int().min(0).max(6)),
    blackoutDates: z.array(isoDate).max(200),
    pickupNote: str(500),
    driveNote: str(500),
  }),
  content: z.object({
    hero: z.object({ eyebrow: str(200), titleLine1: str(80), titleLine2: str(80), subtitle: str(600), ctaLabel: str(80), images: z.array(img).max(6), videoUrl: str(1000) }),
    marquee: z.array(str(120)).max(12),
    manifesto: z.object({ eyebrow: str(120), text: str(2000), signature: str(120), image: img }),
    stats: z.array(z.object({ value: str(20), label: str(80) })).max(6),
    seasonal: z.object({ active: z.boolean(), eyebrow: str(120), title: str(120), text: str(600), targetDate: str(40), ctaLabel: str(80), ctaLink: str(300), image: img }),
    about: z.object({ title: str(200), intro: str(1000), paragraphs: z.array(str(3000)).max(10), image: img, values: z.array(z.object({ title: str(80), text: str(400) })).max(8) }),
    wedding: z.object({ title: str(200), intro: str(2000), steps: z.array(z.object({ title: str(80), text: str(500) })).max(8), image: img, priceNote: str(500) }),
    funeral: z.object({ title: str(200), intro: str(2000), image: img }),
    legal: z.object({ mentions: str(20000), cgv: str(40000), privacy: str(20000) }),
  }),
  atelier: z.object({
    enabled: z.boolean(),
    basePrice: money,
    minStems: z.coerce.number().int().min(1).max(100),
    maxStems: z.coerce.number().int().min(1).max(200),
    flowers: z.array(z.object({ id: str(80).min(1), name: str(80).min(1), color: str(20), price: money, active: z.boolean(), kind: z.enum(["fleur", "feuillage"]), plate: str(40).optional() })).max(60),
    wrappings: z.array(z.object({ id: str(80).min(1), name: str(80).min(1), price: money, color: str(20) })).min(1).max(12),
  }),
} as const;
