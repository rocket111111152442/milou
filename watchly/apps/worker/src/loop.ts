import { logger } from "./logger";

export interface LoopHandle {
  name: string;
  stop(): Promise<void>;
  stats(): { runs: number; errors: number; lastRunAt: string | null; lastError: string | null; lastErrorAt: string | null };
}

/**
 * Boucle périodique robuste : une itération à la fois, erreurs journalisées sans arrêter
 * le processus, arrêt propre en attendant l'itération en cours.
 */
export function startLoop(name: string, intervalMs: number, fn: () => Promise<unknown>): LoopHandle {
  let stopped = false;
  let running: Promise<void> | null = null;
  let timer: NodeJS.Timeout | null = null;
  const s = { runs: 0, errors: 0, lastRunAt: null as string | null, lastError: null as string | null, lastErrorAt: null as string | null };
  const tick = () => {
    if (stopped) return;
    running = (async () => {
      try {
        await fn();
        s.runs++;
      } catch (err) {
        s.errors++;
        s.lastError = (err as Error).message?.slice(0, 200) ?? "error";
        s.lastErrorAt = new Date().toISOString();
        logger.error({ loop: name, err: { message: s.lastError, name: (err as Error).name } }, "loop iteration failed");
      } finally {
        s.lastRunAt = new Date().toISOString();
        running = null;
        if (!stopped) timer = setTimeout(tick, intervalMs);
      }
    })();
  };
  timer = setTimeout(tick, Math.floor(Math.random() * Math.min(intervalMs, 2000)));
  return {
    name,
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await running;
    },
    stats: () => ({ ...s }),
  };
}

/** Exécute des tâches avec une concurrence bornée. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return out;
}
