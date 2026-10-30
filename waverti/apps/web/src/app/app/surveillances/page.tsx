import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, PageHeader } from "@waverti/ui";
import { MonitorList } from "@waverti/ui/app";
import { requireUser } from "@/lib/auth";
import { listMonitors } from "@/lib/data/monitors";
import { NextLink } from "@/components/app/next-link";

export const metadata: Metadata = { title: "Mes surveillances" };

const FILTERS = [
  { key: "", label: "Toutes" },
  { key: "page", label: "Pages" },
  { key: "web_topic", label: "Sujets Internet" },
] as const;

export default async function MonitorsPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string }> }) {
  const user = await requireUser("/app/surveillances");
  const { type, q } = await searchParams;
  const kind = type === "page" || type === "web_topic" ? type : undefined;
  const monitors = await listMonitors(user.id, { kind, q: q?.slice(0, 80) });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mes surveillances"
        description={`${monitors.length} surveillance${monitors.length > 1 ? "s" : ""}`}
        actions={
          <Button asChild>
            <Link href="/app/surveillances/nouvelle">
              <Plus aria-hidden="true" /> Nouvelle surveillance
            </Link>
          </Button>
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filtrer" className="inline-flex gap-1 rounded-full border border-line bg-white p-1">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key ? `/app/surveillances?type=${f.key}` : "/app/surveillances"}
              aria-current={(kind ?? "") === f.key ? "page" : undefined}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-fg aria-[current=page]:bg-ink aria-[current=page]:text-white hover:text-ink aria-[current=page]:hover:text-white"
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <form role="search" className="w-full sm:w-72">
          {kind ? <input type="hidden" name="type" value={kind} /> : null}
          <label htmlFor="q" className="sr-only">
            Rechercher une surveillance
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Rechercher…"
            className="h-10 w-full rounded-full border border-line bg-white px-4 text-sm placeholder:text-muted focus-visible:border-blue focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue/10"
          />
        </form>
      </div>
      <MonitorList
        monitors={monitors}
        hrefFor={(m) => `/app/surveillances/${m.id}`}
        renderLink={NextLink}
        emptyAction={
          <Button asChild>
            <Link href="/app/surveillances/nouvelle">Créer ma première surveillance</Link>
          </Button>
        }
      />
    </div>
  );
}
