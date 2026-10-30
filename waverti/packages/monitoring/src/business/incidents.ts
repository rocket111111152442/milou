/** Ouverture / clôture d'incidents Business, avec historique et notifications. */
import { and, entitlements, eq, incidentEvents, incidents, type Executor } from "@waverti/database";
import { notify } from "@waverti/notifications";
import { formatDuration } from "@waverti/types";

export interface OpenIncidentInput {
  userId: string;
  siteId: string;
  siteName: string;
  kind: "downtime" | "tls" | "scenario";
  endpointId?: string | null;
  scenarioId?: string | null;
  title: string;
  cause: string;
  startedAt: Date;
  lastError?: string | null;
  screenshotId?: string | null;
  failedChecks?: number;
  /** Texte de l'événement « confirmé » (par défaut : second contrôle). */
  confirmation?: string;
  now?: Date;
}

async function priorityFor(db: Executor, userId: string): Promise<"high" | "critical"> {
  const [e] = await db.select({ p: entitlements.priorityAlerts }).from(entitlements).where(eq(entitlements.userId, userId)).limit(1);
  return e?.p ? "critical" : "high";
}

/**
 * Ouvre un incident (au plus un ouvert par point de contrôle / scénario / certificat, garanti par
 * des index uniques) et prévient l'utilisateur. Renvoie null si un incident est déjà ouvert.
 */
export async function openIncident(db: Executor, input: OpenIncidentInput): Promise<string | null> {
  const now = input.now ?? new Date();
  // ON CONFLICT DO NOTHING : les index uniques partiels garantissent un seul incident ouvert,
  // sans interrompre la transaction appelante en cas de concurrence.
  const [row] = await db
    .insert(incidents)
    .values({
      userId: input.userId,
      siteId: input.siteId,
      endpointId: input.endpointId ?? null,
      scenarioId: input.scenarioId ?? null,
      kind: input.kind,
      status: "open",
      title: input.title.slice(0, 300),
      cause: input.cause.slice(0, 1000),
      startedAt: input.startedAt,
      confirmedAt: now,
      lastError: input.lastError?.slice(0, 500) ?? null,
      screenshotId: input.screenshotId ?? null,
      failedChecks: input.failedChecks ?? 1,
    })
    .onConflictDoNothing()
    .returning({ id: incidents.id });
  if (!row) return null;
  const id = row.id;
  await db.insert(incidentEvents).values([
    { incidentId: id, userId: input.userId, at: input.startedAt, type: "detected", message: input.cause.slice(0, 500) },
    { incidentId: id, userId: input.userId, at: now, type: "confirmed", message: input.confirmation ?? "Problème confirmé par un second contrôle." },
  ]);
  const type = input.kind === "downtime" ? "business_down" : input.kind === "tls" ? "business_tls" : "business_scenario";
  const n = await notify(db, {
    userId: input.userId,
    type,
    priority: await priorityFor(db, input.userId),
    title: `${input.siteName} : ${input.title}`.slice(0, 200),
    body: input.cause,
    siteId: input.siteId,
    incidentId: id,
    linkPath: `/app/business/incidents/${id}`,
    dedupKey: `incident:${id}:open`,
    emailPolicy: "alert",
  });
  if (n) await db.insert(incidentEvents).values({ incidentId: id, userId: input.userId, at: now, type: "notified", message: "Alerte envoyée." });
  return id;
}

/** Clôt l'incident ouvert correspondant et envoie l'alerte de rétablissement. */
export async function resolveIncident(
  db: Executor,
  where: { userId: string; siteName: string; endpointId?: string; scenarioId?: string; tlsSiteId?: string },
  message: string,
  now = new Date(),
): Promise<string | null> {
  const cond = where.endpointId
    ? and(eq(incidents.endpointId, where.endpointId), eq(incidents.kind, "downtime"))
    : where.scenarioId
      ? eq(incidents.scenarioId, where.scenarioId)
      : and(eq(incidents.siteId, where.tlsSiteId!), eq(incidents.kind, "tls"));
  const [inc] = await db
    .update(incidents)
    .set({ status: "resolved", resolvedAt: now })
    .where(and(cond, eq(incidents.status, "open"), eq(incidents.userId, where.userId)))
    .returning({ id: incidents.id, siteId: incidents.siteId, title: incidents.title, startedAt: incidents.startedAt });
  if (!inc) return null;
  const duration = formatDuration(Math.round((now.getTime() - inc.startedAt.getTime()) / 1000));
  await db.insert(incidentEvents).values({ incidentId: inc.id, userId: where.userId, at: now, type: "recovered", message: `${message} Durée : ${duration}.` });
  await notify(db, {
    userId: where.userId,
    type: "business_recovered",
    priority: "normal",
    title: `${where.siteName} : rétabli`.slice(0, 200),
    body: `${message} Durée de l'incident : ${duration}.`,
    siteId: inc.siteId,
    incidentId: inc.id,
    linkPath: `/app/business/incidents/${inc.id}`,
    dedupKey: `incident:${inc.id}:resolved`,
    emailPolicy: "alert",
  });
  return inc.id;
}
