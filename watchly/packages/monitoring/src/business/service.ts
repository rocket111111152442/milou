/**
 * Gestion des sites professionnels (moteur C). Toutes les écritures passent par ici, côté serveur,
 * avec contrôle des quotas de la formule et du rattachement au domaine vérifié.
 */
import { randomBytes } from "node:crypto";
import {
  and,
  browserTestScenarios,
  businessEndpoints,
  businessSites,
  count,
  eq,
  pgErrorCode,
  PG_UNIQUE_VIOLATION,
  profiles,
  sql,
  type Database,
} from "@watchly/database";
import { checkNewEndpoint, checkNewScenario, checkNewSite, getEntitlements } from "@watchly/billing";
import {
  BLOCKED_ACTION_KEYWORDS,
  endpointInputSchema,
  scenarioInputSchema,
  siteInputSchema,
  type EndpointInput,
  type ScenarioInput,
} from "@watchly/types";
import { InvalidTargetError, parseTargetUrl, type UrlPolicyOptions } from "../net/safe-url";

export class BusinessError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "not_verified"
      | "outside_domain"
      | "invalid_target"
      | "duplicate"
      | "blocked_step"
      | "too_soon",
    message: string,
  ) {
    super(message);
    this.name = "BusinessError";
  }
}

/** L'hôte appartient-il au domaine vérifié (domaine lui-même ou sous-domaine) ? */
export function hostInDomain(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return h === domain || h.endsWith(`.${domain}`);
}

function assertUrlInDomain(raw: string, domain: string, policy: UrlPolicyOptions): string {
  let url: URL;
  try {
    url = parseTargetUrl(raw, policy);
  } catch (err) {
    if (err instanceof InvalidTargetError) throw new BusinessError("invalid_target", err.message);
    throw err;
  }
  if (!policy.allowLoopback && !hostInDomain(url.hostname, domain)) {
    throw new BusinessError("outside_domain", `L'adresse doit appartenir au domaine vérifié ${domain}.`);
  }
  return url.toString();
}

export function newVerificationToken(): string {
  return `watchly-verification=${randomBytes(18).toString("base64url")}`;
}

export async function createSite(db: Database, userId: string, input: unknown): Promise<{ id: string; verificationToken: string }> {
  const data = siteInputSchema.parse(input);
  return db.transaction(async (tx) => {
    // Verrou par utilisateur : deux créations simultanées ne peuvent pas dépasser le quota.
    await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, userId)).for("update");
    const ent = await getEntitlements(tx as unknown as Database, userId);
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(businessSites).where(eq(businessSites.userId, userId));
    checkNewSite(ent, n);
    const token = newVerificationToken();
    try {
      const [row] = await tx
        .insert(businessSites)
        .values({ userId, name: data.name, domain: data.domain, status: "pending_verification", verificationToken: token })
        .returning({ id: businessSites.id });
      return { id: row!.id, verificationToken: token };
    } catch (err) {
      if (pgErrorCode(err) === PG_UNIQUE_VIOLATION) throw new BusinessError("duplicate", "Ce domaine est déjà enregistré dans votre compte.");
      throw err;
    }
  });
}

export async function getOwnedSite(db: Database, userId: string, siteId: string) {
  const [site] = await db
    .select()
    .from(businessSites)
    .where(and(eq(businessSites.id, siteId), eq(businessSites.userId, userId)))
    .limit(1);
  if (!site) throw new BusinessError("not_found", "Site introuvable.");
  return site;
}

export async function deleteSite(db: Database, userId: string, siteId: string): Promise<void> {
  const r = await db
    .delete(businessSites)
    .where(and(eq(businessSites.id, siteId), eq(businessSites.userId, userId)))
    .returning({ id: businessSites.id });
  if (!r.length) throw new BusinessError("not_found", "Site introuvable.");
}

export async function createEndpoint(
  db: Database,
  userId: string,
  siteId: string,
  input: unknown,
  /** Tests uniquement : cibles locales. */
  policy: UrlPolicyOptions = {},
): Promise<{ id: string }> {
  const data: EndpointInput = endpointInputSchema.parse(input);
  return db.transaction(async (tx) => {
    const [site] = await tx
      .select()
      .from(businessSites)
      .where(and(eq(businessSites.id, siteId), eq(businessSites.userId, userId)))
      .for("update")
      .limit(1);
    if (!site) throw new BusinessError("not_found", "Site introuvable.");
    if (site.status !== "verified") throw new BusinessError("not_verified", "Vérifiez d'abord la propriété du site.");
    const url = assertUrlInDomain(data.url, site.domain, policy);
    const ent = await getEntitlements(tx as unknown as Database, userId);
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(businessEndpoints).where(eq(businessEndpoints.siteId, siteId));
    checkNewEndpoint(ent, n);
    const [row] = await tx
      .insert(businessEndpoints)
      .values({
        siteId,
        userId,
        name: data.name,
        url,
        method: data.method,
        expectedStatusMin: data.expectedStatusMin,
        expectedStatusMax: data.expectedStatusMax,
        expectedKeyword: data.expectedKeyword ?? null,
        timeoutMs: data.timeoutMs,
        intervalSeconds: Math.max(60, ent.businessHttpIntervalSeconds || 60),
        nextCheckAt: new Date(),
      })
      .returning({ id: businessEndpoints.id });
    return { id: row!.id };
  });
}

