import "server-only";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getCalendar } from "@/lib/calendar";

export class SlotConflict extends Error {
  constructor(readonly conflictId: number) {
    super("slot_conflict");
  }
}

/** Confirms a requested visit at a precise time, refusing overlaps with other confirmed visits. */
export async function confirmAppointment(id: number, startsAt: Date, durationMin: number, meetingUrl: string | null, actorId: number) {
  if (!(durationMin >= 15 && durationMin <= 480)) throw new Error("invalid_duration");
  if (Number.isNaN(startsAt.getTime())) throw new Error("invalid_date");
  if (meetingUrl && !/^https:\/\/\S+$/.test(meetingUrl)) throw new Error("invalid_meeting_url");
  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [ap] = await tx.select().from(schema.appointments).where(eq(schema.appointments.id, id));
    if (!ap) throw new Error("not_found");
    const overlap = await tx
      .select({ id: schema.appointments.id })
      .from(schema.appointments)
      .where(and(eq(schema.appointments.status, "confirmada"), ne(schema.appointments.id, id), lt(schema.appointments.startsAt, endsAt), gt(schema.appointments.endsAt, startsAt)));
    if (overlap.length) throw new SlotConflict(overlap[0].id);
    const cal = getCalendar();
    if (cal.connected && !(await cal.isFree(startsAt, endsAt))) throw new SlotConflict(-1);
    await tx
      .update(schema.appointments)
      .set({ status: "confirmada", startsAt, endsAt, meetingUrl: ap.type === "virtual" ? meetingUrl : null, updatedAt: new Date() })
      .where(eq(schema.appointments.id, id));
    await tx.update(schema.contacts).set({ status: "visita_programada", updatedAt: new Date(), lastActivityAt: new Date() }).where(eq(schema.contacts.id, ap.contactId));
    await tx.insert(schema.activities).values({ contactId: ap.contactId, kind: "visit_confirmed", actorId, data: { appointmentId: id, startsAt: startsAt.toISOString() } });
    return { contactId: ap.contactId };
  });
}

export async function setAppointmentStatus(id: number, status: "cancelada" | "realizada" | "no_asistio" | "solicitada", outcome: string | null, actorId: number) {
  const db = await getDb();
  const [ap] = await db.select().from(schema.appointments).where(eq(schema.appointments.id, id));
  if (!ap) throw new Error("not_found");
  await db.update(schema.appointments).set({ status, outcome: outcome ?? ap.outcome, updatedAt: new Date() }).where(eq(schema.appointments.id, id));
  await db.insert(schema.activities).values({ contactId: ap.contactId, kind: `visit_${status}`, actorId, data: { appointmentId: id, outcome } });
  return { contactId: ap.contactId };
}
