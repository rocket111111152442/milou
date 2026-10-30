import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader } from "@waverti/ui";
import { isUuid } from "@waverti/database";
import { formatDateTime } from "@waverti/types";
import { getTicket } from "@/lib/data/admin";
import { TicketActions } from "./ticket-actions";

export const metadata: Metadata = { title: "Demande d'assistance" };

export default async function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const d = await getTicket(id);
  if (!d) notFound();
  const t = d.ticket as Record<string, unknown>;
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted-fg">
        <Link href="/admin/support" className="hover:text-ink">
          Assistance
        </Link>{" "}
        / <span aria-current="page">{String(t.subject)}</span>
      </nav>
      <PageHeader
        title={String(t.subject)}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{String(t.status)}</Badge> {String(t.email)} · {String(t.category)} · référence {String(t.id).slice(0, 8).toUpperCase()}
            {t.user_id ? (
              <Link className="text-blue hover:underline" href={`/admin/utilisateurs/${String(t.user_id)}`}>
                voir le compte
              </Link>
            ) : (
              <span>(sans compte)</span>
            )}
          </span>
        }
      />
      <ol className="flex flex-col gap-3">
        {d.messages.map((m) => (
          <li key={String(m.id)}>
            <Card className={`p-4 ${m.author === "staff" ? "border-blue/30 bg-info-soft" : ""}`}>
              <p className="text-xs text-muted-fg">
                {m.author === "staff" ? "Équipe Waverti" : "Client"} · {formatDateTime(m.created_at as Date)}
              </p>
              <p className="mt-2 whitespace-pre-line text-sm">{String(m.body)}</p>
            </Card>
          </li>
        ))}
      </ol>
      <TicketActions ticketId={id} status={String(t.status)} />
    </div>
  );
}
