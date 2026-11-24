import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { leadInput } from "@/lib/crm/lead-input";
import { createLead, mergeCriteria } from "@/lib/crm/leads";
import { normalizeEmail, normalizePhone } from "@/lib/crm/identity";
import { qualify, timelineMonths, budgetInUsd } from "@/lib/crm/qualification";
import { confirmAppointment, SlotConflict } from "@/lib/crm/appointments";
import { purgeExpired } from "@/lib/crm/retention";
import { notify } from "@/lib/notify";

const lead = (over: Record<string, unknown> = {}) => leadInput.parse({ kind: "contact", fullName: "Ana Pérez", email: "Ana@Example.com", phone: "809-555-1234", language: "es", criteria: { intent: "buy" }, consent: true, ...over });

describe("identity", () => {
  it("normalises emails and phones", () => {
    expect(normalizeEmail(" Ana@Example.COM ")).toBe("ana@example.com");
    expect(normalizeEmail("nope")).toBeNull();
    expect(normalizePhone("809-555-1234")).toBe("+18095551234");
    expect(normalizePhone("+1 (809) 555 1234")).toBe("+18095551234");
    expect(normalizePhone("0034 612 345 678")).toBe("+34612345678");
    expect(normalizePhone("123")).toBeNull();
  });
  it("requires consent and at least one valid contact method", () => {
    expect(leadInput.safeParse({ kind: "contact", fullName: "X Y", consent: true }).success).toBe(false);
    expect(leadInput.safeParse({ kind: "contact", fullName: "X Y", email: "x@y.com" }).success).toBe(false);
    expect(leadInput.safeParse({ kind: "visit", fullName: "X Y", email: "x@y.com", consent: true }).success).toBe(false);
  });
});

describe("qualification", () => {
  it("parses timelines", () => {
    expect(timelineMonths("en 2 meses")).toBe(2);
    expect(timelineMonths("next year")).toBe(12);
    expect(timelineMonths("inmediato")).toBe(0);
    expect(timelineMonths("solo mirando")).toBe(24);
  });
  it("scores hot / warm / cold with explicit reasons", () => {
    const hot = qualify({ criteria: { intent: "buy", propertyTypes: ["villa"], zones: ["Cabrera"], budgetMax: 300000, paymentMethod: "contado", timeline: "en 2 meses" }, actionRequested: true, specificProperty: true, budgetUsd: 300000, priorityThresholdUsd: 150000 });
    expect(hot.temperature).toBe("caliente");
    expect(hot.priority).toBe(true);
    expect(hot.reasons.join(" ")).toContain("Plazo corto");
    const cold = qualify({ criteria: { intent: "buy" }, actionRequested: false, specificProperty: false, budgetUsd: null, priorityThresholdUsd: 150000 });
    expect(cold.temperature).toBe("frio");
    expect(cold.priority).toBe(false);
  });
  it("does not convert DOP budgets without a configured rate", () => {
    expect(budgetInUsd({ budgetMax: 10_000_000, currency: "DOP" }, null)).toBeNull();
    expect(budgetInUsd({ budgetMax: 10_000_000, currency: "DOP" }, 60)).toBeCloseTo(166666.67, 1);
  });
  it("merges criteria without erasing with empty values", () => {
    expect(mergeCriteria({ zones: ["Cabrera"], budgetMax: 100 }, { zones: [], budgetMax: 200, timeline: null })).toEqual({ zones: ["Cabrera"], budgetMax: 200 });
  });
});

describe("leads, de-duplication and history", () => {
  it("creates a contact, then reuses it by email or phone without overwriting history", async () => {
    const a = await createLead(lead({ message: "Busco solar" }));
    expect(a.existingContact).toBe(false);
    const b = await createLead(lead({ email: "ana@example.com", phone: null, fullName: "Ana P.", country: "España", criteria: { intent: "buy", zones: ["Cabrera"] } }));
    expect(b.contactId).toBe(a.contactId);
    expect(b.existingContact).toBe(true);
    const c = await createLead(lead({ email: null, phone: "+1 809 555 1234", criteria: { intent: "buy", budgetMax: 120000 } }));
    expect(c.contactId).toBe(a.contactId);
    const db = await getDb();
    const [row] = await db.select().from(schema.contacts).where(eq(schema.contacts.id, a.contactId));
    expect(row.fullName).toBe("Ana Pérez"); // name not overwritten
    expect(row.country).toBe("España"); // blank field filled
    expect(row.criteria).toMatchObject({ zones: ["Cabrera"], budgetMax: 120000 });
    const inq = await db.select().from(schema.inquiries).where(eq(schema.inquiries.contactId, a.contactId));
    expect(inq).toHaveLength(3);
  });
  it("never merges two people on the name alone", async () => {
    const a = await createLead(lead({ fullName: "Juan Rodríguez", email: "juan1@example.com", phone: null }));
    const b = await createLead(lead({ fullName: "Juan Rodríguez", email: "juan2@example.com", phone: null }));
    expect(a.contactId).not.toBe(b.contactId);
  });
  it("records a visit request as pending, and notifications in test mode exactly once", async () => {
    const r = await createLead(lead({ kind: "visit", email: "visit@example.com", phone: null, property: { slug: "villa-x-1", ref: "1", title: "Villa X" }, visit: { type: "virtual", timezone: "Europe/Madrid", slots: ["2026-12-01T10:00"] } }));
    expect(r.appointmentId).not.toBeNull();
    const db = await getDb();
    const [ap] = await db.select().from(schema.appointments).where(eq(schema.appointments.id, r.appointmentId!));
    expect(ap.status).toBe("solicitada");
    expect(ap.startsAt).toBeNull();
    expect(r.notifications.every((n) => n.status === "test")).toBe(true);
    expect(r.notifications.map((n) => n.channel)).toContain("email");
    const again = await notify({ event: "visit.requested", entityId: String(r.inquiryId), contactId: r.contactId, subject: "x", text: "y" });
    expect(again).toHaveLength(0); // idempotency key prevents duplicates
  });
  it("prevents double booking when confirming visits", async () => {
    const one = await createLead(lead({ kind: "visit", email: "v1@example.com", phone: null, visit: { type: "physical", timezone: "America/Santo_Domingo", slots: ["mañana"] } }));
    const two = await createLead(lead({ kind: "visit", email: "v2@example.com", phone: null, visit: { type: "physical", timezone: "America/Santo_Domingo", slots: ["mañana"] } }));
    await confirmAppointment(one.appointmentId!, new Date("2026-12-02T14:00:00-04:00"), 60, null, 1);
    await expect(confirmAppointment(two.appointmentId!, new Date("2026-12-02T14:30:00-04:00"), 60, null, 1)).rejects.toBeInstanceOf(SlotConflict);
    await expect(confirmAppointment(two.appointmentId!, new Date("2026-12-02T15:00:00-04:00"), 60, null, 1)).resolves.toBeTruthy();
    await expect(confirmAppointment(two.appointmentId!, new Date("2026-12-02T16:00:00-04:00"), 60, "javascript:alert(1)", 1)).rejects.toThrow();
  });
  it("purges expired conversations", async () => {
    const db = await getDb();
    const old = "11111111-1111-4111-8111-111111111111";
    await db.insert(schema.chatSessions).values({ id: old, lang: "es", updatedAt: new Date("2020-01-01") });
    const r = await purgeExpired();
    expect(r.chatSessions).toBeGreaterThanOrEqual(1);
    expect(await db.select().from(schema.chatSessions).where(eq(schema.chatSessions.id, old))).toHaveLength(0);
  });
});
