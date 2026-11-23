import type { MailCategory } from "@antonio/shared";

/**
 * Conditions explicites d'une règle. Toutes les conditions renseignées doivent
 * être vraies (ET) ; à l'intérieur d'une liste, une seule valeur suffit (OU).
 */
export interface RuleConditions {
  fromEmails?: string[];
  fromDomains?: string[];
  subjectContains?: string[];
  textContains?: string[];
  categories?: MailCategory[];
  meetingRequest?: boolean;
}

export type RuleAction =
  | { type: "reply_template"; templateId: string }
  | { type: "propose_slots"; durationMin: number; daysAhead: number; count: number }
  | { type: "label"; label: string }
  | { type: "archive" }
  | { type: "trash" }
  | { type: "create_task"; title?: string };

export interface MatchInput {
  fromEmail: string;
  subject: string;
  text: string;
  category: string;
  meetingRequest: boolean;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export function ruleMatches(c: RuleConditions, m: MatchInput): boolean {
  const defined = [c.fromEmails?.length, c.fromDomains?.length, c.subjectContains?.length, c.textContains?.length, c.categories?.length, c.meetingRequest !== undefined].some(Boolean);
  if (!defined) return false; // une règle sans condition explicite ne s'applique jamais
  const from = m.fromEmail.toLowerCase();
  if (c.fromEmails?.length && !c.fromEmails.map((e) => e.toLowerCase()).includes(from)) return false;
  if (c.fromDomains?.length && !c.fromDomains.some((d) => from.endsWith(`@${d.toLowerCase().replace(/^@/, "")}`))) return false;
  if (c.subjectContains?.length && !c.subjectContains.some((s) => norm(m.subject).includes(norm(s)))) return false;
  if (c.textContains?.length && !c.textContains.some((s) => norm(`${m.subject} ${m.text}`).includes(norm(s)))) return false;
  if (c.categories?.length && !c.categories.includes(m.category as MailCategory)) return false;
  if (c.meetingRequest !== undefined && c.meetingRequest !== m.meetingRequest) return false;
  return true;
}

export function describeConditions(c: RuleConditions): string {
  const parts: string[] = [];
  if (c.fromEmails?.length) parts.push(`expéditeur parmi ${c.fromEmails.join(", ")}`);
  if (c.fromDomains?.length) parts.push(`domaine ${c.fromDomains.map((d) => `@${d.replace(/^@/, "")}`).join(" ou ")}`);
  if (c.subjectContains?.length) parts.push(`objet contenant « ${c.subjectContains.join(" » ou « ")} »`);
  if (c.textContains?.length) parts.push(`texte contenant « ${c.textContains.join(" » ou « ")} »`);
  if (c.categories?.length) parts.push(`catégorie ${c.categories.join(" ou ")}`);
  if (c.meetingRequest !== undefined) parts.push(c.meetingRequest ? "demande de rendez-vous" : "hors demande de rendez-vous");
  return parts.join(", ");
}

export function describeAction(a: RuleAction, templateName?: string | null): string {
  switch (a.type) {
    case "reply_template":
      return `répondre à l'expéditeur avec le modèle « ${templateName ?? "?"} »`;
    case "propose_slots":
      return `proposer ${a.count} créneaux de ${a.durationMin} min dans les ${a.daysAhead} prochains jours (sans réserver)`;
    case "label":
      return `classer avec l'étiquette « ${a.label} »`;
    case "archive":
      return "archiver";
    case "trash":
      return "déplacer vers la corbeille (récupérable)";
    case "create_task":
      return "créer une tâche de suivi";
  }
}
