import { z } from "zod";
import type { ActionKind } from "@antonio/shared";

const address = z.object({ email: z.string().email().transform((s) => s.toLowerCase()), name: z.string().nullable().default(null) });
export type AddressInput = z.infer<typeof address>;

const mailBase = {
  connectionId: z.string().uuid(),
  to: z.array(address).min(1, "Au moins un destinataire est requis"),
  cc: z.array(address).default([]),
  subject: z.string().min(1, "Objet requis").max(300),
  body: z.string().min(1, "Contenu requis").max(20000),
  templateId: z.string().uuid().nullable().default(null),
};

const messageRef = { connectionId: z.string().uuid(), messageId: z.string().uuid() };

export const PARAM_SCHEMAS = {
  "email.draft": z.object({ ...mailBase, replyToMessageId: z.string().uuid().nullable().default(null) }),
  "email.send": z.object(mailBase),
  "email.reply": z.object({ ...mailBase, replyToMessageId: z.string().uuid() }),
  "email.archive": z.object(messageRef),
  "email.label": z.object({ ...messageRef, label: z.string().min(1).max(80) }),
  "email.trash": z.object(messageRef),
  "email.untrash": z.object(messageRef),
  "email.delete_permanent": z.object(messageRef),
  "calendar.create": z.object({
    connectionId: z.string().uuid(),
    title: z.string().min(1).max(300),
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    timezone: z.string().min(1),
    attendees: z.array(address).default([]),
    location: z.string().max(300).nullable().default(null),
    description: z.string().max(5000).nullable().default(null),
    addOnlineMeeting: z.boolean().default(false),
  }),
  "calendar.update": z.object({
    connectionId: z.string().uuid(),
    eventId: z.string().uuid(),
    title: z.string().max(300).optional(),
    start: z.string().datetime({ offset: true }).optional(),
    end: z.string().datetime({ offset: true }).optional(),
    timezone: z.string().optional(),
    location: z.string().max(300).nullable().optional(),
    attendees: z.array(address).optional(),
  }),
  "calendar.cancel": z.object({ connectionId: z.string().uuid(), eventId: z.string().uuid(), notify: z.boolean().default(true) }),
  "task.create": z.object({
    title: z.string().min(1).max(300),
    notes: z.string().max(5000).nullable().default(null),
    dueAt: z.string().datetime({ offset: true }).nullable().default(null),
    sourceMessageId: z.string().uuid().nullable().default(null),
  }),
  "task.complete": z.object({ taskId: z.string().uuid() }),
} satisfies Record<ActionKind, z.ZodType>;

export type ParamsOf<K extends ActionKind> = z.infer<(typeof PARAM_SCHEMAS)[K]>;

export function parseParams(kind: ActionKind, raw: unknown): { ok: true; params: Record<string, unknown> } | { ok: false; missing: string[] } {
  const schema = PARAM_SCHEMAS[kind];
  const r = schema.safeParse(raw);
  if (r.success) return { ok: true, params: r.data as Record<string, unknown> };
  return { ok: false, missing: r.error.issues.map((i) => `${i.path.join(".") || "paramètres"} : ${i.message}`) };
}

/** Actions de préparation sans effet visible par des tiers. */
export const PREPARATION_KINDS: ActionKind[] = ["email.draft", "task.create", "task.complete"];
/** Actions réversibles de classement. */
export const REVERSIBLE_FILING_KINDS: ActionKind[] = ["email.archive", "email.label", "email.trash", "email.untrash"];
/** Actions dont l'effet chez le fournisseur ne peut pas être annulé ni rejoué sans vérification. */
export const NON_IDEMPOTENT_KINDS: ActionKind[] = ["email.send", "email.reply"];
