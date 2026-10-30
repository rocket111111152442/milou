import type { Database } from "@waverti/database";
import type { BrowserPool } from "@waverti/monitoring/browser";
import { HostPoliteness, RobotsCache, type SafeFetchOptions } from "@waverti/monitoring";
import type { SearchProvider } from "@waverti/monitoring/search";
import type { EmailSender } from "@waverti/notifications";
import type { WorkerConfig } from "./config";

export interface WorkerContext {
  config: WorkerConfig;
  db: Database;
  fetchOptions: SafeFetchOptions;
  robots: RobotsCache;
  politeness: HostPoliteness;
  browser: BrowserPool | null;
  search: SearchProvider | null;
  email: EmailSender | null;
  counters: { succeeded: number; failed: number };
}

export function makeFetchOptions(config: WorkerConfig): SafeFetchOptions {
  return config.allowPrivate ? { allowLoopback: true, allowAnyPort: true } : {};
}

export { HostPoliteness, RobotsCache };
