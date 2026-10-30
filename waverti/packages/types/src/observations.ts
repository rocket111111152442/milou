import { z } from "zod";

export const availabilitySchema = z.enum(["in_stock", "out_of_stock", "preorder", "unknown"]);
export type Availability = z.infer<typeof availabilitySchema>;

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
