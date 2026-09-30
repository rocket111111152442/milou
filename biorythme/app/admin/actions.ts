"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin, signIn, signOut } from "@/lib/admin-auth";
import { adminClient } from "@/lib/supabase-admin";
import { addDays, parisToIso } from "@/lib/format";

export type ActionResult = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/planning");
}

function fail(error: { message: string } | null): ActionResult {
  if (!error) return { ok: true };
  if (error.message.includes("bio_sessions_not_overbooked")) {
    return { ok: false, error: "La capacité ne peut pas être inférieure au nombre d'inscrits." };
  }
  return { ok: false, error: error.message };
}

export async function loginAction(_: unknown, form: FormData): Promise<{ error: string } | undefined> {
  const ok = await signIn(String(form.get("password") ?? ""));
  if (!ok) return { error: "Mot de passe incorrect." };
  redirect("/admin");
}

export async function logoutAction() {
  await signOut();
  redirect("/admin");
}

/* ---------- Séances ---------- */

export async function createSession(input: {
  course_id: string;
  room_id: string;
  coach_id: string | null;
  date: string;
  time: string;
  duration_min: number;
  capacity: number;
  repeat_weeks: number;
  published: boolean;
}): Promise<ActionResult> {
  await assertAdmin();
  const weeks = Math.min(Math.max(1, Math.floor(input.repeat_weeks || 1)), 26);
  const rows = Array.from({ length: weeks }, (_, i) => ({
    course_id: input.course_id,
    room_id: input.room_id,
    coach_id: input.coach_id || null,
    starts_at: parisToIso(addDays(input.date, i * 7), input.time),
    duration_min: input.duration_min,
    capacity: input.capacity,
    published: input.published,
  }));
  const { error } = await adminClient().from("bio_sessions").insert(rows);
  refresh();
  return fail(error);
}

export async function updateSession(
  id: string,
  patch: Partial<{
    course_id: string;
    room_id: string;
    coach_id: string | null;
    date: string;
    time: string;
    duration_min: number;
    capacity: number;
    published: boolean;
    cancelled: boolean;
  }>,
): Promise<ActionResult> {
  await assertAdmin();
  const { date, time, ...rest } = patch;
  const row: Record<string, unknown> = { ...rest };
  if (date && time) row.starts_at = parisToIso(date, time);
  if ("coach_id" in row && !row.coach_id) row.coach_id = null;
  const { error } = await adminClient().from("bio_sessions").update(row).eq("id", id);
  refresh();
  return fail(error);
}

export async function deleteSession(id: string): Promise<ActionResult> {
  await assertAdmin();
  const { error } = await adminClient().from("bio_sessions").delete().eq("id", id);
  refresh();
  return fail(error);
}

/** Copie toutes les séances d'une semaine (lundi → dimanche) sur la semaine suivante. */
export async function duplicateWeek(monday: string): Promise<ActionResult & { count?: number }> {
  await assertAdmin();
  const db = adminClient();
  const from = parisToIso(monday, "00:00");
  const to = parisToIso(addDays(monday, 7), "00:00");
  const { data, error } = await db
    .from("bio_sessions")
    .select("course_id, room_id, coach_id, starts_at, duration_min, capacity, published")
    .gte("starts_at", from)
    .lt("starts_at", to)
    .eq("cancelled", false);
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Aucune séance à copier cette semaine." };
  const rows = data.map((s) => ({
    ...s,
    starts_at: new Date(new Date(s.starts_at).getTime() + 7 * 86_400_000).toISOString(),
  }));
  const ins = await db.from("bio_sessions").insert(rows);
  refresh();
  return ins.error ? fail(ins.error) : { ok: true, count: rows.length };
}

export async function removeBooking(bookingId: string): Promise<ActionResult> {
  await assertAdmin();
  const db = adminClient();
  const { data, error } = await db.from("bio_bookings").select("cancel_token").eq("id", bookingId).single();
  if (error) return fail(error);
  const res = await db.rpc("bio_cancel", { p_token: data.cancel_token });
  refresh();
  return fail(res.error);
}

/* ---------- Référentiels : salles, cours, coachs ---------- */

type Table = "bio_rooms" | "bio_courses" | "bio_coaches";

export async function saveItem(table: Table, item: Record<string, unknown>): Promise<ActionResult> {
  await assertAdmin();
  const db = adminClient();
  const { id, ...fields } = item;
  const { error } = id
    ? await db.from(table).update(fields).eq("id", id as string)
    : await db.from(table).insert(fields);
  refresh();
  return fail(error);
}

export async function deleteItem(table: Table, id: string): Promise<ActionResult> {
  await assertAdmin();
  const { error } = await adminClient().from(table).delete().eq("id", id);
  refresh();
  return fail(error);
}
