import { z } from "zod";

export const siteInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((d) => d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""))
    .pipe(z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "Domaine invalide")),
});

export const endpointInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    url: z.string().trim().url().max(2048),
    method: z.enum(["GET", "HEAD"]).default("GET"),
    expectedStatusMin: z.number().int().min(100).max(599).default(200),
    expectedStatusMax: z.number().int().min(100).max(599).default(399),
    expectedKeyword: z.string().trim().min(1).max(200).optional(),
    timeoutMs: z.number().int().min(1000).max(30000).default(10000),
  })
  .refine((v) => v.expectedStatusMax >= v.expectedStatusMin, { message: "Plage de statuts invalide" });
export type EndpointInput = z.infer<typeof endpointInputSchema>;

const selector = z.string().trim().min(1).max(300);

export const scenarioStepSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("goto"), url: z.string().trim().url().max(2048) }),
  z.object({ action: z.literal("click"), selector }),
  z.object({ action: z.literal("fill"), selector, value: z.string().max(200) }),
  z.object({ action: z.literal("press"), selector, key: z.enum(["Enter", "Tab", "Escape"]) }),
  z.object({ action: z.literal("expect_text"), text: z.string().trim().min(1).max(200) }),
  z.object({ action: z.literal("expect_visible"), selector }),
  z.object({ action: z.literal("expect_url"), contains: z.string().trim().min(1).max(300) }),
  z.object({ action: z.literal("wait"), ms: z.number().int().min(100).max(10_000) }),
]);
export type ScenarioStep = z.infer<typeof scenarioStepSchema>;

export const scenarioInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  startUrl: z.string().trim().url().max(2048),
  steps: z.array(scenarioStepSchema).min(1).max(20),
});
export type ScenarioInput = z.infer<typeof scenarioInputSchema>;

/**
 * Mots-clés d'actions potentiellement engageantes (achat, paiement, envoi définitif).
 * Un clic sur un élément dont le texte contient l'un d'eux est bloqué par le moteur.
 */
export const BLOCKED_ACTION_KEYWORDS = [
  "payer",
  "paiement",
  "commander",
  "acheter",
  "valider la commande",
  "confirmer la commande",
  "finaliser",
  "souscrire",
  "pay now",
  "place order",
  "buy now",
  "checkout",
  "purchase",
  "supprimer mon compte",
  "delete account",
] as const;
