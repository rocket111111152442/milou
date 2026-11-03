"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Callout, useToast } from "@waverti/ui";
import { MonitorWizard, type AnalysisResult, type TopicPlan, type WizardEntitlements } from "@waverti/ui/app";
import type { RuleCategory } from "@waverti/types";
import { apiCall } from "@/components/app/use-api";
import { readBrowserReading, type BrowserReading } from "./browser-reading";

const availabilityLabel: Record<BrowserReading["availability"], string> = {
  in_stock: "En stock",
  out_of_stock: "En rupture de stock",
  preorder: "En précommande",
  unknown: "Non détectée",
};

export function NewMonitor({ entitlements, initialCategory, onCreated }: { entitlements: WizardEntitlements; initialCategory?: RuleCategory; onCreated?: (id: string) => void }) {
  const router = useRouter();
  const { push } = useToast();
  const [reading, setReading] = React.useState<BrowserReading | "invalid" | null>(null);
  const [importedUrl, setImportedUrl] = React.useState<string>();

  React.useEffect(() => {
    const result = readBrowserReading(window.location.hash);
    if (result === null) return;
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    setReading(result);
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {reading === "invalid" ? (
        <Callout tone="warning" title="Relevé navigateur indisponible">
          Retournez sur la fiche Amazon et lancez un nouveau relevé depuis l’extension.
        </Callout>
      ) : reading ? (
        <Callout tone="info" title="Relevé ponctuel Amazon importé">
          <div className="flex flex-col gap-2">
            <p>
              {reading.price === null ? "Prix non détecté" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(reading.price)}
              {" · "}{availabilityLabel[reading.availability]}
              {" · "}{new Date(reading.observedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p>Ces valeurs importées restent dans cette page. Waverti vérifie le suivi automatique séparément.</p>
            {!importedUrl ? (
              <div><Button type="button" variant="secondary" onClick={() => setImportedUrl(reading.url)}>Utiliser cette adresse</Button></div>
            ) : null}
          </div>
        </Callout>
      ) : null}
      <MonitorWizard
        key={importedUrl ?? "new"}
        entitlements={entitlements}
        initialCategory={importedUrl ? "price" : initialCategory}
        initialUrl={importedUrl}
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
          push({ tone: "success", title: "Surveillance créée", description: "Le premier contrôle a été planifié." });
          if (onCreated) onCreated(r.data.id);
          else router.push(`/app/surveillances/${r.data.id}`);
          return { ok: true };
        }}
      />
    </div>
  );
}
