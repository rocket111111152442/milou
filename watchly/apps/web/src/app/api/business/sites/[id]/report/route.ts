import { isUuid } from "@watchly/database";
import { apiError, withActor } from "@/lib/api";
import { getReportRows } from "@/lib/data/business";

/** Rapport CSV (statistiques quotidiennes réelles par point de contrôle). */
export const GET = withActor(async (req, actor, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "not_found");
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("jours") ?? 30) || 30));
  const rows = await getReportRows(actor.userId, id!, days);
  // Neutralise les formules des tableurs (=, +, -, @) dans les champs texte.
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const header = ["jour", "point_de_controle", "adresse", "controles", "echecs", "disponibilite_pct", "temps_moyen_ms", "temps_p95_ms", "indisponibilite_s"];
  const lines = rows.map((r) =>
    [r.day, r.endpoint, r.url, r.checks, r.failures, r.checks ? (((r.checks - r.failures) / r.checks) * 100).toFixed(3) : "", r.avg_response_ms, r.p95_response_ms, r.downtime_seconds]
      .map(cell)
      .join(";"),
  );
  return new Response(`﻿${[header.join(";"), ...lines].join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="watchly-rapport-${days}j.csv"`,
      "cache-control": "no-store",
    },
  });
});
