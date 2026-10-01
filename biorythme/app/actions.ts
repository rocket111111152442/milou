"use server";

import { revalidatePath } from "next/cache";
import { currentMember, endSession, hashPassword, startSession, verifyPassword, type Member } from "@/lib/member-auth";
import { adminClient } from "@/lib/supabase-admin";

const BOOK_ERRORS: Record<string, string> = {
  INVALID_INPUT: "Compte introuvable, reconnectez-vous.",
  NOT_FOUND: "Ce cours n'existe plus.",
  CANCELLED: "Ce cours a été annulé.",
  PAST: "Ce cours a déjà commencé.",
  FULL: "Trop tard, le cours vient d'être complet !",
  ALREADY_BOOKED: "Vous êtes déjà inscrit(e) à ce cours.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEMBER_FIELDS = "id, email, first_name, last_name, phone";

export type AuthResult = { ok: true; member: Member } | { ok: false; error: string };

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/* ---------- Comptes ---------- */

export async function signUp(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}): Promise<AuthResult> {
  const firstName = clean(input.firstName, 60);
  const lastName = clean(input.lastName, 60);
  const email = clean(input.email, 120).toLowerCase();
  const phone = clean(input.phone, 30);
  const password = String(input.password ?? "");

  if (!firstName || !lastName) return { ok: false, error: "Merci d'indiquer votre prénom et votre nom." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Adresse email invalide." };
  if (password.length < 8) return { ok: false, error: "Le mot de passe doit faire au moins 8 caractères." };
  if (password.length > 200) return { ok: false, error: "Mot de passe trop long." };

  const db = adminClient();
  const { data, error } = await db
    .from("bio_members")
    .insert({ email, first_name: firstName, last_name: lastName, phone, password_hash: await hashPassword(password) })
    .select(MEMBER_FIELDS)
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Un compte existe déjà avec cet email. Connectez-vous." };
    return { ok: false, error: "Impossible de créer le compte, réessayez." };
  }
  await startSession(data.id);
  return { ok: true, member: data as Member };
}

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  const email = clean(input.email, 120).toLowerCase();
  const password = String(input.password ?? "");
  const fail: AuthResult = { ok: false, error: "Email ou mot de passe incorrect." };
  if (!email || !password) return fail;

  const { data } = await adminClient()
    .from("bio_members")
    .select(`${MEMBER_FIELDS}, password_hash`)
    .eq("email", email)
    .maybeSingle();
  if (!data || !(await verifyPassword(password, data.password_hash))) {
    // Petit délai pour ralentir les essais en rafale.
    await new Promise((r) => setTimeout(r, 400));
    return fail;
  }
  await startSession(data.id);
  const { password_hash: _h, ...member } = data;
  void _h;
  return { ok: true, member: member as Member };
}

export async function signOut() {
  await endSession();
  revalidatePath("/", "layout");
}

export async function updateProfile(input: { firstName: string; lastName: string; phone: string }) {
  const me = await currentMember();
  if (!me) return { ok: false as const, error: "Session expirée, reconnectez-vous." };
  const first_name = clean(input.firstName, 60);
  const last_name = clean(input.lastName, 60);
  if (!first_name || !last_name) return { ok: false as const, error: "Prénom et nom obligatoires." };
  const { error } = await adminClient()
    .from("bio_members")
    .update({ first_name, last_name, phone: clean(input.phone, 30) })
    .eq("id", me.id);
  revalidatePath("/", "layout");
  return error ? { ok: false as const, error: "Enregistrement impossible." } : { ok: true as const };
}

export async function changePassword(input: { current: string; next: string }) {
  const me = await currentMember();
  if (!me) return { ok: false as const, error: "Session expirée, reconnectez-vous." };
  if (String(input.next ?? "").length < 8) return { ok: false as const, error: "8 caractères minimum." };
  const db = adminClient();
  const { data } = await db.from("bio_members").select("password_hash").eq("id", me.id).single();
  if (!data || !(await verifyPassword(String(input.current ?? ""), data.password_hash))) {
    return { ok: false as const, error: "Mot de passe actuel incorrect." };
  }
  const { error } = await db.from("bio_members").update({ password_hash: await hashPassword(input.next) }).eq("id", me.id);
  return error ? { ok: false as const, error: "Enregistrement impossible." } : { ok: true as const };
}

/* ---------- Réservations ---------- */

export type BookResult = { ok: true } | { ok: false; error: string; needLogin?: boolean };

export async function bookSession(sessionId: string): Promise<BookResult> {
  const me = await currentMember();
  if (!me) return { ok: false, error: "Connectez-vous pour réserver.", needLogin: true };
  const { error } = await adminClient().rpc("bio_book_member", { p_session: sessionId, p_member: me.id });
  if (error) {
    const code = Object.keys(BOOK_ERRORS).find((k) => error.message.includes(k));
    return { ok: false, error: code ? BOOK_ERRORS[code] : "Une erreur est survenue, réessayez." };
  }
  revalidatePath("/compte");
  return { ok: true };
}

export async function cancelMyBooking(bookingId: string): Promise<boolean> {
  const me = await currentMember();
  if (!me) return false;
  const db = adminClient();
  const { data } = await db
    .from("bio_bookings")
    .select("cancel_token")
    .eq("id", bookingId)
    .eq("member_id", me.id)
    .eq("status", "confirmed")
    .maybeSingle();
  if (!data) return false;
  const { data: ok, error } = await db.rpc("bio_cancel", { p_token: data.cancel_token });
  revalidatePath("/compte");
  return !error && ok === true;
}

/** Séances réservées par le membre connecté (pour marquer « Réservé » dans le planning). */
export async function myBookedSessionIds(): Promise<string[]> {
  const me = await currentMember();
  if (!me) return [];
  const { data } = await adminClient()
    .from("bio_bookings")
    .select("session_id")
    .eq("member_id", me.id)
    .eq("status", "confirmed");
  return (data ?? []).map((b) => b.session_id as string);
}
