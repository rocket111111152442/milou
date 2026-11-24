import type { ConnectorDescriptor, ProviderId } from "@antonio/shared";
import { demoAdapter } from "./demo/adapter.js";
import { googleAdapter } from "./google/adapter.js";
import { microsoftAdapter } from "./microsoft/adapter.js";
import type { ProviderAdapter } from "./types.js";

const adapters: Record<ProviderId, ProviderAdapter> = {
  google: googleAdapter,
  microsoft: microsoftAdapter,
  demo: demoAdapter,
};

export function adapterFor(provider: string): ProviderAdapter {
  const a = adapters[provider as ProviderId];
  if (!a) throw new Error(`Fournisseur inconnu : ${provider}`);
  return a;
}

/**
 * Connecteurs prévus : décrits honnêtement, sans prétendre à une synchronisation.
 * L'architecture (ProviderAdapter + descripteur) permet de les ajouter un par un.
 */
const PLANNED: ConnectorDescriptor[] = [
  {
    id: "crm",
    label: "CRM (HubSpot, Pipedrive, Salesforce…)",
    status: "planned",
    reads: [],
    writes: [],
    unsupported: ["Aucune lecture ni écriture tant que le connecteur n'est pas développé"],
    notes: ["En attendant : Waverti peut préparer un export CSV des contacts et tâches de suivi (Tâches → Exporter)."],
  },
  {
    id: "tasks_tools",
    label: "Outils de tâches (Todoist, Asana, Microsoft To Do…)",
    status: "planned",
    reads: [],
    writes: [],
    unsupported: ["Pas de synchronisation"],
    notes: ["Les tâches sont gérées dans Waverti et exportables (CSV, iCalendar pour les échéances)."],
  },
  {
    id: "documents",
    label: "Espaces documentaires (Google Drive, OneDrive, SharePoint)",
    status: "planned",
    reads: [],
    writes: [],
    unsupported: ["Pas d'accès aux documents"],
    notes: ["Les scopes nécessaires seront demandés séparément, uniquement à l'activation."],
  },
  {
    id: "export",
    label: "Logiciels sans connexion exploitable",
    status: "export_only",
    reads: [],
    writes: [],
    unsupported: ["Aucune synchronisation"],
    notes: ["Waverti prépare des données (CSV) clairement identifiées comme exports, à importer manuellement."],
  },
];

export function allDescriptors(): ConnectorDescriptor[] {
  return [googleAdapter.descriptor(), microsoftAdapter.descriptor(), ...PLANNED];
}