export async function setEndpointEnabled(db: Database, userId: string, endpointId: string, enabled: boolean): Promise<void> {
  const r = await db
    .update(businessEndpoints)
    .set({ enabled, nextCheckAt: new Date(), ...(enabled ? {} : { state: "unknown" as const }) })
    .where(and(eq(businessEndpoints.id, endpointId), eq(businessEndpoints.userId, userId)))
    .returning({ id: businessEndpoints.id });
  if (!r.length) throw new BusinessError("not_found", "Point de contrôle introuvable.");
}

export async function deleteEndpoint(db: Database, userId: string, endpointId: string): Promise<void> {
  const r = await db
    .delete(businessEndpoints)
    .where(and(eq(businessEndpoints.id, endpointId), eq(businessEndpoints.userId, userId)))
    .returning({ id: businessEndpoints.id });
  if (!r.length) throw new BusinessError("not_found", "Point de contrôle introuvable.");
}

/** Refuse les étapes qui pourraient déclencher un achat ou un envoi définitif. */
export function assertSafeSteps(steps: ScenarioInput["steps"]): void {
  for (const [i, step] of steps.entries()) {
    const text = JSON.stringify(step).toLowerCase();
    const hit = BLOCKED_ACTION_KEYWORDS.find((k) => text.includes(k));
    if (hit && (step.action === "click" || step.action === "press")) {
      throw new BusinessError("blocked_step", `Étape ${i + 1} refusée : action potentiellement engageante (« ${hit} »).`);
    }
  }
}

export async function createScenario(
  db: Database,
  userId: string,
  siteId: string,
  input: unknown,
  policy: UrlPolicyOptions = {},
): Promise<{ id: string }> {
  const data = scenarioInputSchema.parse(input);
  assertSafeSteps(data.steps);
  return db.transaction(async (tx) => {
    const [site] = await tx
      .select()
      .from(businessSites)
      .where(and(eq(businessSites.id, siteId), eq(businessSites.userId, userId)))
      .for("update")
      .limit(1);
    if (!site) throw new BusinessError("not_found", "Site introuvable.");
    if (site.status !== "verified") throw new BusinessError("not_verified", "Vérifiez d'abord la propriété du site.");
    const startUrl = assertUrlInDomain(data.startUrl, site.domain, policy);
    const steps = data.steps.map((s) => (s.action === "goto" ? { ...s, url: assertUrlInDomain(s.url, site.domain, policy) } : s));
    const ent = await getEntitlements(tx as unknown as Database, userId);
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(browserTestScenarios).where(eq(browserTestScenarios.siteId, siteId));
    const [{ total } = { total: 0 }] = await tx.select({ total: count() }).from(browserTestScenarios).where(eq(browserTestScenarios.userId, userId));
    checkNewScenario(ent, n, total);
    const [row] = await tx
      .insert(browserTestScenarios)
      .values({
        siteId,
        userId,
        name: data.name,
        startUrl,
        steps,
        intervalMinutes: Math.max(60, ent.businessScenarioIntervalMinutes || 120),
        nextRunAt: new Date(),
      })
      .returning({ id: browserTestScenarios.id });
    return { id: row!.id };
  });
}

export async function setScenarioEnabled(db: Database, userId: string, scenarioId: string, enabled: boolean): Promise<void> {
  const r = await db
    .update(browserTestScenarios)
    .set({ enabled, nextRunAt: new Date() })
    .where(and(eq(browserTestScenarios.id, scenarioId), eq(browserTestScenarios.userId, userId)))
    .returning({ id: browserTestScenarios.id });
  if (!r.length) throw new BusinessError("not_found", "Scénario introuvable.");
}

export async function deleteScenario(db: Database, userId: string, scenarioId: string): Promise<void> {
  const r = await db
    .delete(browserTestScenarios)
    .where(and(eq(browserTestScenarios.id, scenarioId), eq(browserTestScenarios.userId, userId)))
    .returning({ id: browserTestScenarios.id });
  if (!r.length) throw new BusinessError("not_found", "Scénario introuvable.");
}

/** Demande d'exécution immédiate d'un scénario (limitée : au plus une fois toutes les 10 minutes). */
export async function runScenarioSoon(db: Database, userId: string, scenarioId: string): Promise<void> {
  const r = await db.execute<{ id: string }>(sql`
    update browser_test_scenarios set next_run_at = now()
    where id = ${scenarioId} and user_id = ${userId} and enabled
      and (last_run_at is null or last_run_at < now() - interval '10 minutes')
    returning id`);
  if (!r.length) throw new BusinessError("too_soon", "Scénario introuvable, désactivé ou exécuté il y a moins de 10 minutes.");
}
