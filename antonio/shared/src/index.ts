/**
 * Types partagés entre le serveur et l'interface.
 * Toute donnée affichée comme « réalisée » doit provenir d'un état serveur
 * (action.status === "succeeded") — jamais d'une affirmation du modèle.
 */

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const ACTION_STATUSES = [
  "proposed", // préparée, pas encore soumise à la politique
  "awaiting_approval", // en attente d'une validation précise
  "authorized", // autorisée (règle ou validation), en file d'exécution
  "executing", // appel au fournisseur en cours
  "succeeded", // résultat confirmé par le fournisseur
  "failed", // échec confirmé (aucun effet externe)
  "cancelled", // annulée par l'utilisateur ou invalidée
  "uncertain", // coupure pendant un effet potentiel : à vérifier avant tout nouvel essai
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  proposed: "Proposée",
  awaiting_approval: "En attente de validation",
  authorized: "Autorisée",
  executing: "En cours",
  succeeded: "Réussie",
  failed: "Échouée",
  cancelled: "Annulée",
  uncertain: "Résultat incertain — vérification",
};

export const CATEGORIES = ["messages", "calendar", "filing", "tasks", "crm", "documents"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  messages: "Messages",
  calendar: "Agenda",
  filing: "Classement",
  tasks: "Tâches",
  crm: "CRM",
  documents: "Documents",
};

export const AUTONOMY_LEVELS = ["observe", "prepare", "auto"] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  observe: "Consultation et analyse",
  prepare: "Préparation avec validation",
  auto: "Exécution automatique dans un périmètre défini",
};

export const ACTION_KINDS = [
  "email.draft",
  "email.send",
  "email.reply",
  "email.archive",
  "email.label",
  "email.trash",
  "email.untrash",
  "email.delete_permanent",
  "calendar.create",
  "calendar.update",
  "calendar.cancel",
  "task.create",
  "task.complete",
] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export const ACTION_KIND_CATEGORY: Record<ActionKind, Category> = {
  "email.draft": "messages",
  "email.send": "messages",
  "email.reply": "messages",
  "email.archive": "filing",
  "email.label": "filing",
  "email.trash": "filing",
  "email.untrash": "filing",
  "email.delete_permanent": "filing",
  "calendar.create": "calendar",
  "calendar.update": "calendar",
  "calendar.cancel": "calendar",
  "task.create": "tasks",
  "task.complete": "tasks",
};

export const ACTION_KIND_LABELS: Record<ActionKind, string> = {
  "email.draft": "Brouillon",
  "email.send": "Envoi d'un message",
  "email.reply": "Réponse",
  "email.archive": "Archivage",
  "email.label": "Classement",
  "email.trash": "Mise à la corbeille",
  "email.untrash": "Restauration depuis la corbeille",
  "email.delete_permanent": "Suppression définitive",
  "calendar.create": "Création de rendez-vous",
  "calendar.update": "Modification de rendez-vous",
  "calendar.cancel": "Annulation de rendez-vous",
  "task.create": "Création de tâche",
  "task.complete": "Tâche terminée",
};

/** Possibilité réelle de retour en arrière, telle que permise par le fournisseur. */
export type Reversibility = "reversible" | "irreversible" | "partial";

export interface PolicyCheck {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
  blocking?: boolean;
}

