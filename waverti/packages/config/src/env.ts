/**
 * Validation centralisée des variables d'environnement.
 * Chaque service n'exige que ce dont il a besoin ; une intégration absente est signalée
 * explicitement (feature désactivée) au lieu d'être simulée.
 */
import { z } from "zod";

const optionalUrl = z.string().url().optional();
const optional = z.string().min(1).optional();

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_DIRECT: optional,
  /** Clé de chiffrement des secrets de double authentification (32 octets, base64 ou hexadécimal). */
  WAVERTI_ENCRYPTION_KEY: optional,
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  STRIPE_API_BASE: optionalUrl,
  RESEND_API_KEY: optional,
  RESEND_API_BASE: optionalUrl,
  /** Alternative gratuite à Resend : serveur SMTP (smtp://… ou smtps://…). */
  SMTP_URL: optional,
  EMAIL_FROM: z.string().default("Waverti <alertes@waverti.invalid>"),
  BRAVE_SEARCH_API_KEY: optional,
  /** Ancien nom accepté (variable créée sous ce nom sur Vercel) ; BRAVE_SEARCH_API_KEY est prioritaire. */
  BRAVE_API_KEY: optional,
  BRAVE_SEARCH_API_BASE: optionalUrl,
  WAVERTI_HASH_PEPPER: z.string().min(32).optional(),
  WAVERTI_ALLOW_PRIVATE_TARGETS: z.enum(["0", "1"]).default("0"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function readServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Configuration invalide : ${fields}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.WAVERTI_ALLOW_PRIVATE_TARGETS === "1") {
    throw new Error("WAVERTI_ALLOW_PRIVATE_TARGETS est interdit en production");
  }
  return parsed.data;
}

export interface IntegrationStatus {
  auth: boolean;
  email: boolean;
  stripe: boolean;
  resend: boolean;
  braveSearch: boolean;
}

export function integrationStatus(env: Partial<ServerEnv>): IntegrationStatus {
  return {
    auth: Boolean(env.DATABASE_URL && env.WAVERTI_HASH_PEPPER),
    email: Boolean(env.RESEND_API_KEY || env.SMTP_URL),
    stripe: Boolean(env.STRIPE_WEBHOOK_SECRET) && ["test", "live"].includes(billingMode(env as Record<string, string | undefined>)),
    resend: Boolean(env.RESEND_API_KEY),
    braveSearch: Boolean(braveApiKey(env)),
  };
}

export type BillingMode = "absent" | "test" | "live_blocked" | "live";

/**
 * Mode de facturation déduit de la clé secrète (jamais affichée) :
 * - absent : aucune clé ;
 * - test : clé sk_test_/rk_test_ (paiements fictifs uniquement) ;
 * - live_blocked : clé live présente mais paiements réels non autorisés (WAVERTI_ALLOW_LIVE_PAYMENTS absent) ;
 * - live : paiements réels explicitement autorisés.
 */
export function billingMode(env: Record<string, string | undefined> = process.env): BillingMode {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return "absent";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) {
    return env.WAVERTI_ALLOW_LIVE_PAYMENTS === "I_HAVE_LEGAL_APPROVAL" ? "live" : "live_blocked";
  }
  return "absent";
}

/** Refuse les clés Stripe live tant que le lancement commercial n'est pas validé. */
export function assertStripeTestMode(secretKey: string | undefined): void {
  if (!secretKey) return;
  if (secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_")) {
    if (process.env.WAVERTI_ALLOW_LIVE_PAYMENTS !== "I_HAVE_LEGAL_APPROVAL") {
      throw new Error(
        "Clé Stripe live refusée : les paiements réels sont désactivés tant que le cadre légal n'est pas validé.",
      );
    }
  }
}

/** Clé Brave Search : BRAVE_SEARCH_API_KEY, ou BRAVE_API_KEY (ancien nom) à défaut. */
export function braveApiKey(env: Partial<Record<"BRAVE_SEARCH_API_KEY" | "BRAVE_API_KEY", string | undefined>>): string | undefined {
  return env.BRAVE_SEARCH_API_KEY || env.BRAVE_API_KEY || undefined;
}
