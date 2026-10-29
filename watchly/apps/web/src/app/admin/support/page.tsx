import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader } from "@watchly/ui";
import { formatDateTime } from "@watchly/types";
import { listTickets } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Assistance" };
const FILTERS = [
  ["open", "Ouvertes"],
  ["pending", "En attente du client"],
  ["closed", "Fermées"],
  ["all", "Toutes"],
] as const;
const TONE = { open: "danger", pending: "warning", closed: "neutral" } as const;

export default async function AdminSupport({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { statut = "open" } = await searchParams;
  const status = (FILTERS.find(([k]) => k === statut)?.[0] ?? "open") as (typeof FILTERS)[number][0];
  const tickets = await listTickets(status);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Assistance" description="Demandes envoyées depuis le formulaire d'assistance." />
      <nav aria-label="Filtrer les demandes" className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => (
          <Link
            key={k}
            href={`/admin/support?statut=${k}`}
            aria-current={k === status ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${k === status ? "border-ink bg-ink text-white" : "border-line hover:bg-surface"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Card className="divide-y divide-line p-0">
        {tickets.map((t) => (
          <Link key={t.id} href={`/admin/support/${t.id}`} className="flex flex-col gap-1 px-5 py-4 hover:bg-surface sm:flex-row sm:items-center sm:justify-between">
            <span>
              <span className="font-medium">{t.subject}</span>
              <span className="block text-sm text-muted-fg">
                {t.email} · {t.category} · {t.messages} message(s)
              </span>
            </span>
            <span className="flex items-center gap-2 text-sm text-muted-fg">
              <Badge tone={TONE[t.status as keyof typeof TONE] ?? "neutral"}>{t.status}</Badge> {formatDateTime(t.updated_at)}
            </span>
          </Link>
        ))}
        {tickets.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-fg">Aucune demande.</p> : null}
      </Card>
    </div>
  );
}
