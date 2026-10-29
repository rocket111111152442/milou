import { isUuid } from "@watchly/database";
import { apiError, withActor } from "@/lib/api";
import { loadEntitlements } from "@/lib/data/account";
import { getMonitorDetail, toResultView } from "@/lib/data/monitors";

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  // Neutralise l'injection de formules dans les tableurs.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** Export CSV de l'historique d'une surveillance (formules avec exports). */
export const GET = withActor(async (_req, actor, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "not_found");
  const ent = await loadEntitlements(actor.userId);
  if (!ent.dataExports) return apiError(403, "not_included", "L'export est inclus dans les formules Pro et Business.");
  const d = await getMonitorDetail(actor.userId, id!);
  if (!d) return apiError(404, "not_found");
  const lines = [["date", "resultat", "valeur", "resume", "executant", "source"].join(";")];
  for (const r of d.results.map((x) => toResultView(x, d.task.condition))) {
    lines.push([r.checkedAt, r.outcome, r.value, r.summary, r.executedBy, r.sourceUrl].map(csvCell).join(";"));
  }
  return new Response("﻿" + lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="watchly-${id}.csv"`,
      "cache-control": "no-store",
    },
  });
});
