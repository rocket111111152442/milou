import { createMonitor } from "@waverti/monitoring";
import { createMonitorSchema } from "@waverti/types";
import { json, readJson, withActor } from "@/lib/api";
import { listMonitors } from "@/lib/data/monitors";
import { getDb } from "@/lib/db";
import { monitorError } from "@/lib/monitor-api";

export const GET = withActor(
  async (req, actor) => {
    const u = new URL(req.url);
    const kind = u.searchParams.get("kind");
    const monitors = await listMonitors(actor.userId, {
      kind: kind === "page" || kind === "web_topic" ? kind : undefined,
      q: u.searchParams.get("q")?.slice(0, 80) || undefined,
    });
    return json({ monitors });
  },
  { allowDevice: true },
);

export const POST = withActor(
  async (req, actor) => {
    const body = await readJson(req, createMonitorSchema);
    if (!body.ok) return body.res;
    try {
      const created = await createMonitor(getDb(), actor.userId, body.data);
      return json(created, 201);
    } catch (err) {
      return monitorError(err);
    }
  },
  { allowDevice: true, rate: { name: "monitor_create", limit: 60, windowSec: 3600 } },
);
