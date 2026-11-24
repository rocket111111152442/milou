"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/config/env";
import { PIPELINE_KEYS } from "@/config/crm";
import { getDb, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/server";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, signSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { confirmAppointment, setAppointmentStatus, SlotConflict } from "@/lib/crm/appointments";
import { deleteContact } from "@/lib/crm/queries";
import { normalizeEmail, normalizePhone } from "@/lib/crm/identity";
import { deliver } from "@/lib/notify";
import { log } from "@/lib/log";

export type ActionState = { ok?: boolean; error?: string } | null;

/* ---------------------------------------------------------------- auth */

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const ip = clientIp(await headers());
  const rl1 = rateLimit(`login-ip:${ip}`, 10, 15 * 60_000);
  const rl2 = rateLimit(`login-email:${email}`, 5, 15 * 60_000);
  if (!rl1.ok || !rl2.ok) return { error: "Demasiados intentos. Espera 15 minutos." };
  if (!email || !password) return { error: "Correo y contraseña obligatorios." };
  if (!env.auth.sessionSecret || env.auth.sessionSecret.length < 32) return { error: "SESSION_SECRET no está configurado en el servidor." };
  const db = await getDb();
  const [u] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, email));
  // Constant-ish time: always run a verification
  const ok = u ? await verifyPassword(password, u.passwordHash) : await verifyPassword(password, "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA").then(() => false);
  if (!u || !ok) {
    log.warn("admin.login_failed", {});
    return { error: "Credenciales incorrectas." };
  }
  await db.update(schema.adminUsers).set({ lastLoginAt: new Date() }).where(eq(schema.adminUsers.id, u.id));
  const token = await signSession(u.id, env.auth.sessionHours);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: env.auth.sessionHours * 3600 });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

/* ---------------------------------------------------------------- contacts */

const contactUpdate = z.object({
  id: z.coerce.number().int().positive(),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  language: z.string().trim().max(10).optional(),
  birthDate: z.string().trim().max(10).optional(),
  status: z.enum(PIPELINE_KEYS as [string, ...string[]]),
  temperature: z.enum(["caliente", "tibio", "frio"]),
  temperatureReason: z.string().trim().max(1000).optional(),
  priority: z.string().optional(),
  nextAction: z.string().trim().max(300).optional(),
  nextActionAt: z.string().trim().max(30).optional(),
  summary: z.string().trim().max(3000).optional(),
});

export async function updateContact(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const p = contactUpdate.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Revisa los campos: " + p.error.issues.map((i) => i.path.join(".")).join(", ") };
  const v = p.data;
  const email = v.email ? normalizeEmail(v.email) : null;
  const phone = v.phone ? normalizePhone(v.phone) : null;
  if (v.email && !email) return { error: "Correo no válido." };
  if (v.phone && !phone) return { error: "Teléfono no válido." };
  if (v.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(v.birthDate)) return { error: "Fecha de nacimiento no válida." };
  const db = await getDb();
  const [before] = await db.select().from(schema.contacts).where(eq(schema.contacts.id, v.id));
  if (!before) return { error: "Prospecto no encontrado." };
  const temperatureManual = before.temperatureManual || v.temperature !== before.temperature || (v.temperatureReason ?? "") !== (before.temperatureReason ?? "");
  await db
    .update(schema.contacts)
    .set({
      fullName: v.fullName,
      email,
      phone,
      country: v.country || null,
      city: v.city || null,
      language: v.language || null,
      birthDate: v.birthDate || null,
      status: v.status,
      temperature: v.temperature,
      temperatureReason: v.temperatureReason || null,
      temperatureManual,
      priority: v.priority === "on",
      nextAction: v.nextAction || null,
      nextActionAt: v.nextActionAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.nextActionAt) ? new Date(`${v.nextActionAt}:00-04:00`) : null,
      summary: v.summary || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.contacts.id, v.id));
  const changed = (["status", "temperature", "priority", "nextAction"] as const).filter((k) => String(before[k] ?? "") !== String(k === "priority" ? v.priority === "on" : (v[k] ?? "")));
  if (changed.length)
    await db.insert(schema.activities).values({ contactId: v.id, kind: "updated", actorId: admin.id, data: Object.fromEntries(changed.map((k) => [k, k === "priority" ? v.priority === "on" : v[k] ?? null])) });
  revalidatePath(`/admin/prospectos/${v.id}`);
  return { ok: true };
}

