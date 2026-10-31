import { sql } from "@waverti/database";
import { integrationStatus } from "@waverti/config/env";
import { databaseUrl, getDb, isDatabaseConfigured } from "@/lib/db";
import { signupMode } from "@/lib/beta";
import { EXPECTED_MIGRATIONS } from "@/lib/schema-version";
import { currentBillingMode, isBillingConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** État de santé public minimal (aucun secret, aucun détail interne). */
export async function GET() {
  let database: "ok" | "unconfigured" | "error" = "unconfigured";
  // Version du schéma : nombre de migrations appliquées / attendues (aucune donnée personnelle).
  let schema: { applied: number; expected: number } | null = null;
  if (isDatabaseConfigured()) {
    try {
      await getDb().execute(sql`select 1`);
      database = "ok";
    } catch {
      database = "error";
    }
    if (database === "ok") {
      try {
        const [m] = await getDb().execute<{ n: string }>(sql`select count(*)::text as n from waverti_migrations.schema_migrations`);
        schema = { applied: Number(m?.n ?? 0), expected: EXPECTED_MIGRATIONS };
      } catch {
        // Base vide : aucune migration appliquée.
        schema = { applied: 0, expected: EXPECTED_MIGRATIONS };
      }
    }
  }
  const integrations = integrationStatus({ ...(process.env as Record<string, string>), DATABASE_URL: databaseUrl() ?? "" });
  return Response.json(
    {
      status: database === "error" || (schema && schema.applied < schema.expected) ? "degraded" : "ok",
      database,
      schema,
      integrations,
      launchStatus: process.env.NEXT_PUBLIC_LAUNCH_STATUS ?? "preview",
      signup: signupMode(),
      // Mode de facturation uniquement (jamais la clé) : absent, test, live_blocked ou live.
      billing: { mode: currentBillingMode(), available: isBillingConfigured() },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
