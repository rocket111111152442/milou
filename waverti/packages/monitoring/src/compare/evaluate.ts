/**
 * Comparaison d'une observation avec la précédente et évaluation de la condition.
 * Règle anti-répétition : une alerte n'est émise que lors d'une TRANSITION vers l'état
 * recherché (ex. passage sous le seuil), pas à chaque contrôle où la condition reste vraie.
 */
import type { LegacyPageCondition, PageObservation } from "@waverti/types";
import { formatPrice } from "@waverti/types";
import { normalizeForMatch } from "../extract/text";
import { changeRatio, diffSentences } from "./similarity";
import { availabilityIsReliable, priceIsReliable } from "./reliability";

export type AlertKind = "price" | "stock" | "page_change" | "keyword" | "web_topic";

export interface Evaluation {
  outcome: "ok" | "changed" | "triggered" | "error";
  triggered: boolean;
  summary: string;
  value: string | null;
  alert: { kind: AlertKind; title: string; body: string } | null;
  changeSummary: Record<string, unknown> | null;
  errorCode: string | null;
}

export const SIGNIFICANT_CHANGE_RATIO = 0.02;

const availabilityLabel: Record<string, string> = {
  in_stock: "En stock",
  out_of_stock: "Rupture",
  preorder: "Précommande",
  unknown: "Inconnue",
};

function priceChange(prev: PageObservation | null, curr: PageObservation) {
  if (!priceIsReliable(prev) || !priceIsReliable(curr) || (prev!.currency ?? "EUR") !== (curr.currency ?? "EUR") || prev!.price === curr.price) return null;
  return { from: prev!.price!, to: curr.price!, delta: Math.round((curr.price! - prev!.price!) * 100) / 100 };
}

