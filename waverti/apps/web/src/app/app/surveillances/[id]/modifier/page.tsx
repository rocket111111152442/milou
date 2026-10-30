import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@waverti/ui";
import { isUuid } from "@waverti/database";
import { requireUser } from "@/lib/auth";
import { loadEntitlements } from "@/lib/data/account";
import { getMonitorDetail } from "@/lib/data/monitors";
import { EditMonitorForm } from "./edit-form";

export const metadata: Metadata = { title: "Modifier la surveillance" };

export default async function EditMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/app/surveillances/${id}/modifier`);
  if (!isUuid(id)) notFound();
  const [d, ent] = await Promise.all([getMonitorDetail(user.id, id), loadEntitlements(user.id)]);
  if (!d) notFound();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title="Modifier la surveillance" description={d.task.name} />
      <div className="rounded-2xl border border-line bg-white p-5 sm:p-8">
        <EditMonitorForm
          id={d.task.id}
          kind={d.task.kind}
          initial={{
            name: d.task.name,
            condition: d.task.condition,
            intervalMinutes: d.schedule?.intervalMinutes ?? ent.pageIntervalMinutes,
            cssSelector: d.target?.cssSelector ?? "",
            executionMode: d.task.executionMode,
            notifyEmail: d.task.notifyEmail,
            notifyDesktop: d.task.notifyDesktop,
            officialDomains: d.target?.officialDomains ?? [],
          }}
          minInterval={d.task.kind === "web_topic" ? (ent.webIntervalMinutes ?? 1440) : ent.pageIntervalMinutes}
          cloudRelay={ent.cloudRelay}
          emailAlerts={ent.emailAlerts}
        />
      </div>
    </div>
  );
}
