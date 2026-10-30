import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Client « service role » — serveur uniquement (suppression de compte). Jamais exposé au navigateur. */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY n'est pas configurée");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
