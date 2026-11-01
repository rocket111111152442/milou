/**
 * Réservation atomique d'un appel Brave. Tout appel facturable passe ici AVANT d'être émis :
 *  1. plafond global de la plateforme (compteur atomique partagé par tous les workers et toutes les fonctions) ;
 *  2. quota de la période de l'abonnement de l'utilisateur ;
 *  3. quota journalier (période d'essai).
 * Chaque étape est un incrément conditionnel en une seule requête SQL : deux workers simultanés ne peuvent pas dépasser
 * ensemble une limite. Si une étape refuse, les précédentes sont restituées.
 * `release()` restitue tout (appel certainement non facturé : refus 429, requête jamais partie) ;
 * `releaseUserOnly()` ne rend que le quota de l'utilisateur et GARDE la dépense globale (appel peut-être facturé :
 * délai dépassé, erreur serveur, réponse illisible) : le compteur de dépense ne sous-estime jamais.
 */
export interface Reservation {
  release(): Promise<void>;
  releaseUserOnly(): Promise<void>;
}

import { consumeUsage, releaseUsage, usagePeriod, type Database } from "@waverti/database";
import { BudgetExceededError } from "./errors";

export interface ReserveInput {
  db: Database;
  userId: string;
  /** Clé du compteur de période de l'utilisateur (voir billing/search-quota). */
  period: string;
  periodLimit: number;
  dailyLimit: number | null;
  /** Nombre maximal d'appels Brave du mois civil (plafond global). */
  globalMonthlyRequests: number;
  now?: Date;
}

export async function reserveBraveCall(input: ReserveInput): Promise<Reservation> {
  const { db, userId } = input;
  const now = input.now ?? new Date();
  const undo: Array<() => Promise<void>> = [];
  const userUndo: Array<() => Promise<void>> = [];
  const rollback = async () => {
    for (const u of [...undo].reverse()) await u();
  };
  const globalPeriod = usagePeriod("month", now);
  const g = await consumeUsage(db, { userId: null, metric: "brave_api_global", period: globalPeriod, limit: input.globalMonthlyRequests });
  if (g === null) throw new BudgetExceededError("global", "Plafond mensuel global des appels Brave atteint");
  undo.push(() => releaseUsage(db, { userId: null, metric: "brave_api_global", period: globalPeriod }));

  const m = await consumeUsage(db, { userId, metric: "brave_search", period: input.period, limit: input.periodLimit });
  if (m === null) {
    await rollback();
    throw new BudgetExceededError("user_month", "Quota de recherches de la période atteint pour votre formule");
  }
  const releaseMonth = () => releaseUsage(db, { userId, metric: "brave_search", period: input.period });
  undo.push(releaseMonth);
  userUndo.push(releaseMonth);

  if (input.dailyLimit !== null) {
    const day = usagePeriod("day", now);
    const d = await consumeUsage(db, { userId, metric: "brave_search", period: day, limit: input.dailyLimit });
    if (d === null) {
      await rollback();
      throw new BudgetExceededError("user_day", "Quota journalier de recherches atteint (période d'essai)");
    }
    const releaseDay = () => releaseUsage(db, { userId, metric: "brave_search", period: day });
    undo.push(releaseDay);
    userUndo.push(releaseDay);
  }
  return {
    release: async () => {
      for (const u of [...undo].reverse()) await u();
    },
    releaseUserOnly: async () => {
      for (const u of [...userUndo].reverse()) await u();
    },
  };
}
