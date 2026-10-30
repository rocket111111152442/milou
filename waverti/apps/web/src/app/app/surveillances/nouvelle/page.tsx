import type { Metadata } from "next";
import { PageHeader } from "@waverti/ui";
import { requireUser } from "@/lib/auth";
import { loadEntitlements } from "@/lib/data/account";
import { NewMonitor } from "./new-monitor";

export const metadata: Metadata = { title: "Nouvelle surveillance" };

export default async function NewMonitorPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const user = await requireUser("/app/surveillances/nouvelle");
  const ent = await loadEntitlements(user.id);
  const { type } = await searchParams;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Nouvelle surveillance" description="Indiquez ce que Waverti doit surveiller et quand vous prévenir." />
      <div className="rounded-2xl border border-line bg-white p-5 sm:p-8">
        <NewMonitor
          defaultKind={type === "web_topic" ? "web_topic" : "page"}
          entitlements={{
            pageIntervalMinutes: ent.pageIntervalMinutes,
            webIntervalMinutes: ent.webIntervalMinutes,
            maxWebTopics: ent.maxWebTopics,
            cloudRelay: ent.cloudRelay,
            emailAlerts: ent.emailAlerts,
          }}
        />
      </div>
    </div>
  );
}
