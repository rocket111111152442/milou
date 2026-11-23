import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ACTION_KINDS, ACTION_STATUSES } from "@antonio/shared";
import { actorOf } from "../app.js";
import {
  actionHistory,
  approveAction,
  cancelAction,
  editAction,
  getOwnedAction,
  listActions,
  proposeAction,
  rejectAction,
  revertAction,
  toActionDTOs,
} from "../actions/service.js";
import { AppError } from "../lib/audit.js";

export async function actionRoutes(app: FastifyInstance) {
  app.get("/api/actions", async (req) => {
    const u = actorOf(req);
    const q = z.object({ status: z.string().optional(), ids: z.string().optional(), days: z.coerce.number().int().min(1).max(365).optional() }).parse(req.query);
    const statuses = q.status ? (q.status.split(",").filter((s) => (ACTION_STATUSES as readonly string[]).includes(s)) as never) : undefined;
    let rows = await listActions(u, { statuses, limit: 200, since: q.days ? new Date(Date.now() - q.days * 86400_000) : undefined });
    if (q.ids) {
      const ids = new Set(q.ids.split(","));
      rows = rows.filter((r) => ids.has(r.id));
    }
    return { actions: await toActionDTOs(rows) };
  });

  app.get("/api/actions/:id", async (req) => {
    const u = actorOf(req);
    const id = (req.params as { id: string }).id;
    const [dto] = await toActionDTOs([await getOwnedAction(u, id)]);
    return { action: dto, history: await actionHistory(u, id) };
  });

  /** Geste direct de l'utilisateur dans l'interface (ex. mettre un message à la corbeille, envoyer un brouillon rédigé). */
  app.post("/api/actions", async (req) => {
    const u = actorOf(req);
    const body = z.object({ kind: z.enum(ACTION_KINDS), params: z.record(z.string(), z.unknown()), clientRequestId: z.string().min(8).max(80) }).parse(req.body);
    const r = await proposeAction(u, { kind: body.kind, params: body.params, origin: "user", idempotencyKey: `user:${body.clientRequestId}` });
    if (!r.ok) throw new AppError(422, "action_refused", `${r.error}${r.missing ? ` — ${r.missing.join(" ; ")}` : ""}`);
    const [dto] = await toActionDTOs([r.action]);
    return { action: dto, created: r.created };
  });

  app.post("/api/actions/:id/approve", async (req) => {
    const u = actorOf(req);
    const body = z.object({ paramsHash: z.string().min(16) }).parse(req.body);
    const a = await approveAction(u, (req.params as { id: string }).id, { paramsHash: body.paramsHash, channel: "ui" });
    const [dto] = await toActionDTOs([a]);
    return { action: dto };
  });

  app.post("/api/actions/:id/reject", async (req) => {
    const [dto] = await toActionDTOs([await rejectAction(actorOf(req), (req.params as { id: string }).id)]);
    return { action: dto };
  });

  app.post("/api/actions/:id/cancel", async (req) => {
    const [dto] = await toActionDTOs([await cancelAction(actorOf(req), (req.params as { id: string }).id)]);
    return { action: dto };
  });

  app.patch("/api/actions/:id", async (req) => {
    const body = z.object({ params: z.record(z.string(), z.unknown()) }).parse(req.body);
    const [dto] = await toActionDTOs([await editAction(actorOf(req), (req.params as { id: string }).id, body.params)]);
    return { action: dto };
  });

  app.post("/api/actions/:id/revert", async (req) => {
    const r = await revertAction(actorOf(req), (req.params as { id: string }).id);
    return { ok: true, result: "action" in r && r.ok ? (await toActionDTOs([r.action]))[0] : null };
  });
}
