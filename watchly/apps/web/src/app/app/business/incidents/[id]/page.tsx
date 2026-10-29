import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@watchly/ui";
import { isUuid } from "@watchly/database";
import { formatDateTime, formatDuration } from "@watchly/types";
import { requireUser } from "@/lib/auth";
import { getIncident } from "@/lib/data/business";

export const metadata: Metadata = { title: "Incident" };

const KIND = { downtime: "Indisponibilité", tls: "Certificat HTTPS", scenario: "Scénario de parcours" } as const;
const EVENT = { detected: "Détection", confirmed: "Confirmation", notified: "Alerte envoyée", check_failed: "Nouvel échec", recovered: "Rétablissement", note: "Note" } as const;

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/app/business/incidents/${id}`);
  if (!isUuid(id)) notFound();
  const d = await getIncident(user.id, id);
  if (!d) notFound();
  const { incident, raw } = d;
  const duration = Math.round(((raw.resolvedAt ?? new Date()).getTime() - raw.startedAt.getTime()) / 1000);
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted-fg">
        <Link href="/app/business" className="hover:text-ink">
          Business
        </Link>{" "}
        /{" "}
        <Link href={`/app/business/sites/${raw.siteId}`} className="hover:text-ink">
          {incident.siteName}
        </Link>{" "}
        / <span aria-current="page">Incident</span>
      </nav>
      <PageHeader
        title={incident.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={incident.status === "open" ? "danger" : "success"}>{incident.status === "open" ? "En cours" : "Résolu"}</Badge>
            <span>{KIND[incident.kind]}</span>
            {d.target ? <span>· {d.target}</span> : null}
          </span>
        }
      />
      <Card className="grid gap-4 p-5 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted-fg">Début</p>
          <p className="mt-1 font-medium">{formatDateTime(incident.startedAt)}</p>
        </div>
        <div>
          <p className="text-muted-fg">{incident.status === "open" ? "Durée (en cours)" : "Fin"}</p>
          <p className="mt-1 font-medium">{incident.resolvedAt ? formatDateTime(incident.resolvedAt) : formatDuration(duration)}</p>
        </div>
        <div>
          <p className="text-muted-fg">Durée totale</p>
          <p className="mt-1 font-medium">{formatDuration(duration)}</p>
        </div>
        <div className="sm:col-span-3">
          <p className="text-muted-fg">Cause constatée</p>
          <p className="mt-1">{incident.cause ?? "—"}</p>
        </div>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Chronologie</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3 border-l border-line pl-5">
            {d.events.map((e) => (
              <li key={e.id} className="relative">
                <span aria-hidden="true" className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-white bg-ink" />
                <p className="text-sm font-medium">
                  {EVENT[e.type]} <span className="font-normal text-muted-fg">· {formatDateTime(e.at)}</span>
                </p>
                <p className="text-sm text-muted-fg">{e.message}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      {raw.screenshotId ? (
        <Card>
          <CardHeader>
            <CardTitle>Capture d'écran au moment de l'échec</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Image privée servie par l'API (contrôle d'accès), volontairement sans optimisation next/image. */}
            <img src={`/api/business/artifacts/${raw.screenshotId}`} alt={`Page affichée lors de l'échec du scénario sur ${d.domain}`} className="w-full rounded-xl border border-line" />
            <p className="mt-2 text-xs text-muted-fg">Conservée 30 jours.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
