/**
 * Calcul de la prochaine vérification : intervalle de la surveillance (jamais inférieur au
 * minimum de la formule) + décalage stable par surveillance pour lisser la charge.
 */
export function stableJitterSeconds(taskId: string, maxSeconds: number): number {
  let h = 2166136261;
  for (let i = 0; i < taskId.length; i++) {
    h ^= taskId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % Math.max(1, maxSeconds);
}

export function effectiveInterval(requestedMinutes: number, planMinimumMinutes: number): number {
  return Math.max(requestedMinutes, planMinimumMinutes);
}

/**
 * Prochaine exécution après `from`. Si des créneaux ont été manqués (PC éteint, panne),
 * on ne les rattrape pas en rafale : on planifie le prochain créneau futur.
 */
export function computeNextRun(params: { from: Date; intervalMinutes: number; previousNextRun?: Date | null; now?: Date }): Date {
  const now = params.now ?? new Date();
  const step = params.intervalMinutes * 60_000;
  let next = (params.previousNextRun ?? params.from).getTime() + step;
  if (next <= now.getTime()) {
    const missed = Math.ceil((now.getTime() - next) / step);
    next += missed * step;
    if (next <= now.getTime()) next += step;
  }
  return new Date(next);
}

/** Délai de reprise après erreur : exponentiel, borné par l'intervalle normal. */
export function retryDelayMinutes(consecutiveErrors: number, intervalMinutes: number): number {
  const base = Math.min(intervalMinutes, 15 * 2 ** Math.max(0, consecutiveErrors - 1));
  return Math.max(5, base);
}