export interface ActionDTO {
  id: string;
  kind: ActionKind;
  category: Category;
  status: ActionStatus;
  origin: "chat" | "voice" | "rule" | "user" | "system";
  summary: string;
  reason: string | null;
  params: Record<string, unknown>;
  /** Empreinte du contenu : une validation ne vaut que pour cette empreinte. */
  paramsHash: string;
  checks: PolicyCheck[];
  ruleId: string | null;
  ruleName?: string | null;
  connectionId: string | null;
  accountLabel?: string | null;
  providerResult: Record<string, unknown> | null;
  reversibility: Reversibility;
  error: string | null;
  simulated: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

// ---------------------------------------------------------------------------
// Connexions
// ---------------------------------------------------------------------------

export const CAPABILITIES = [
  "mail.read",
  "mail.draft",
  "mail.send",
  "mail.modify",
  "mail.delete_permanent",
  "calendar.read",
  "calendar.write",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  "mail.read": "Lecture des messages",
  "mail.draft": "Création de brouillons",
  "mail.send": "Envoi de messages",
  "mail.modify": "Classement, archivage et corbeille",
  "mail.delete_permanent": "Suppression définitive",
  "calendar.read": "Lecture du calendrier",
  "calendar.write": "Création et modification de rendez-vous",
};

export type ProviderId = "google" | "microsoft" | "demo";
export type ConnectionStatus = "active" | "expired" | "error" | "revoked";

export interface ConnectionDTO {
  id: string;
  provider: ProviderId;
  providerLabel: string;
  accountEmail: string;
  status: ConnectionStatus;
  capabilities: Capability[];
  lastSyncAt: string | null;
  lastError: string | null;
  isDemo: boolean;
  webhook: "active" | "polling" | "none";
  createdAt: string;
}

/** Description publique de ce qu'un connecteur sait faire (et ne pas faire). */
export interface ConnectorDescriptor {
  id: string;
  label: string;
  status: "available" | "needs_configuration" | "planned" | "export_only";
  reads: string[];
  writes: string[];
  unsupported: string[];
  notes: string[];
}

// ---------------------------------------------------------------------------
// Données
// ---------------------------------------------------------------------------

export const MAIL_CATEGORIES = [
  "to_handle",
  "waiting",
  "info",
  "newsletter",
  "notification",
  "personal",
  "other",
] as const;
export type MailCategory = (typeof MAIL_CATEGORIES)[number];
export const MAIL_CATEGORY_LABELS: Record<MailCategory, string> = {
  to_handle: "À traiter",
  waiting: "En attente de réponse",
  info: "Pour information",
  newsletter: "Newsletter",
  notification: "Notification",
  personal: "Personnel",
  other: "Autre",
};

export interface Extracted {
  requests: { text: string; certainty: "certain" | "inferred" }[];
  deadlines: { text: string; date: string | null; certainty: "certain" | "inferred" }[];
}

export interface MessageDTO {
  id: string;
  connectionId: string;
  threadId: string;
  from: { name: string | null; email: string };
  to: { name: string | null; email: string }[];
  subject: string;
  snippet: string;
  receivedAt: string;
  unread: boolean;
  category: MailCategory;
  categoryReason: string | null;
  categorySource: "rule" | "heuristic" | "model" | "user";
  needsAction: boolean;
  inTrash: boolean;
  hasAttachments: boolean;
  extracted: Extracted | null;
  simulated: boolean;
}

export interface MessageDetailDTO extends MessageDTO {
  body: string;
  thread: MessageDTO[];
}

export type AttendeeResponse = "needsAction" | "accepted" | "declined" | "tentative" | "unknown";

export interface EventDTO {
  id: string;
  connectionId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  timezone: string | null;
  location: string | null;
  onlineMeetingUrl: string | null;
  attendees: { email: string; name: string | null; response: AttendeeResponse }[];
  organizerEmail: string | null;
  status: "confirmed" | "tentative" | "cancelled";
  recurring: boolean;
  simulated: boolean;
}

export interface TaskDTO {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  status: "open" | "done";
  createdBy: "user" | "assistant" | "rule";
  sourceMessageId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Événements d'interface structurés (le modèle n'injecte jamais de code)
// ---------------------------------------------------------------------------

export const VIEWS = [
  "workspace",
  "briefing",
  "inbox",
  "agenda",
  "tasks",
  "approvals",
  "history",
  "templates",
  "rules",
  "connections",
  "settings",
  "usage",
] as const;
export type ViewId = (typeof VIEWS)[number];

export type UIEvent =
  | { type: "show_messages"; ids: string[]; title?: string }
  | { type: "focus_message"; id: string }
  | { type: "show_events"; ids: string[]; title?: string; date?: string }
  | { type: "focus_event"; id: string }
  | { type: "show_slots"; slots: { start: string; end: string }[]; title?: string }
  | { type: "show_tasks"; ids: string[]; title?: string }
  | { type: "show_actions"; ids: string[]; title?: string }
  | { type: "focus_action"; id: string }
  | { type: "show_briefing"; id: string }
  | { type: "show_rule_proposal"; id: string }
  | { type: "show_memory_proposal"; id: string }
  | { type: "open_view"; view: ViewId }
  | { type: "clear_panel" };

/** Événements temps réel serveur → navigateur (SSE). Volontairement petits. */
export type ServerEvent =
  | { type: "action.updated"; actionId: string; status: ActionStatus }
  | { type: "messages.changed"; connectionId: string }
  | { type: "events.changed"; connectionId: string }
  | { type: "tasks.changed" }
  | { type: "connection.changed"; connectionId: string }
  | { type: "briefing.ready"; briefingId: string }
  | { type: "usage.alert"; message: string }
  | { type: "ui"; event: UIEvent };

export interface AssistantReply {
  conversationId: string;
  turnId: string;
  text: string;
  uiEvents: UIEvent[];
  actionIds: string[];
  engine: "openai" | "demo";
  limited?: string | null;
}

// ---------------------------------------------------------------------------
// Voix
// ---------------------------------------------------------------------------

export type VoiceState = "muted" | "standby" | "listening" | "processing" | "speaking";
export const VOICE_STATE_LABELS: Record<VoiceState, string> = {
  muted: "Microphone coupé",
  standby: "En veille",
  listening: "À l'écoute",
  processing: "En cours de traitement",
  speaking: "En train de parler",
};

/** Voix GPT-Live adaptées au français (voir docs OpenAI « Voice options »). */
export const LIVE_VOICES = [
  { id: "sillage", label: "Sillage — français, masculine" },
  { id: "brise", label: "Brise — français, féminine" },
  { id: "marin", label: "Marin — voix par défaut, multilingue" },
] as const;

// ---------------------------------------------------------------------------
// Briefing
// ---------------------------------------------------------------------------

export interface BriefingItem {
  kind: "observed" | "done" | "recommendation" | "pending" | "error";
  text: string;
  source?: { type: "message" | "event" | "action" | "task" | "connection"; id: string };
}

export interface BriefingDTO {
  id: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  sections: {
    importantMessages: BriefingItem[];
    actionsDone: BriefingItem[];
    toValidate: BriefingItem[];
    agenda: BriefingItem[];
    priorities: BriefingItem[];
    errors: BriefingItem[];
  };
  spoken: string;
  simulatedData: boolean;
}

// ---------------------------------------------------------------------------
// Profils métier (points de départ personnalisables)
// ---------------------------------------------------------------------------

export interface ProfessionPreset {
  id: string;
  label: string;
  repetitiveTasks: string[];
  priorities: string[];
  suggestedRules: string[];
  typicalTools: string[];
}

export const PROFESSION_PRESETS: ProfessionPreset[] = [
  {
    id: "generalist",
    label: "Généraliste",
    repetitiveTasks: ["Répondre aux demandes de rendez-vous", "Trier les newsletters", "Suivre les relances"],
    priorities: ["Clients", "Échéances", "Rendez-vous"],
    suggestedRules: ["Classer les newsletters", "Créer une tâche pour chaque demande nécessitant un suivi"],
    typicalTools: ["Messagerie", "Agenda"],
  },
  {
    id: "consultant",
    label: "Consultant·e / indépendant·e",
    repetitiveTasks: ["Planifier des rendez-vous découverte", "Relancer les devis", "Envoyer les comptes rendus"],
    priorities: ["Prospects", "Devis en cours", "Facturation"],
    suggestedRules: ["Proposer des créneaux aux demandes de rendez-vous", "Créer une tâche de relance des devis"],
    typicalTools: ["Messagerie", "Agenda", "CRM", "Facturation"],
  },
  {
    id: "real_estate",
    label: "Immobilier",
    repetitiveTasks: ["Organiser des visites", "Répondre aux demandes d'information sur un bien", "Suivre les dossiers"],
    priorities: ["Visites", "Offres", "Pièces des dossiers"],
    suggestedRules: ["Réponse type aux demandes d'information", "Proposer des créneaux de visite"],
    typicalTools: ["Messagerie", "Agenda", "Logiciel de transaction (export)"],
  },
  {
    id: "health",
    label: "Cabinet de santé / paramédical",
    repetitiveTasks: ["Gérer les demandes de rendez-vous", "Répondre aux questions pratiques"],
    priorities: ["Rendez-vous", "Annulations", "Urgences (jamais traitées automatiquement)"],
    suggestedRules: ["Réponse type pour les informations pratiques"],
    typicalTools: ["Messagerie", "Agenda", "Logiciel de prise de rendez-vous (export)"],
  },
  {
    id: "sales",
    label: "Commercial·e",
    repetitiveTasks: ["Relancer les prospects", "Planifier des démonstrations", "Préparer les rendez-vous"],
    priorities: ["Opportunités", "Relances", "Démonstrations"],
    suggestedRules: ["Créer une tâche de relance après 3 jours sans réponse"],
    typicalTools: ["Messagerie", "Agenda", "CRM"],
  },
  {
    id: "legal_accounting",
    label: "Juridique / comptabilité",
    repetitiveTasks: ["Collecter des pièces", "Rappeler des échéances", "Répondre aux demandes simples"],
    priorities: ["Échéances", "Pièces manquantes", "Clients"],
    suggestedRules: ["Créer une tâche pour chaque pièce demandée"],
    typicalTools: ["Messagerie", "Agenda", "Espace documentaire"],
  },
];

/** Les fournisseurs (OpenAI) facturent en dollars : les coûts sont suivis en micro-dollars. */
export function formatUsdFromMicros(micros: number): string {
  return (micros / 1_000_000).toLocaleString("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
}
