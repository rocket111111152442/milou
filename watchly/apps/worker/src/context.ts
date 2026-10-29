import type { Database } from "@watchly/database";
import type { BrowserPool } from "@watchly/monitoring/browser";
import { HostPoliteness, RobotsCache, type SafeFetchOptions } from "@watchly/monitoring";
import type { SearchProvider } from "@watchly/monitoring/search";
import type { EmailSender } from "@watchly/notifications";
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
