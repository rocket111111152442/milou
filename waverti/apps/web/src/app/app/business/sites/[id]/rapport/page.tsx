import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@waverti/ui";
import { isUuid } from "@waverti/database";
import { formatDateTime, formatDuration, formatPercent } from "@waverti/types";
import { requireUser } from "@/lib/auth";
import { getReportRows, getSiteDetail, listIncidents } from "@/lib/data/business";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Rapport de disponibilité" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/app/business/sites/${id}/rapport`);
  if (!isUuid(id)) notFound();
  const [d, rows, incidents] = await Promise.all([getSiteDetail(user.id, id), getReportRows(user.id, id, 30), listIncidents(user.id, { siteId: id, limit: 200 })]);
  if (!d) notFound();
  const since = Date.now() - 30 * 86_400_000;
  const recent = incidents.filter((i) => new Date(i.startedAt).getTime() >= since);
  const byEndpoint = new Map<string, { url: string; checks: number; failures: number; downtime: number; avgSum: number; avgN: number }>();
  for (const r of rows) {
    const e = byEndpoint.get(r.endpoint) ?? { url: r.url, checks: 0, failures: 0, downtime: 0, avgSum: 0, avgN: 0 };
    e.checks += r.checks;
    e.failures += r.failures;
    e.downtime += r.downtime_seconds;
    if (r.avg_response_ms !== null) {
      e.avgSum += r.avg_response_ms * (r.checks - r.failures);
      e.avgN += r.checks - r.failures;
    }
    byEndpoint.set(r.endpoint, e);
  }
  return (
    <div className="flex flex-col gap-6 print:gap-4">
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted-fg print:hidden">
        <Link href={`/app/business/sites/${id}`} className="hover:text-ink">
          {d.site.name}
        </Link>{" "}
        / <span aria-current="page">Rapport</span>
      </nav>
      <PageHeader
        title={`Rapport de disponibilité — ${d.site.name}`}
        description={`${d.site.domain} · 30 derniers jours · édité le ${formatDateTime(new Date())}`}
        actions={<PrintButton />}
      />
      <Card className="p-5">
        <p className="text-sm text-muted-fg">Disponibilité globale mesurée</p>
        <p className="font-display text-3xl font-bold">{formatPercent(d.uptime30d)}</p>
        <p className="mt-1 text-xs text-muted-fg">
          Calculée uniquement à partir des contrôles réellement effectués ; les jours sans mesure ne sont pas comptés comme disponibles.
        </p>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Disponibilité par point de contrôle</caption>
          <thead>
            <tr className="border-b border-line bg-surface text-left">
              <th scope="col" className="px-4 py-3">Point de contrôle</th>
              <th scope="col" className="px-4 py-3 text-right">Contrôles</th>
              <th scope="col" className="px-4 py-3 text-right">Échecs</th>
              <th scope="col" className="px-4 py-3 text-right">Disponibilité</th>
              <th scope="col" className="px-4 py-3 text-right">Temps moyen</th>
              <th scope="col" className="px-4 py-3 text-right">Indisponibilité</th>
            </tr>
          </thead>
          <tbody>
            {[...byEndpoint.entries()].map(([name, e]) => (
              <tr key={name} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  {name}
                  <span className="block text-xs font-normal text-muted-fg">{e.url}</span>
                </th>
                <td className="px-4 py-3 text-right tabular-nums">{e.checks}</td>
                <td className="px-4 py-3 text-right tabular-nums">{e.failures}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatPercent(e.checks ? (e.checks - e.failures) / e.checks : null)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{e.avgN ? `${Math.round(e.avgSum / e.avgN)} ms` : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatDuration(e.downtime)}</td>
              </tr>
            ))}
            {byEndpoint.size === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-fg">
                  Aucune mesure sur la période.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
      <Card className="p-5">
        <h2 className="font-display text-lg font-bold">Incidents ({recent.length})</h2>
        {recent.length ? (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {recent.map((i) => (
              <li key={i.id}>
                <span className="font-medium">{i.title}</span> — début {formatDateTime(i.startedAt)}
                {i.resolvedAt ? `, durée ${formatDuration(i.durationSeconds)}` : ", en cours"}
                {i.cause ? <span className="block text-muted-fg">{i.cause}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-fg">Aucun incident sur la période.</p>
        )}
      </Card>
    </div>
  );
}
