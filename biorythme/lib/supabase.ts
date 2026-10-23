import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// La base dédiée à Biorythme est reliée avec le préfixe « stockage » (stockage_SUPABASE_URL…).
// Les références doivent rester statiques pour que Next les intègre au code navigateur.
// Les noms sans préfixe (ancienne base partagée) ne servent que de repli.
const url = process.env.NEXT_PUBLIC_stockage_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_stockage_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_stockage_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let browserClient: SupabaseClient | null = null;

/** Client public (clé anon) : lecture du planning, temps réel. */
export function publicClient(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (typeof window === "undefined") {
    return createClient(url, anonKey, { auth: { persistSession: false } });
  }
  browserClient ??= createClient(url, anonKey, { auth: { persistSession: false } });
  return browserClient;
}
