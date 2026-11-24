import { z } from "zod";
import { normalizeEmail, normalizePhone } from "./identity";

const text = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const strList = z.array(z.string().trim().min(1).max(60)).max(10).optional();
const amount = z.coerce.number().positive().max(1e10).optional().nullable().catch(null);

export const criteriaInput = z
  .object({
    intent: z.enum(["buy", "rent", "sell", "other"]).optional(),
    propertyTypes: strList,
    zones: strList,
    budgetMin: amount,
    budgetMax: amount,
    currency: z.enum(["USD", "DOP", "EUR"]).optional().nullable(),
    paymentMethod: text(80),
    usage: text(80),
    timeline: text(80),
    bedrooms: z.coerce.number().int().min(0).max(30).optional().nullable().catch(null),
    mustHaves: strList,
    visitPreference: z.enum(["physical", "virtual"]).optional().nullable(),
    availability: text(200),
    titleDeslindado: text(40),
    hasMortgage: text(40),
    expectedPrice: amount,
    guests: z.coerce.number().int().min(1).max(50).optional().nullable().catch(null),
    dates: text(120),
    multipleUnits: z.boolean().optional().nullable(),
  })
  .partial();

/** Input of every lead creation path (forms and assistant hand-off). Validated on the server. */
export const leadInput = z
  .object({
    kind: z.enum(["contact", "property", "visit", "sell", "chat_handoff"]),
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().max(200).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
    country: text(80),
    city: text(80),
    language: z.enum(["es", "en"]).default("es"),
    howFound: text(120),
    message: text(2000),
    criteria: criteriaInput.default({}),
    reason: text(60),
    summary: text(2000),
    property: z
      .object({ slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,200}$/i), ref: text(40), title: text(250) })
      .optional()
      .nullable(),
    visit: z
      .object({
        type: z.enum(["physical", "virtual"]),
        timezone: z.string().trim().max(60).default("America/Santo_Domingo"),
        slots: z.array(z.string().trim().min(3).max(80)).min(1).max(3),
      })
      .optional()
      .nullable(),
    consent: z.literal(true),
  })
  .transform((v, ctx) => {
    const email = v.email ? normalizeEmail(v.email) : null;
    const phone = v.phone ? normalizePhone(v.phone) : null;
    if (v.email && !email) ctx.addIssue({ code: "custom", path: ["email"], message: "email" });
    if (v.phone && !phone) ctx.addIssue({ code: "custom", path: ["phone"], message: "phone" });
    if (!email && !phone) ctx.addIssue({ code: "custom", path: ["contact"], message: "contact" });
    if (v.kind === "visit" && !v.visit) ctx.addIssue({ code: "custom", path: ["visit"], message: "visit" });
    return { ...v, email, phone };
  });

export type LeadInput = z.output<typeof leadInput>;
export type LeadInputRaw = z.input<typeof leadInput>;