export function evaluatePage(condition: LegacyPageCondition, prev: PageObservation | null, curr: PageObservation, taskName: string): Evaluation {
  const value =
    condition.type === "price_below" || condition.type === "price_drop"
      ? priceIsReliable(curr)
        ? formatPrice(curr.price!, curr.currency ?? "EUR")
        : null
      : condition.type === "back_in_stock"
        ? availabilityLabel[curr.availability] ?? null
        : null;

  if (curr.httpStatus >= 400) {
    return {
      outcome: "error",
      triggered: false,
      summary: `La page a répondu avec le code HTTP ${curr.httpStatus}.`,
      value,
      alert: null,
      changeSummary: null,
      errorCode: `http_${curr.httpStatus}`,
    };
  }

  const pc = priceChange(prev, curr);
  const base = { value, changeSummary: pc ? { price: pc } : null, errorCode: null };

  switch (condition.type) {
    case "price_below": {
      if (!priceIsReliable(curr)) {
        return curr.price === null
          ? { ...base, outcome: "error", triggered: false, summary: "Aucun prix fiable n'a été trouvé sur la page.", alert: null, errorCode: "price_not_found" }
          : { ...base, outcome: "ok", triggered: false, summary: "Prix détecté mais incertain : aucune alerte de prix n'est déclenchée.", alert: null };
      }
      const below = curr.price! < condition.threshold && (!condition.currency || (curr.currency ?? "EUR") === condition.currency);
      const wasBelow = priceIsReliable(prev) && prev!.price! < condition.threshold && (!condition.currency || (prev!.currency ?? "EUR") === condition.currency);
      if (below && !wasBelow) {
        return {
          ...base,
          outcome: "triggered",
          triggered: true,
          summary: `Prix relevé : ${formatPrice(curr.price!, curr.currency ?? "EUR")} (seuil ${formatPrice(condition.threshold, condition.currency)}).`,
          alert: {
            kind: "price",
            title: `Le prix est passé sous ${formatPrice(condition.threshold, condition.currency)}`,
            body: `${taskName} : ${formatPrice(curr.price!, curr.currency ?? "EUR")}${priceIsReliable(prev) ? ` au lieu de ${formatPrice(prev!.price!, prev!.currency ?? "EUR")}` : ""}.`,
          },
        };
      }
      return {
        ...base,
        outcome: pc ? "changed" : "ok",
        triggered: false,
        summary: pc
          ? `Prix : ${formatPrice(pc.from, curr.currency ?? "EUR")} → ${formatPrice(pc.to, curr.currency ?? "EUR")}${below ? " (toujours sous le seuil)" : ", au-dessus du seuil"}.`
          : `Prix inchangé : ${formatPrice(curr.price!, curr.currency ?? "EUR")}.`,
        alert: null,
      };
    }
    case "price_drop": {
      if (!priceIsReliable(curr)) {
        return curr.price === null
          ? { ...base, outcome: "error", triggered: false, summary: "Aucun prix fiable n'a été trouvé sur la page.", alert: null, errorCode: "price_not_found" }
          : { ...base, outcome: "ok", triggered: false, summary: "Prix détecté mais incertain : aucune alerte de prix n'est déclenchée.", alert: null };
      }
      if (!priceIsReliable(prev)) {
        return { ...base, outcome: "ok", triggered: false, summary: `Prix de référence enregistré : ${formatPrice(curr.price!, curr.currency ?? "EUR")}.`, alert: null };
      }
      if ((prev!.currency ?? "EUR") !== (curr.currency ?? "EUR")) return { ...base, outcome: "error", triggered: false, summary: "La devise a changé : aucune baisse comparable n'est calculée.", alert: null, errorCode: "currency_mismatch" };
      const dropPct = ((prev!.price! - curr.price!) / prev!.price!) * 100;
      if (curr.price! < prev!.price! && dropPct >= condition.minPercent) {
        return {
          ...base,
          outcome: "triggered",
          triggered: true,
          summary: `Baisse de ${dropPct.toFixed(1).replace(".", ",")} % : ${formatPrice(prev!.price!, curr.currency ?? "EUR")} → ${formatPrice(curr.price!, curr.currency ?? "EUR")}.`,
          alert: {
            kind: "price",
            title: `Baisse de prix : ${formatPrice(curr.price!, curr.currency ?? "EUR")}`,
            body: `${taskName} : ${formatPrice(prev!.price!, curr.currency ?? "EUR")} → ${formatPrice(curr.price!, curr.currency ?? "EUR")} (−${dropPct.toFixed(1).replace(".", ",")} %).`,
          },
        };
      }
      return {
        ...base,
        outcome: pc ? "changed" : "ok",
        triggered: false,
        summary: pc ? `Prix : ${formatPrice(pc.from, curr.currency ?? "EUR")} → ${formatPrice(pc.to, curr.currency ?? "EUR")}.` : `Prix inchangé : ${formatPrice(curr.price!, curr.currency ?? "EUR")}.`,
        alert: null,
      };
    }
    case "back_in_stock": {
      if (!availabilityIsReliable(curr)) {
        return { ...base, outcome: "error", triggered: false, summary: "La disponibilité n'a pas pu être déterminée sur la page.", alert: null, errorCode: "availability_unknown" };
      }
      const backNow = curr.availability === "in_stock" && prev?.availability === "out_of_stock";
      if (backNow) {
        return {
          ...base,
          outcome: "triggered",
          triggered: true,
          summary: "Le produit est de nouveau disponible.",
          alert: { kind: "stock", title: "De nouveau en stock", body: `${taskName} est de nouveau disponible${curr.price !== null ? ` à ${formatPrice(curr.price)}` : ""}.` },
        };
      }
      const changed = prev && prev.availability !== curr.availability;
      return {
        ...base,
        outcome: changed ? "changed" : "ok",
        triggered: false,
        summary: changed
          ? `Disponibilité : ${availabilityLabel[prev.availability]} → ${availabilityLabel[curr.availability]}.`
          : `Disponibilité : ${availabilityLabel[curr.availability]}.`,
        alert: null,
      };
    }
    case "page_changed": {
      if (!prev) {
        return { ...base, outcome: "ok", triggered: false, summary: "Version de référence de la page enregistrée.", alert: null };
      }
      const stableHashAvailable = Boolean(prev.contentHash && curr.contentHash);
      const unchanged = stableHashAvailable
        ? prev.contentHash === curr.contentHash && prev.excerpt === curr.excerpt
        : prev.textHash === curr.textHash;
      if (unchanged) {
        return { ...base, outcome: "ok", triggered: false, summary: "Aucune modification du contenu.", alert: null };
      }
      const ratio = changeRatio(prev.excerpt, curr.excerpt);
      const diff = diffSentences(prev.excerpt, curr.excerpt);
      const significant = condition.sensitivity === "any" || ratio >= SIGNIFICANT_CHANGE_RATIO;
      const changeSummary = { ratio: Math.round(ratio * 1000) / 1000, ...diff, ...(pc ? { price: pc } : {}) };
      if (!significant) {
        return { ...base, outcome: "ok", triggered: false, summary: "Variation mineure ignorée (moins de 2 % du contenu).", alert: null, changeSummary };
      }
      const pct = Math.max(1, Math.round(ratio * 100));
      const first = diff.added[0] ?? diff.removed[0];
      return {
        ...base,
        changeSummary,
        outcome: "triggered",
        triggered: true,
        summary: `Contenu modifié (environ ${pct} %).${first ? ` Ex. : « ${first.slice(0, 120)} »` : ""}`,
        alert: {
          kind: "page_change",
          title: "La page a été modifiée",
          body: `${taskName} : environ ${pct} % du contenu a changé.${diff.added[0] ? ` Nouveau : « ${diff.added[0].slice(0, 160)} »` : ""}`,
        },
      };
    }
    case "text_appears":
    case "text_disappears": {
      const needle = normalizeForMatch(condition.text);
      const has = (o: PageObservation | null) => (o ? normalizeForMatch(o.excerpt).includes(needle) : null);
      const now = has(curr)!;
      const before = has(prev);
      const appears = condition.type === "text_appears";
      const transition = before !== null && before !== now && now === appears;
      if (transition) {
        return {
          ...base,
          outcome: "triggered",
          triggered: true,
          summary: appears ? `Le texte « ${condition.text} » est apparu.` : `Le texte « ${condition.text} » a disparu.`,
          alert: {
            kind: "keyword",
            title: appears ? `« ${condition.text} » est apparu` : `« ${condition.text} » a disparu`,
            body: `${taskName} : ${appears ? "le texte recherché figure désormais sur la page" : "le texte recherché n'apparaît plus sur la page"}.`,
          },
        };
      }
      return {
        ...base,
        outcome: "ok",
        triggered: false,
        summary: now ? `Le texte « ${condition.text} » est présent.` : `Le texte « ${condition.text} » est absent.`,
        alert: null,
      };
    }
  }
}
