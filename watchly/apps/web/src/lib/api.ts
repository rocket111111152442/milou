import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { QuotaError, BillingError } from "@watchly/billing";
import { BusinessError } from "@watchly/monitoring/business";
import { authenticateRequest, type RequestActor } from "./auth";
import { DatabaseUnavailableError } from "./db";
import { rateLimit } from "./rate-limit";

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function apiError(status: number, error: string, message?: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, message: message ?? error, ...extra }, { status, headers: { "cache-control": "no-store" } });
}

const MAX_BODY_BYTES = 64 * 1024;

export async function readJson<T extends z.ZodType>(req: Request, schema: T): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: NextResponse }> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return { ok: false, res: apiError(413, "payload_too_large") };
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return { ok: false, res: apiError(413, "payload_too_large") };
    body = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, res: apiError(400, "invalid_json", "Requête invalide.") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      res: apiError(422, "validation_error", "Certaines informations sont invalides.", {
        issues: parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message })),
      }),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Vérifie l'origine des requêtes à cookies (protection CSRF en plus de SameSite=Lax). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.method === "GET" || req.method === "HEAD";
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

type Handler = (req: Request, actor: RequestActor, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/**
 * Enveloppe commune des routes API authentifiées : authentification (session ou appareil),
 * contrôle d'origine pour les sessions, limitation de débit par utilisateur, erreurs normalisées
 * (sans fuite de détails internes dans la réponse).
 */
export function withActor(
  handler: Handler,
  opts: { allowDevice?: boolean; rate?: { limit: number; windowSec: number; name: string } } = {},
) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      const actor = await authenticateRequest(req);
      if (!actor) return apiError(401, "unauthorized", "Authentification requise.");
      if (actor.kind === "device" && !opts.allowDevice) return apiError(403, "forbidden");
      if (actor.kind === "user" && req.method !== "GET" && !sameOrigin(req)) return apiError(403, "bad_origin");
      if (opts.rate) {
        const r = await rateLimit(`${opts.rate.name}:${actor.userId}`, opts.rate.limit, opts.rate.windowSec);
        if (!r.ok) return apiError(429, "rate_limited", "Trop de requêtes, réessayez plus tard.", { retryAfter: r.retryAfterSec });
      }
      return await handler(req, actor, ctx);
    } catch (err) {
      return handleApiError(err);
    }
  };
}

export function handleApiError(err: unknown): Response {
  if (err instanceof QuotaError) return apiError(403, err.code, err.message);
  if (err instanceof BusinessError) {
    const status = err.code === "not_found" ? 404 : err.code === "duplicate" || err.code === "too_soon" ? 409 : 422;
    return apiError(status, err.code, err.message);
  }
  if (err instanceof ZodError) return apiError(400, "invalid_input", "Données invalides.", { issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  if (err instanceof BillingError) return apiError(err.code === "not_configured" ? 503 : 409, err.code, err.message);
  if (err instanceof DatabaseUnavailableError) return apiError(503, "not_configured", "Service non configuré.");
  console.error("api_error", (err as Error)?.name, (err as Error)?.message?.slice(0, 200));
  return apiError(500, "internal_error", "Une erreur est survenue.");
}
