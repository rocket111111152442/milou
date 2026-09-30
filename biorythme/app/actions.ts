"use server";

import { publicClient } from "@/lib/supabase";

const MESSAGES: Record<string, string> = {
  INVALID_INPUT: "Merci d'indiquer votre nom et un email valide.",
  NOT_FOUND: "Ce cours n'existe plus.",
  CANCELLED: "Ce cours a été annulé.",
  PAST: "Ce cours a déjà commencé.",
  FULL: "Trop tard, le cours vient d'être complet !",
  ALREADY_BOOKED: "Vous êtes déjà inscrit(e) à ce cours avec cet email.",
};

export type BookResult = { ok: true; token: string } | { ok: false; error: string };

export async function bookSession(input: {
  sessionId: string;
  name: string;
  email: string;
  phone: string;
}): Promise<BookResult> {
  const client = publicClient();
  if (!client) return { ok: false, error: "La réservation n'est pas encore activée." };

  const name = input.name.trim().slice(0, 80);
  const email = input.email.trim().toLowerCase().slice(0, 120);
  const phone = input.phone.trim().slice(0, 30);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: MESSAGES.INVALID_INPUT };

  const { data, error } = await client.rpc("bio_book", {
    p_session: input.sessionId,
    p_name: name,
    p_email: email,
    p_phone: phone,
  });
  if (error) {
    const code = Object.keys(MESSAGES).find((k) => error.message.includes(k));
    return { ok: false, error: code ? MESSAGES[code] : "Une erreur est survenue, réessayez." };
  }
  return { ok: true, token: data as string };
}

export async function cancelBooking(token: string): Promise<boolean> {
  const client = publicClient();
  if (!client || !/^[0-9a-f-]{36}$/i.test(token)) return false;
  const { data, error } = await client.rpc("bio_cancel", { p_token: token });
  return !error && data === true;
}
