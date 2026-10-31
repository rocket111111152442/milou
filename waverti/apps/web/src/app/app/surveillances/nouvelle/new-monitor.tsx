"use client";
import { useRouter } from "next/navigation";
import { useToast } from "@waverti/ui";
import { MonitorWizard, type AnalysisResult, type TopicPlan, type WizardEntitlements } from "@waverti/ui/app";
import type { RuleCategory } from "@waverti/types";
import { apiCall } from "@/components/app/use-api";

export function NewMonitor({ entitlements, initialCategory, onCreated }: { entitlements: WizardEntitlements; initialCategory?: RuleCategory; onCreated?: (id: string) => void }) {
  const router = useRouter();
  const { push } = useToast();
  return (
    <MonitorWizard
      entitlements={entitlements}
      initialCategory={initialCategory}
      upgradeHref="/app/abonnement"
      businessHref="/app/business"
      onPreview={async (url, cssSelector) => {
        const r = await apiCall<AnalysisResult>("/api/monitors/preview", { body: { url, cssSelector } });
        return r.ok ? r.data : { ok: false, error: { code: r.error.error ?? "error", message: r.error.message ?? "Analyse impossible." } };
      }}
      onPlanTopic={async (request, officialDomains) => {
        const r = await apiCall<TopicPlan>("/api/monitors/plan-topic", { body: { request, officialDomains } });
        return r.ok ? r.data : null;
      }}
      onSubmit={async (input) => {
        const r = await apiCall<{ id: string }>("/api/monitors", { body: input });
        if (!r.ok) {
          const fieldErrors = Object.fromEntries((r.error.issues ?? []).map((i) => [i.path.split(".").pop() ?? i.path, i.message]));
          return { ok: false, message: r.error.message, fieldErrors };
        }
        push({ tone: "success", title: "Surveillance créée", description: "Le premier contrôle est en cours." });
        if (onCreated) onCreated(r.data.id);
        else router.push(`/app/surveillances/${r.data.id}`);
        return { ok: true };
      }}
    />
  );
}
