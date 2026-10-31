import { z } from "zod";

export const availabilitySchema = z.enum(["in_stock", "out_of_stock", "preorder", "unknown"]);
export type Availability = z.infer<typeof availabilitySchema>;

/** Lien ou élément repéré sur une page : adresse absolue et libellé. */
export const linkRefSchema = z.object({ u: z.string().max(500), t: z.string().max(160) });
export type LinkRef = z.infer<typeof linkRefSchema>;

/** Résultat d'extraction d'une page (produit par le worker cloud ou l'application desktop). */
export const pageObservationSchema = z.object({
  kind: z.literal("page"),
  url: z.string().url(),
  finalUrl: z.string().url(),
  httpStatus: z.number().int().min(100).max(599),
  title: z.string().max(300).nullable(),
  price: z.number().nonnegative().max(100_000_000).nullable(),
  currency: z.string().length(3).nullable(),
  priceSource: z.enum(["jsonld", "microdata", "meta", "selector", "text"]).nullable(),
  availability: availabilitySchema,
  availabilitySource: z.enum(["jsonld", "microdata", "text", "none"]),
  textHash: z.string().regex(/^[a-f0-9]{64}$/),
  textLength: z.number().int().nonnegative(),
  /** Extrait normalisé (≤ 4000 caractères) utilisé pour les comparaisons textuelles. */
  excerpt: z.string().max(4000),
  selectorFound: z.boolean().nullable(),
  method: z.enum(["http", "browser"]),
  fetchedAt: z.string().datetime(),
  // ——— Données enrichies (facultatives : absentes des observations antérieures et des anciennes versions desktop) ———
  /** Nature du contenu : page HTML ou document (PDF…). */
  contentKind: z.enum(["html", "pdf", "document"]).optional(),
  /** Empreinte du contenu nettoyé (navigation, publicités, cookies, horloges retirées) : détection de changements. */
  contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  /** Temps de réponse mesuré par le serveur (ms). */
  responseMs: z.number().int().nonnegative().max(600_000).optional(),
  /** Prix barré affiché par le site (prix de référence), seulement s'il est supérieur au prix actuel. */
  regularPrice: z.number().nonnegative().max(100_000_000).nullable().optional(),
  headings: z.array(z.string().max(160)).max(40).optional(),
  links: z.array(linkRefSchema).max(100).optional(),
  documents: z.array(linkRefSchema).max(30).optional(),
  /** Éléments d'une liste ou d'un catalogue (produits, offres, événements, articles). */
  items: z.array(linkRefSchema.extend({ p: z.number().nonnegative().nullable().optional() })).max(60).optional(),
  /** Dates trouvées dans le contenu (AAAA-MM-JJ). */
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(40).optional(),
  tableHashes: z.array(z.string().max(16)).max(10).optional(),
  forms: z.object({ count: z.number().int().nonnegative(), signup: z.boolean() }).optional(),
});
export type PageObservation = z.infer<typeof pageObservationSchema>;

export const findingClassificationSchema = z.enum(["confirmed", "probable", "rumor", "irrelevant"]);
export type FindingClassification = z.infer<typeof findingClassificationSchema>;

export const webFindingSchema = z.object({
  url: z.string().url(),
  title: z.string().max(300),
  snippet: z.string().max(1000),
  domain: z.string().max(255),
  publishedAt: z.string().nullable(),
  classification: findingClassificationSchema,
  sourceTier: z.enum(["official", "reference", "media", "community", "unknown"]),
  extractedDate: z.string().nullable(),
  reasons: z.array(z.string().max(200)).max(10),
  fingerprint: z.string().max(128),
});
export type WebFinding = z.infer<typeof webFindingSchema>;

export const webTopicStatusSchema = z.enum(["confirmed", "probable", "rumor", "none"]);
export type WebTopicStatus = z.infer<typeof webTopicStatusSchema>;

export const webTopicObservationSchema = z.object({
  kind: z.literal("web_topic"),
  queries: z.array(z.string()).max(5),
  status: webTopicStatusSchema,
  findings: z.array(webFindingSchema).max(30),
  newFingerprints: z.array(z.string()).max(30),
  provider: z.string(),
  fromCache: z.boolean(),
  fetchedAt: z.string().datetime(),
});
export type WebTopicObservation = z.infer<typeof webTopicObservationSchema>;

export const observationSchema = z.discriminatedUnion("kind", [pageObservationSchema, webTopicObservationSchema]);
export type Observation = z.infer<typeof observationSchema>;

export const STATUS_LABELS: Record<WebTopicStatus, string> = {
  confirmed: "Information confirmée",
  probable: "Information probable",
  rumor: "Rumeur",
  none: "Aucune information trouvée",
};
