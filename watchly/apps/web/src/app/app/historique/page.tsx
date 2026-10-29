import type { Metadata } from "next";
import { Card, CardContent, PageHeader } from "@watchly/ui";
import { ResultTimeline } from "@watchly/ui/app";
import { requireUser } from "@/lib/auth";
import { loadEntitlements } from "@/lib/data/account";
import { listHistory, toResultView } from "@/lib/data/monitors";

export const metadata: Metadata = { title: "Historique" };

export default async function HistoryPage() {
  const user = await requireUser("/app/historique");
  const [rows, ent] = await Promise.all([listHistory(user.id, 200), loadEntitlements(user.id)]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Historique" description={`Les 200 derniers contrôles, toutes surveillances confondues. Conservation : ${ent.historyDays} jours selon votre formule.`} />
      <Card>
        <CardContent className="pt-6">
          <ResultTimeline results={rows.map((r) => ({ ...toResultView(r.result, r.condition), summary: `${r.name} — ${toResultView(r.result, r.condition).summary}` }))} />
        </CardContent>
      </Card>
    </div>
  );
}
