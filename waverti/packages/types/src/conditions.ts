import { z } from "zod";

/** Conditions d'alerte du moteur A (surveillance d'une URL). */
export const pageConditionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("price_below"),
    threshold: z.number().positive().max(10_000_000),
    currency: z.literal("EUR").default("EUR"),
  }),
  z.object({
    type: z.literal("price_drop"),
    /** Baisse minimale en pourcentage (0 = toute baisse). */
    minPercent: z.number().min(0).max(95).default(0),
  }),
  z.object({ type: z.literal("back_in_stock") }),
  z.object({
    type: z.literal("page_changed"),
    /** "significant" ignore les variations de moins de 2 % du texte visible. */
    sensitivity: z.enum(["any", "significant"]).default("significant"),
  }),
  z.object({ type: z.literal("text_appears"), text: z.string().trim().min(2).max(200) }),
  z.object({ type: z.literal("text_disappears"), text: z.string().trim().min(2).max(200) }),
]);
export type PageCondition = z.infer<typeof pageConditionSchema>;

export const webTopicIntentSchema = z.enum([
  "release_date",
  "announcement",
  "job_offer",
  "official_publication",
  "generic",
]);
export type WebTopicIntent = z.infer<typeof webTopicIntentSchema>;

/** Condition du moteur B (recherche sur Internet). */
export const webTopicConditionSchema = z.object({
  type: z.literal("web_topic"),
  intent: webTopicIntentSchema,
  subject: z.string().trim().min(2).max(200),
  keywords: z.array(z.string().trim().min(2).max(60)).max(8).default([]),
  /** N'alerter qu'en cas de confirmation par une source fiable. */
  requireOfficial: z.boolean().default(false),
});
export type WebTopicCondition = z.infer<typeof webTopicConditionSchema>;

export const conditionSchema = z.union([pageConditionSchema, webTopicConditionSchema]);
export type Condition = z.infer<typeof conditionSchema>;

export const CONDITION_LABELS: Record<PageCondition["type"] | "web_topic", string> = {
  price_below: "Prix sous un seuil",
  price_drop: "Baisse de prix",
  back_in_stock: "Retour en stock",
  page_changed: "Modification de la page",
  text_appears: "Apparition d'un texte",
  text_disappears: "Disparition d'un texte",
  web_topic: "Recherche sur Internet",
};
