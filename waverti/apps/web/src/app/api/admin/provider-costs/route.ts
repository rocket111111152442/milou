import { z } from "zod";
import { providerMonthlyCosts, sql } from "@waverti/database";
import { apiError, json, readJson } from "@/lib/api";
import { withAdmin } from "@/lib/admin";
import { audit } from "@/lib/data/admin";
import { getDb } from "@/lib/db";

const schema = z.object({
  provider: z.enum(["brave_search", "resend", "smtp", "vercel", "server", "other"]),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mois au format AAAA-MM"),
  amountEur: z.number().min(0).max(100_000),
  note: z.string().trim().max(500).optional(),
});

/** Saisie du coût réel d'un fournisseur pour un mois (d'après sa facture), tracée dans le journal d'audit. */
export const POST = withAdmin(async (req, admin) => {
  const body = await readJson(req, schema);
  if (!body.ok) return body.res;
  const { provider, month, amountEur, note } = body.data;
  const micros = Math.round(amountEur * 1_000_000);
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx
      .insert(providerMonthlyCosts)
      .values({ provider, month, actualCostMicros: micros, note: note || null, recordedBy: admin.userId })
      .onConflictDoUpdate({
        target: [providerMonthlyCosts.provider, providerMonthlyCosts.month],
        set: { actualCostMicros: micros, note: note || null, recordedBy: admin.userId, recordedAt: sql`now()` },
      });
    await audit(tx, { adminId: admin.userId, action: "cost.actual_recorded", targetType: "provider", targetId: `${provider}:${month}`, metadata: { amountEur } });
    return json({ ok: true });
  });
});

export const GET = () => apiError(404, "not_found");
