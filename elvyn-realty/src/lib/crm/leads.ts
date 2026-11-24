import "server-only";
import { eq, or } from "drizzle-orm";
import { env } from "@/config/env";
import { INTENT_LABELS, temperatureLabel } from "@/config/crm";
import { getDb, schema } from "@/lib/db";
import type { Criteria } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { notify, type NotifyEvent } from "@/lib/notify";
import type { LeadInput } from "./lead-input";
import { budgetInUsd, qualify } from "./qualification";

const ACTION_REASONS = new Set(["visit", "reserve_offer_payment", "negotiation", "human_request", "existing_client", "seller_listing"]);

export interface LeadResult {
  contactId: number;
  inquiryId: number;
  appointmentId: number | null;
  existingContact: boolean;
  temperature: string;
  notifications: { channel: string; status: string }[];
}

/** Merge: new non-empty values win (they are the latest request); empty values never erase. */
export function mergeCriteria(prev: Criteria, next: Criteria): Criteria {
  const out: Criteria = { ...prev };
  for (const [k, v] of Object.entries(next) as [keyof Criteria, unknown][]) {
    if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function summaryLine(input: LeadInput, temperature: string): string {
  const c = input.criteria;
  const money = (n?: number | null) => (n ? `${c.currency ?? "USD"} ${n.toLocaleString("en-US")}` : null);
  const budget = c.intent === "sell" ? money(c.expectedPrice) : [money(c.budgetMin), money(c.budgetMax)].filter(Boolean).join(" – ");
  // Format requested in the knowledge base, section 3.
  return [
    input.fullName,
    input.phone ?? input.email ?? "",
    input.country ?? "País no indicado",
    INTENT_LABELS[c.intent ?? "other"] ?? "Consulta",
    [c.propertyTypes?.join("/"), c.zones?.join("/")].filter(Boolean).join(" en ") || "Tipo/zona no indicados",
    budget || "Presupuesto no indicado",
    c.paymentMethod ?? "Pago no indicado",
    c.timeline ?? "Plazo no indicado",
    input.property ? `${input.property.title ?? input.property.slug}${input.property.ref ? ` (Ref. ${input.property.ref})` : ""}` : "Sin propiedad concreta",
    `Nivel: ${temperatureLabel(temperature).toLowerCase()}`,
    input.kind === "visit" ? "Próximo paso: confirmar visita" : "Próximo paso: contactar",
  ].join(" · ");
}

export async function createLead(input: LeadInput, opts: { chatSessionId?: string | null } = {}): Promise<LeadResult> {
  const db = await getDb();
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const conds = [input.email ? eq(schema.contacts.email, input.email) : undefined, input.phone ? eq(schema.contacts.phone, input.phone) : undefined].filter(Boolean);
    const matches = conds.length ? await tx.select().from(schema.contacts).where(or(...(conds as never[]))) : [];
    const byEmail = matches.find((m) => input.email && m.email === input.email);
    const byPhone = matches.find((m) => input.phone && m.phone === input.phone);
    const existing = byEmail ?? byPhone ?? null;

    const criteria = mergeCriteria(existing?.criteria ?? {}, input.criteria);
    const q = qualify({
      criteria,
      actionRequested: input.kind === "visit" || input.kind === "sell" || (input.reason ? ACTION_REASONS.has(input.reason) : false),
      specificProperty: Boolean(input.property),
      budgetUsd: budgetInUsd(criteria, env.crm.usdDopRate),
      priorityThresholdUsd: env.crm.priorityBudgetUsd,
    });
    const temperatureReason = `${q.reasons.join(" · ")} (puntuación ${q.score})`;

    let contactId: number;
    if (existing) {
      contactId = existing.id;
      await tx
        .update(schema.contacts)
        .set({
          fullName: existing.fullName || input.fullName,
          email: existing.email ?? input.email,
          phone: existing.phone ?? input.phone,
          country: existing.country ?? input.country,
          city: existing.city ?? input.city,
          language: existing.language ?? input.language,
          howFound: existing.howFound ?? input.howFound,
          criteria,
          ...(existing.temperatureManual ? {} : { temperature: q.temperature, temperatureReason }),
          priority: existing.priority || q.priority,
          priorityReason: existing.priorityReason ?? q.priorityReason,
          consentAt: now,
          lastActivityAt: now,
          updatedAt: now,
        })
        .where(eq(schema.contacts.id, contactId));
      const changed = (["fullName", "country", "city"] as const).filter((k) => input[k] && existing[k] && input[k] !== existing[k]);
      if (changed.length)
        await tx.insert(schema.activities).values({ contactId, kind: "data_differs", data: Object.fromEntries(changed.map((k) => [k, input[k]])) });
      if (byEmail && byPhone && byEmail.id !== byPhone.id)
        await tx.insert(schema.activities).values({ contactId, kind: "possible_duplicate", data: { otherContactId: byPhone.id } });
    } else {
      const [row] = await tx
        .insert(schema.contacts)
        .values({
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          country: input.country,
          city: input.city,
          language: input.language,
          howFound: input.howFound,
          source: input.kind === "chat_handoff" ? "chat" : input.kind === "sell" ? "sell_form" : input.kind === "visit" ? "visit_form" : "web_form",
          criteria,
          temperature: q.temperature,
          temperatureReason,
          priority: q.priority,
          priorityReason: q.priorityReason,
          consentAt: now,
          nextAction: "Contactar",
          nextActionAt: now,
        })
        .returning({ id: schema.contacts.id });
      contactId = row.id;
      await tx.insert(schema.activities).values({ contactId, kind: "created", data: { source: input.kind } });
    }

    const summary = input.summary ?? summaryLine(input, existing?.temperatureManual ? existing.temperature : q.temperature);
    const [inq] = await tx
      .insert(schema.inquiries)
      .values({
        contactId,
        kind: input.kind,
        channel: input.kind === "chat_handoff" || opts.chatSessionId ? "chat" : "web_form",
        reason: input.reason,
        propertySlug: input.property?.slug ?? null,
        propertyRef: input.property?.ref ?? null,
        propertyTitle: input.property?.title ?? null,
        message: input.message,
        summary,
        criteria: input.criteria,
        chatSessionId: opts.chatSessionId ?? null,
      })
      .returning({ id: schema.inquiries.id });
    await tx.update(schema.contacts).set({ summary }).where(eq(schema.contacts.id, contactId));
    await tx.insert(schema.activities).values({ contactId, kind: "inquiry", data: { inquiryId: inq.id, kind: input.kind } });

    let appointmentId: number | null = null;
    if (input.visit) {
      // No calendar connected: the request stays "solicitada" (pending confirmation by Elvyn).
      const [ap] = await tx
        .insert(schema.appointments)
        .values({
          contactId,
          inquiryId: inq.id,
          propertySlug: input.property?.slug ?? null,
          propertyRef: input.property?.ref ?? null,
          propertyTitle: input.property?.title ?? null,
          type: input.visit.type,
          timezone: input.visit.timezone,
          preferredSlots: input.visit.slots,
          status: "solicitada",
        })
        .returning({ id: schema.appointments.id });
      appointmentId = ap.id;
      await tx.insert(schema.activities).values({ contactId, kind: "visit_requested", data: { appointmentId } });
    }
    if (opts.chatSessionId) await tx.update(schema.chatSessions).set({ contactId }).where(eq(schema.chatSessions.id, opts.chatSessionId));

    const temperature = existing?.temperatureManual ? existing.temperature : q.temperature;
    return { contactId, inquiryId: inq.id, appointmentId, existingContact: Boolean(existing), temperature, priority: q.priority || Boolean(existing?.priority), summary };
  });

  // Notifications after commit; failures are recorded, never thrown.
  const events: NotifyEvent[] = ["lead.created"];
  if (result.temperature === "caliente" || result.priority) events.push("lead.hot");
  if (result.appointmentId) events.push("visit.requested");
  if (input.kind === "chat_handoff") events.push("handoff.requested");
  const link = `${env.siteUrl}/admin/prospectos/${result.contactId}`;
  const notifications: { channel: string; status: string }[] = [];
  for (const event of events) {
    try {
      const subjectPrefix = { "lead.created": "Nuevo prospecto", "lead.hot": "Prospecto prioritario", "visit.requested": "Solicitud de visita", "handoff.requested": "Transferencia del asistente" }[event];
      const r = await notify({
        event,
        entityId: String(result.inquiryId),
        contactId: result.contactId,
        subject: `${subjectPrefix}: ${input.fullName}`,
        text: `${result.summary}\n\nFicha en el CRM: ${link}`,
        whatsappParams: [input.fullName, result.summary.slice(0, 500), link],
      });
      notifications.push(...r.map((x) => ({ channel: x.channel, status: x.status })));
    } catch (err) {
      log.error("lead.notify_error", { event, inquiryId: result.inquiryId, reason: (err as Error).message });
    }
  }
  log.info("lead.created", { contactId: result.contactId, inquiryId: result.inquiryId, existing: result.existingContact });
  return { contactId: result.contactId, inquiryId: result.inquiryId, appointmentId: result.appointmentId, existingContact: result.existingContact, temperature: result.temperature, notifications };
}
