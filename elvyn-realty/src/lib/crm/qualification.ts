import { QUALIFICATION, type Temperature } from "@/config/crm";
import type { Criteria } from "@/lib/db/schema";

export interface QualificationInput {
  criteria: Criteria;
  actionRequested: boolean; // visit / reserve / offer / negotiation / human
  specificProperty: boolean;
  budgetUsd: number | null; // null when unknown or not convertible
  priorityThresholdUsd: number;
}
export interface Qualification {
  temperature: Temperature;
  score: number;
  reasons: string[];
  priority: boolean;
  priorityReason: string | null;
}

const IMMEDIATE = /(inmediat|ahora mismo|urgente|urgent|asap|immediately|this month|este mes|esta semana|this week)/;
const AMOUNT = /(\d+(?:[.,]\d+)?)\s*(mes|month|año|ano|year|semana|week)/;
const NEXT_YEAR = /(próximo año|proximo año|next year|el año que viene)/;
const UNDECIDED = /(no s[eé]|sin prisa|no rush|explorando|solo mirando|just looking)/;

/** Parses free-text timelines ("en 2 meses", "next year", "inmediato") into months. */
export function timelineMonths(t: string | null | undefined): number | null {
  if (!t) return null;
  const s = t.toLowerCase();
  if (IMMEDIATE.test(s)) return 0;
  const m = s.match(AMOUNT);
  if (m) {
    const n = Number(m[1].replace(",", "."));
    if (/año|ano|year/.test(m[2])) return n * 12;
    if (/semana|week/.test(m[2])) return n / 4;
    return n;
  }
  if (NEXT_YEAR.test(s)) return 12;
  if (UNDECIDED.test(s)) return 24;
  return null;
}

export function qualify(input: QualificationInput): Qualification {
  const P = QUALIFICATION.points;
  const c = input.criteria;
  let score = 0;
  const reasons: string[] = [];

  if (input.actionRequested) {
    score += P.actionRequest;
    reasons.push("Pidió visita, reserva, negociación o hablar con Elvyn");
  }
  const months = timelineMonths(c.timeline);
  if (months !== null && months <= 3) {
    score += P.timelineShort;
    reasons.push(`Plazo corto (${c.timeline})`);
  } else if (months !== null && months <= 12) {
    score += P.timelineMedium;
    reasons.push(`Plazo medio (${c.timeline})`);
  } else if (c.timeline) {
    reasons.push(`Plazo largo o indefinido (${c.timeline})`);
  } else {
    reasons.push("Plazo no indicado");
  }

  if (c.intent === "sell") {
    const known = [c.propertyTypes?.length, c.zones?.length, c.expectedPrice].filter(Boolean).length;
    if (known >= 2) {
      score += P.seller;
      reasons.push("Propietario con propiedad descrita (tipo, zona o precio)");
    }
  } else {
    const known = [c.propertyTypes?.length, c.zones?.length, c.budgetMax || c.budgetMin].filter(Boolean).length;
    if (known === 3) {
      score += P.precise;
      reasons.push("Búsqueda precisa (tipo, zona y presupuesto)");
    } else if (known === 2) {
      score += P.partlyPrecise;
      reasons.push("Búsqueda parcialmente definida");
    } else {
      reasons.push("Búsqueda poco definida");
    }
    if (c.paymentMethod) {
      score += P.paymentDeclared;
      reasons.push(`Forma de pago declarada: ${c.paymentMethod}`);
    }
  }
  if (input.specificProperty) {
    score += P.specificProperty;
    reasons.push("Interés en una propiedad concreta");
  }

  const temperature: Temperature = score >= QUALIFICATION.hotMin ? "caliente" : score >= QUALIFICATION.warmMin ? "tibio" : "frio";

  let priority = false;
  let priorityReason: string | null = null;
  if (input.budgetUsd !== null && input.budgetUsd >= input.priorityThresholdUsd) {
    priority = true;
    priorityReason = `Presupuesto ≥ US$${input.priorityThresholdUsd.toLocaleString("en-US")}`;
  } else if (c.multipleUnits) {
    priority = true;
    priorityReason = "Interesado en varias unidades";
  }
  return { temperature, score, reasons, priority, priorityReason };
}

/** Budget in USD for the priority rule. DOP is converted only with a configured rate. */
export function budgetInUsd(c: Criteria, usdDopRate: number | null): number | null {
  const amount = c.budgetMax ?? c.budgetMin ?? c.expectedPrice ?? null;
  if (!amount) return null;
  const cur = (c.currency ?? "USD").toUpperCase();
  if (cur === "USD") return amount;
  if (cur === "DOP" && usdDopRate) return amount / usdDopRate;
  return null;
}
