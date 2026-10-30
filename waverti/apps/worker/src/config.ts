import { hostname } from "node:os";
import { z } from "zod";
import { assertStripeTestMode } from "@waverti/config/env";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  WORKER_ID: z.string().min(1).default(`${hostname()}-${process.pid}`),
  WORKER_ROLES: z.string().default("scheduler,pages,web,business,email,maintenance"),
  WORKER_PAGE_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(8),
  WORKER_WEB_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  WORKER_BROWSER_CONCURRENCY: z.coerce.number().int().min(0).max(8).default(2),
  WORKER_BUSINESS_CONCURRENCY: z.coerce.number().int().min(1).max(128).default(16),
  PLAYWRIGHT_CHROMIUM_EXECUTABLE: z.string().optional(),
  BRAVE_SEARCH_API_KEY: z.string().optional(),
  BRAVE_SEARCH_API_BASE: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_API_BASE: z.string().url().optional(),
  EMAIL_FROM: z.string().default("Waverti <alertes@waverti.invalid>"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  STRIPE_SECRET_KEY: z.string().optional(),
  WAVERTI_ALLOW_PRIVATE_TARGETS: z.enum(["0", "1"]).default("0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type WorkerConfig = z.infer<typeof schema> & { roles: Set<string>; allowPrivate: boolean };

export function loadConfig(env: Record<string, string | undefined> = process.env): WorkerConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) throw new Error(`Configuration du worker invalide : ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  const c = parsed.data;
  if (c.NODE_ENV === "production" && c.WAVERTI_ALLOW_PRIVATE_TARGETS === "1") throw new Error("WAVERTI_ALLOW_PRIVATE_TARGETS interdit en production");
  assertStripeTestMode(c.STRIPE_SECRET_KEY);
  return { ...c, roles: new Set(c.WORKER_ROLES.split(",").map((r) => r.trim())), allowPrivate: c.WAVERTI_ALLOW_PRIVATE_TARGETS === "1" };
}
