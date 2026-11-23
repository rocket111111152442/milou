import { z } from "zod";

/**
 * Configuration lue depuis l'environnement. Aucun secret n'est jamais renvoyé
 * au navigateur : seules des indications « configuré / non configuré » le sont.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8787),
  APP_BASE_URL: z.string().url().default("http://localhost:5173"),
  /** URL publique du serveur (callbacks OAuth et webhooks). */
  API_PUBLIC_URL: z.string().url().optional(),
  DATABASE_URL: z.string().default("postgresql://antonio:antonio@localhost:5432/antonio_dev"),
  /** Clé AES-256 (32 octets en base64) pour chiffrer les jetons OAuth au repos. */
  APP_ENCRYPTION_KEY: z.string().optional(),
  SESSION_TTL_DAYS: z.coerce.number().default(14),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_TEXT_MODEL: z.string().default("gpt-6-luna"),
  OPENAI_TEXT_REASONING: z.enum(["none", "low", "medium", "high"]).default("low"),
  OPENAI_LIVE_MODEL: z.string().default("gpt-live-1.1"),
  /** Prix utilisés pour l'estimation (USD). Vérifiés sur la page tarifaire OpenAI le 2026-11-23. */
  PRICE_TEXT_INPUT_PER_M: z.coerce.number().default(0.1),
  PRICE_TEXT_CACHED_INPUT_PER_M: z.coerce.number().default(0.01),
  PRICE_TEXT_OUTPUT_PER_M: z.coerce.number().default(0.5),
  PRICE_LIVE_ACTIVE_PER_MIN: z.coerce.number().default(0.05),
  PRICE_LIVE_STANDBY_PER_MIN: z.coerce.number().default(0.02),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Sujet Pub/Sub pour les notifications Gmail (projects/<id>/topics/<nom>). */
  GOOGLE_PUBSUB_TOPIC: z.string().optional(),
  /** Audience attendue dans le jeton OIDC des notifications Pub/Sub (souvent l'URL du webhook). */
  GOOGLE_PUBSUB_AUDIENCE: z.string().optional(),
  GOOGLE_PUBSUB_SERVICE_ACCOUNT: z.string().optional(),

  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT: z.string().default("common"),

  /** Destinataires autorisés pour les envois en environnement de test (séparés par des virgules). */
  TEST_RECIPIENT_ALLOWLIST: z.string().optional(),
  /** Désactive l'exécution des tâches planifiées dans le processus web (le worker s'en charge). */
  RUN_WORKER_IN_WEB: z.coerce.boolean().default(false),
});

export type Config = z.infer<typeof schema>;

let cached: Config | null = null;
export function config(): Config {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
export function resetConfigForTests() {
  cached = null;
}

export function apiPublicUrl(): string {
  const c = config();
  return c.API_PUBLIC_URL ?? `http://localhost:${c.PORT}`;
}

export function providerConfigured(provider: "google" | "microsoft" | "openai"): boolean {
  const c = config();
  if (provider === "google") return Boolean(c.GOOGLE_CLIENT_ID && c.GOOGLE_CLIENT_SECRET);
  if (provider === "microsoft") return Boolean(c.MICROSOFT_CLIENT_ID && c.MICROSOFT_CLIENT_SECRET);
  return Boolean(c.OPENAI_API_KEY);
}

export function testRecipientAllowlist(): string[] | null {
  const raw = config().TEST_RECIPIENT_ALLOWLIST;
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
