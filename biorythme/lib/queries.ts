import type { SupabaseClient } from "@supabase/supabase-js";
import { SESSION_SELECT, type SessionFull } from "./types";

export async function fetchPublicSessions(client: SupabaseClient, fromIso: string, toIso: string) {
  const { data, error } = await client
    .from("bio_sessions")
    .select(SESSION_SELECT)
    .eq("published", true)
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso)
    .order("starts_at");
  if (error) throw error;
  return (data ?? []) as SessionFull[];
}
