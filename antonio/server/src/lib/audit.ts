import { db, schema } from "../db/client.js";

/** Journal de sécurité : jamais de secret, de jeton ou de contenu de message. */
export async function audit(type: string, opts: { orgId?: string | null; userId?: string | null; meta?: Record<string, unknown> } = {}) {
  const meta = redact(opts.meta ?? {});
  await db()
    .insert(schema.auditEvents)
    .values({ type, orgId: opts.orgId ?? null, userId: opts.userId ?? null, meta })
    .catch(() => undefined);
}

const SECRET_KEYS = /token|secret|password|authorization|code_verifier|refresh|access/i;
export function redact<T>(value: T): T {
  if (Array.isArray(value)) return value.map(redact) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? "[masqué]" : redact(v);
    }
    return out as T;
  }
  return value;
}

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const notFound = (what = "Ressource") => new AppError(404, "not_found", `${what} introuvable`);
export const forbidden = (msg = "Accès refusé") => new AppError(403, "forbidden", msg);
export const badRequest = (msg: string) => new AppError(400, "bad_request", msg);
