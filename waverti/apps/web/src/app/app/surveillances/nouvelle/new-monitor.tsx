"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Callout, useToast } from "@waverti/ui";
import { MonitorWizard, type AnalysisResult, type TopicPlan, type WizardEntitlements } from "@waverti/ui/app";
import type { RuleCategory } from "@waverti/types";
import { apiCall } from "@/components/app/use-api";
import { hasBrowserOffer, readBrowserReading, type BrowserReading } from "./browser-reading";

const availabilityLabel: Record<BrowserReading["availability"], string> = {
  in_stock: "En stock",
  out_of_stock: "En rupture de stock",
  preorder: "En précommande",
  unknown: "Non détectée",
};

export function NewMonitor({
  entitlements, initialCategory, browserMonitoringAvailable, onCreated,
}: {
  entitlements: WizardEntitlements;
  initialCategory?: RuleCategory;
  browserMonitoringAvailable?: boolean;
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [reading, setReading] = React.useState<BrowserReading | "invalid" | null>(null);
  const [importedUrl, setImportedUrl] = React.useState<string>();

  React.useEffect(() => {
    const result = readBrowserReading(window.location.hash);
    if (result === null) return;
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    setReading(result);
    if (result !== "invalid" && (result.version === 2 || !hasBrowserOffer(result))) setImportedUrl(result.url);
  }, []);

  const offer = reading && reading !== "invalid" && hasBrowserOffer(reading) ? reading : null;
  const importedCategory = importedUrl && offer ? (offer.price === null ? "product" : "price") : initialCategory;
  const recurringReading = reading && reading !== "invalid" && reading.version === 2 && reading.recurring ? reading : undefined;
  const browserMonitoringUrl = recurringReading?.url;

  return (
    <div className="flex flex-col gap-5">
      {reading === "invalid" ? (
        <Callout tone="warning" title="Import depuis Chrome indisponible">
          Rouvrez la page à surveiller et relancez l’import depuis l’extension Waverti.
        </Callout>
      ) : offer && !(recurringReading && browserMonitoringAvailable) ? (
        <Callout tone="info" title={offer.version === 1 ? "Relevé ponctuel Amazon importé" : "Relevé ponctuel importé depuis Chrome"}>
          <div className="flex flex-col gap-2">
            <p>
              {offer.price !== null && offer.currency ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: offer.currency }).format(offer.price) : "Prix non détecté"}
              {" · "}{availabilityLabel[offer.availability]}
              {" · "}{new Date(offer.observedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p>Ces valeurs importées restent dans cette page. Waverti vérifie le suivi automatique séparément.</p>
            {!importedUrl ? (
              <div><Button type="button" variant="secondary" onClick={() => setImportedUrl(offer.url)}>Utiliser cette adresse</Button></div>
            ) : null}
          </div>
        </Callout>
      ) : reading && !offer ? (
        <Callout tone="info" title="Lien reçu depuis Chrome">
          L’adresse de {new URL(reading.url).hostname} est déjà renseignée. Choisissez ce que vous voulez surveiller.
        </Callout>
      ) : null}
      {browserMonitoringUrl ? (
        <Callout tone={browserMonitoringAvailable ? "info" : "warning"} title="Suivi récurrent dans Chrome">
          {browserMonitoringAvailable
            ? "Cette adresse a été importée pour un suivi du prix ou du stock depuis Chrome. Vérifiez le choix à l’étape suivante."
            : "Aucune extension Chrome active n’est reliée à votre compte. Réactivez l’extension puis relancez l’import, ou choisissez les contrôles par les serveurs Waverti."}
        </Callout>
      ) : null}
      <MonitorWizard
        key={importedUrl ?? "new"}
        entitlements={entitlements}
        initialCategory={importedCategory}
        initialUrl={importedUrl}
        browserMonitoringUrl={browserMonitoringUrl}
        browserMonitoringReading={recurringReading}
        browserMonitoringAvailable={browserMonitoringAvailable}
        browserExtensionHref="/downloads/waverti-chrome.zip"
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
