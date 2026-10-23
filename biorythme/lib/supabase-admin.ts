import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Clé secrète serveur (préfixe « stockage » de la base dédiée en priorité). */
export function serverSecretKey(): string | undefined {
  return (
    process.env.stockage_SUPABASE_SECRET_KEY ||
    process.env.stockage_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** Client service-role : réservé aux actions de l'espace gérante, jamais envoyé au navigateur. */
export function adminClient() {
  const url =
    process.env.stockage_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_stockage_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key = serverSecretKey();
  if (!url || !key) throw new Error("Supabase n'est pas relié au projet.");
  return createClient(url, key, { auth: { persistSession: false } });
}
