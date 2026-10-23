import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Client service-role : réservé aux actions de l'espace gérante, jamais envoyé au navigateur. */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  // Nouvelle clé secrète (sb_secret_…) en priorité, l'ancienne clé JWT service_role en secours.
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase n'est pas relié au projet.");
  return createClient(url, key, { auth: { persistSession: false } });
}
