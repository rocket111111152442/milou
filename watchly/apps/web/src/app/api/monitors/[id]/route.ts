import { isUuid } from "@watchly/database";
import { deleteMonitor, updateMonitor } from "@watchly/monitoring";
import { updateMonitorSchema } from "@watchly/types";
import { apiError, json, readJson, withActor } from "@/lib/api";
import { conditionLabel, getMonitorDetail, toResultView } from "@/lib/data/monitors";
import { getDb } from "@/lib/db";
import { monitorError } from "@/lib/monitor-api";

export const GET = withActor(
  async (_req, actor, ctx) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError(404, "not_found");
    const d = await getMonitorDetail(actor.userId, id!);
    if (!d) return apiError(404, "not_found", "Surveillance introuvable.");
    return json({
      monitor: {
        id: d.task.id,
        name: d.task.name,
        kind: d.task.kind,
        status: d.task.status,
        condition: d.task.condition,
        conditionLabel: conditionLabel(d.task.condition),
        executionMode: d.task.executionMode,
        notify: { inapp: d.task.notifyInapp, email: d.task.notifyEmail, desktop: d.task.notifyDesktop },
        url: d.target?.url ?? null,
        cssSelector: d.target?.cssSelector ?? null,
        topic: d.target?.topic ?? null,
        officialDomains: d.target?.officialDomains ?? [],
        intervalMinutes: d.schedule?.intervalMinutes ?? null,
        nextRunAt: d.schedule?.nextRunAt?.toISOString() ?? null,
        lastError: d.task.lastError,
      },
      results: d.results.map((r) => toResultView(r, d.task.condition)),
    });
  },
  { allowDevice: true },
);

export const PATCH = withActor(
  async (req, actor, ctx) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError(404, "not_found");
    const body = await readJson(req, updateMonitorSchema);
    if (!body.ok) return body.res;
    try {
      await updateMonitor(getDb(), actor.userId, id!, body.data);
      return json({ ok: true });
    } catch (err) {
      return monitorError(err);
    }
  },
  { allowDevice: true, rate: { name: "monitor_write", limit: 200, windowSec: 3600 } },
);

export const DELETE = withActor(
  async (_req, actor, ctx) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError(404, "not_found");
    try {
      await deleteMonitor(getDb(), actor.userId, id!);
      return json({ ok: true });
    } catch (err) {
      return monitorError(err);
    }
  },
  { allowDevice: true, rate: { name: "monitor_write", limit: 200, windowSec: 3600 } },
);
