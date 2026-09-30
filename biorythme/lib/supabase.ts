import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let browserClient: SupabaseClient | null = null;

/** Client public (clé anon) : lecture du planning, réservation, temps réel. */
export function publicClient(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (typeof window === "undefined") {
    return createClient(url, anonKey, { auth: { persistSession: false } });
  }
  browserClient ??= createClient(url, anonKey, { auth: { persistSession: false } });
  return browserClient;
}
