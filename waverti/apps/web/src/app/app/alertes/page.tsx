import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@waverti/ui";
import { NotificationList } from "@waverti/ui/app";
import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/lib/data/monitors";
import { AlertsActions } from "./alerts-actions";

export const metadata: Metadata = { title: "Alertes" };

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const user = await requireUser("/app/alertes");
  const { filtre } = await searchParams;
  const unread = filtre === "non-lues";
  const items = await listNotifications(user.id, { unread, limit: 100 });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Alertes"
        description="Les événements détectés par vos surveillances, avec leur source."
        actions={<AlertsActions hasUnread={items.some((i) => !i.readAt)} />}
      />
      <nav aria-label="Filtrer" className="inline-flex w-fit gap-1 rounded-full border border-line bg-white p-1">
        {[
          ["", "Toutes"],
          ["non-lues", "Non lues"],
        ].map(([k, l]) => (
          <Link
            key={k}
            href={k ? `/app/alertes?filtre=${k}` : "/app/alertes"}
            aria-current={(unread ? "non-lues" : "") === k ? "page" : undefined}
            className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-fg hover:text-ink aria-[current=page]:bg-ink aria-[current=page]:text-white"
          >
            {l}
          </Link>
        ))}
      </nav>
      <NotificationList
        items={items}
        renderOpenLink={(n) =>
          n.linkPath ? (
            <Link href={n.linkPath} className="text-blue hover:underline">
              Voir
            </Link>
          ) : null
        }
      />
    </div>
  );
}
