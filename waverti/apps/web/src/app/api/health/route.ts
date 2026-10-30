import { sql } from "@waverti/database";
import { integrationStatus } from "@waverti/config/env";
import { getDb, isDatabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

/** État de santé public minimal (aucun secret, aucun détail interne). */
export async function GET() {
  let database: "ok" | "unconfigured" | "error" = "unconfigured";
  if (isDatabaseConfigured()) {
    try {
      await getDb().execute(sql`select 1`);
      database = "ok";
    } catch {
      database = "error";
    }
  }
  const integrations = integrationStatus(process.env as Record<string, string>);
  return Response.json(
    { status: database === "error" ? "degraded" : "ok", database, integrations, launchStatus: process.env.NEXT_PUBLIC_LAUNCH_STATUS ?? "preview" },
    { headers: { "cache-control": "no-store" } },
  );
}
