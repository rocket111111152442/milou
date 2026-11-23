import type { Extracted, MailCategory } from "@antonio/shared";

/**
 * Analyse déterministe et explicable des messages.
 * Les résultats sont des indices : chaque élément porte sa certitude
 * (« certain » = écrit explicitement, « inferred » = déduit).
 */

export interface MailInput {
  fromEmail: string;
  fromName: string | null;
  subject: string;
  text: string; // extrait ou corps
  hasAttachments: boolean;
  ccCount: number;
  priorityContacts: string[];
}

const NEWSLETTER = /(newsletter|unsubscribe|se d[ée]sabonner|d[ée]sinscri|webinar|offre sp[ée]ciale|promo|%\s*de r[ée]duction)/i;
const NOREPLY = /(no-?reply|ne-pas-repondre|notifications?@|alerts?@|mailer-daemon|bounce)/i;
const NOTIFICATION_SUBJECT = /(notification|confirmation de|re[çc]u|facture disponible|votre commande|alerte|security alert|code de v[ée]rification)/i;
const REQUEST = /(\?|pourriez-vous|pouvez-vous|peux-tu|pourrais-tu|merci de|je souhaiterais|j'aimerais|serait-il possible|auriez-vous|est-ce possible|besoin de|could you|can you)/i;
const MEETING = /(rendez-vous|rdv|r[ée]union|cr[ée]neau|disponibilit[ée]s?|rencontrer|visio|un appel|appeler|meeting)/i;

export function classify(m: MailInput): { category: MailCategory; reason: string; needsAction: boolean } {
  const hay = `${m.subject}\n${m.text}`;
  if (SUSPICIOUS.test(hay)) {
    return {
      category: "other",
      reason: "Contient des instructions adressées à un assistant IA (possible tentative de manipulation) : aucune n'est suivie, à vérifier par vous",
      needsAction: false,
    };
  }
  if (m.priorityContacts.includes(m.fromEmail.toLowerCase())) {
    return { category: "to_handle", reason: "Contact prioritaire", needsAction: REQUEST.test(hay) || MEETING.test(hay) };
  }
  if (NOREPLY.test(m.fromEmail) || NOTIFICATION_SUBJECT.test(m.subject)) {
    return { category: "notification", reason: "Expéditeur automatique ou notification", needsAction: false };
  }
  if (NEWSLETTER.test(hay)) return { category: "newsletter", reason: "Contenu de type lettre d'information (lien de désinscription, promotion)", needsAction: false };
  if (MEETING.test(hay) && REQUEST.test(hay)) return { category: "to_handle", reason: "Demande de rendez-vous ou de disponibilités", needsAction: true };
  if (REQUEST.test(hay)) return { category: "to_handle", reason: "Contient une question ou une demande", needsAction: true };
  return { category: "info", reason: "Aucune demande explicite détectée", needsAction: false };
}

const MONTHS: Record<string, number> = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
};
const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export function extract(text: string, receivedAt: Date): Extracted {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const requests = sentences.filter((s) => REQUEST.test(s) && s.length < 300).slice(0, 5).map((s) => ({ text: s, certainty: "certain" as const }));
  const deadlines: Extracted["deadlines"] = [];
  for (const s of sentences) {
    const explicit = s.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/) ?? null;
    const named = s.match(/\b(\d{1,2})(?:er)?\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre)\b/i);
    const relative = s.match(/\b(avant|d'ici|pour|au plus tard)\s+(demain|ce soir|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|la fin de la semaine|fin de semaine)\b/i);
    if (named) {
      const month = MONTHS[named[2].toLowerCase().normalize("NFC")] ?? MONTHS[named[2].toLowerCase()];
      if (month) {
        const year = month < receivedAt.getMonth() + 1 ? receivedAt.getFullYear() + 1 : receivedAt.getFullYear();
        deadlines.push({ text: s, date: isoDate(year, month, Number(named[1])), certainty: "certain" });
        continue;
      }
    }
    if (explicit && /(avant|d'ici|pour le|au plus tard|échéance|le\s)/i.test(s)) {
      const day = Number(explicit[1]);
      const month = Number(explicit[2]);
      const year = explicit[3] ? Number(explicit[3].length === 2 ? `20${explicit[3]}` : explicit[3]) : receivedAt.getFullYear();
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        deadlines.push({ text: s, date: isoDate(year, month, day), certainty: "certain" });
        continue;
      }
    }
    if (relative) {
      deadlines.push({ text: s, date: resolveRelative(relative[2].toLowerCase(), receivedAt), certainty: "inferred" });
    }
  }
  return { requests, deadlines: deadlines.slice(0, 5) };
}

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function resolveRelative(word: string, from: Date): string | null {
  const d = new Date(from);
  if (word === "demain") d.setDate(d.getDate() + 1);
  else if (word === "ce soir") {
    /* même jour */
  } else if (word.includes("semaine")) d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
  else {
    const idx = WEEKDAYS.indexOf(word);
    if (idx < 0) return null;
    d.setDate(d.getDate() + (((idx - d.getDay() + 7) % 7) || 7));
  }
  return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

// ---------------------------------------------------------------------------
// Exceptions : situations qui imposent une validation même si une règle s'applique
// ---------------------------------------------------------------------------

export const EXCEPTION_LABELS: Record<string, string> = {
  amount: "Montant ou modification de prix",
  attachment: "Pièce jointe",
  legal: "Sujet juridique ou contractuel",
  external_cc: "Autres destinataires en copie",
  urgent: "Urgence signalée",
  already_replied: "Une réponse a déjà été envoyée dans ce fil",
  suspicious: "Instructions inhabituelles adressées à un assistant",
};

const AMOUNT = /(\d[\d\s.,]*\s?(€|eur|euros?|\$|usd)|\b(prix|tarif|remise|réduction|devis|facture|montant|ristourne|augmentation)\b)/i;
const LEGAL = /\b(contrat|résiliation|resiliation|avocat|juridique|litige|mise en demeure|clause|rgpd|plainte)\b/i;
const URGENT = /\b(urgent|urgence|asap|immédiatement|immediatement)\b/i;

/**
 * Détection d'instructions adressées à un assistant IA dans un contenu externe.
 * Ce n'est PAS la protection principale (qui est structurelle : un e-mail ne peut
 * jamais accorder de droits), seulement un signal pour l'utilisateur.
 */
const SUSPICIOUS = /(ignore (all |the )?(previous|prior) instructions|ignore[zr]? (les|toutes les) instructions|you are (now )?an? (ai|assistant)|assistant ia|en tant qu'assistant|transf[ée]re[rz]? (tous|toutes|l'ensemble)|forward (all|every)|nouvelles? instructions?|system prompt|mot de passe|password|send (me )?(all|the) (invoices|files|data))/i;

export function detectExceptions(input: { subject: string; text: string; hasAttachments: boolean; ccCount: number; alreadyReplied: boolean }): string[] {
  const hay = `${input.subject}\n${input.text}`;
  const out: string[] = [];
  if (AMOUNT.test(hay)) out.push("amount");
  if (input.hasAttachments) out.push("attachment");
  if (LEGAL.test(hay)) out.push("legal");
  if (input.ccCount > 0) out.push("external_cc");
  if (URGENT.test(hay)) out.push("urgent");
  if (input.alreadyReplied) out.push("already_replied");
  if (SUSPICIOUS.test(hay)) out.push("suspicious");
  return out;
}

export function looksLikeInjection(text: string): boolean {
  return SUSPICIOUS.test(text);
}

export function isMeetingRequest(subject: string, text: string) {
  const hay = `${subject}\n${text}`;
  return MEETING.test(hay) && REQUEST.test(hay);
}

/** Extrait les adresses e-mail écrites par l'utilisateur lui-même (provenance « utilisateur »). */
export function emailsIn(text: string): string[] {
  return [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map((s) => s.toLowerCase()))];
}
