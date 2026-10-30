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
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  STRIPE_API_BASE: optionalUrl,
  RESEND_API_KEY: optional,
  RESEND_API_BASE: optionalUrl,
  EMAIL_FROM: z.string().default("Waverti <alertes@waverti.invalid>"),
  BRAVE_SEARCH_API_KEY: optional,
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
  supabaseAuth: boolean;
  stripe: boolean;
  resend: boolean;
  braveSearch: boolean;
}

export function integrationStatus(env: Partial<ServerEnv>): IntegrationStatus {
  return {
    supabaseAuth: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    stripe: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
    resend: Boolean(env.RESEND_API_KEY),
    braveSearch: Boolean(env.BRAVE_SEARCH_API_KEY),
  };
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
