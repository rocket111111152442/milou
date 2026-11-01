import type { Metadata } from "next";
import { PageHeader } from "@waverti/ui";
import { RULE_CATEGORIES, type RuleCategory } from "@waverti/types";
import { PLAN_CATALOG } from "@waverti/billing/catalog";
import { requireUser } from "@/lib/auth";
import { loadEntitlements } from "@/lib/data/account";
import { NewMonitor } from "./new-monitor";

export const metadata: Metadata = { title: "Nouvelle surveillance" };


export default async function NewMonitorPage({ searchParams }: { searchParams: Promise<{ type?: string; categorie?: string }> }) {
  const user = await requireUser("/app/surveillances/nouvelle");
  const ent = await loadEntitlements(user.id);
  const { type, categorie } = await searchParams;
  const initial: RuleCategory | undefined = type === "web_topic" ? "news" : (RULE_CATEGORIES as readonly string[]).includes(categorie ?? "") ? (categorie as RuleCategory) : undefined;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title="Nouvelle surveillance" description="Trois étapes : ce que vous voulez suivre, vos réglages, puis un résumé à valider." />
      <div className="rounded-3xl border border-line/80 bg-white p-5 shadow-[var(--shadow-card)] sm:p-8">
        <NewMonitor
          initialCategory={initial}
          entitlements={{
            pageIntervalMinutes: ent.pageIntervalMinutes,
            webIntervalMinutes: ent.webIntervalMinutes,
            maxWebTopics: ent.maxWebTopics,
            cloudRelay: ent.cloudRelay,
            emailAlerts: ent.emailAlerts,
            planName: ent.planId ? (PLAN_CATALOG[ent.planId as keyof typeof PLAN_CATALOG]?.name ?? null) : null,
            maxMonitors: ent.maxMonitors,
            businessSites: ent.businessSites,
          }}
        />
      </div>
    </div>
  );
}