export async function addNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = Number(fd.get("contactId"));
  const body = String(fd.get("body") ?? "").trim();
  if (!id || !body) return { error: "Nota vacía." };
  if (body.length > 5000) return { error: "Nota demasiado larga." };
  const db = await getDb();
  await db.insert(schema.notes).values({ contactId: id, authorId: admin.id, body });
  await db.update(schema.contacts).set({ lastActivityAt: new Date() }).where(eq(schema.contacts.id, id));
  revalidatePath(`/admin/prospectos/${id}`);
  return { ok: true };
}

export async function removeContact(fd: FormData) {
  const admin = await requireAdmin();
  const id = Number(fd.get("contactId"));
  if (String(fd.get("confirm")) !== "ELIMINAR") redirect(`/admin/prospectos/${id}?error=confirm`);
  await deleteContact(id);
  log.info("admin.contact_deleted", { id, by: admin.id });
  redirect("/admin/prospectos?deleted=1");
}

/* ---------------------------------------------------------------- appointments */

export async function confirmVisit(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = Number(fd.get("appointmentId"));
  const start = String(fd.get("startsAt") ?? "");
  const tzOffset = String(fd.get("tzOffset") ?? "-04:00"); // Dominican Republic (no DST)
  const duration = Number(fd.get("duration") ?? 60);
  const meetingUrl = String(fd.get("meetingUrl") ?? "").trim() || null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)) return { error: "Fecha y hora obligatorias." };
  try {
    const r = await confirmAppointment(id, new Date(`${start}:00${tzOffset}`), duration, meetingUrl, admin.id);
    revalidatePath(`/admin/prospectos/${r.contactId}`);
    revalidatePath("/admin/citas");
    return { ok: true };
  } catch (e) {
    if (e instanceof SlotConflict) return { error: e.conflictId > 0 ? `Ese horario se solapa con otra visita confirmada (#${e.conflictId}).` : "El calendario indica que ese horario no está libre." };
    return { error: (e as Error).message === "invalid_meeting_url" ? "El enlace de videollamada debe empezar por https://" : "No se pudo confirmar la visita." };
  }
}

export async function changeVisitStatus(fd: FormData) {
  const admin = await requireAdmin();
  const id = Number(fd.get("appointmentId"));
  const status = String(fd.get("status")) as "cancelada" | "realizada" | "no_asistio" | "solicitada";
  if (!["cancelada", "realizada", "no_asistio", "solicitada"].includes(status)) return;
  const r = await setAppointmentStatus(id, status, String(fd.get("outcome") ?? "").trim() || null, admin.id);
  revalidatePath(`/admin/prospectos/${r.contactId}`);
  revalidatePath("/admin/citas");
}

/* ---------------------------------------------------------------- notifications */

export async function retryNotification(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const db = await getDb();
  await db.update(schema.notifications).set({ status: "pending" }).where(eq(schema.notifications.id, id));
  await deliver(id);
  revalidatePath("/admin/notificaciones");
}

/* ---------------------------------------------------------------- account */

export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const rl = rateLimit(`pw-change:${admin.id}`, 5, 15 * 60_000);
  if (!rl.ok) return { error: "Demasiados intentos. Espera 15 minutos." };
  if (next.length < 12) return { error: "La nueva contraseña debe tener al menos 12 caracteres." };
  if (next !== confirm) return { error: "Las dos contraseñas nuevas no coinciden." };
  if (next === current) return { error: "La nueva contraseña debe ser distinta de la actual." };
  const db = await getDb();
  const [u] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.id, admin.id));
  if (!u || !(await verifyPassword(current, u.passwordHash))) return { error: "La contraseña actual no es correcta." };
  const { hashPassword } = await import("@/lib/auth/password");
  await db.update(schema.adminUsers).set({ passwordHash: await hashPassword(next) }).where(eq(schema.adminUsers.id, admin.id));
  log.info("admin.password_changed", {});
  return { ok: true };
}
