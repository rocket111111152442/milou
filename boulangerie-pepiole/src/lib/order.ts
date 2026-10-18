import { z } from "zod";

export const orderSchema = z.object({
  items: z
    .array(z.object({ id: z.string().min(1).max(64), qty: z.number().int().min(1).max(50) }))
    .min(1, "Votre panier est vide.")
    .max(40),
  pickup: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
  }),
  customer: z.object({
    firstName: z.string().trim().min(1, "Prénom requis").max(60),
    lastName: z.string().trim().min(1, "Nom requis").max(60),
    phone: z
      .string()
      .trim()
      .regex(/^(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/, "Numéro de téléphone français invalide"),
    email: z.union([z.literal(""), z.string().trim().email("Adresse e-mail invalide").max(120)]),
    note: z.string().trim().max(500).optional().default(""),
  }),
  consent: z.literal(true, { error: "Merci d'accepter le traitement de vos données pour la commande." }),
  // Champ piège anti-robots : doit rester vide
  website: z.string().max(0).optional().default(""),
});

export type OrderInput = z.input<typeof orderSchema>;
export type Order = z.output<typeof orderSchema>;

export type OrderResponse =
  | { ok: true; orderNumber: string; total: number; demo: boolean }
  | { ok: false; error: string };
