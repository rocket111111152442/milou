import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MAIL_CATEGORIES } from "@antonio/shared";
import { actorOf } from "../app.js";
import { notFound } from "../lib/audit.js";
import { getProfile } from "../lib/profile.js";
import { findFreeSlots } from "../lib/time.js";
import { awaitingReplies, getMessageDetail, listEvents, listMessages, listTasks } from "../mail/data.js";
import { correctCategory } from "../rules/engine.js";
import { proposeAction } from "../actions/service.js";
import { latestBriefing, generateBriefing, toBriefingDTO } from "../briefing/service.js";
import { db, schema } from "../db/client.js";
import { and, eq } from "drizzle-orm";

const csvCell = (s: string | null | undefined) => `"${String(s ?? "").replace(/"/g, '""')}"`;

export async function dataRoutes(app: FastifyInstance) {
  app.get("/api/messages", async (req) => {
    const u = actorOf(req);
    const q = z
      .object({
        category: z.enum(MAIL_CATEGORIES).optional(),
        needsAction: z.enum(["true", "false"]).optional(),
        text: z.string().max(200).optional(),
        trash: z.enum(["true", "false"]).optional(),
        sent: z.enum(["true", "false"]).optional(),
        ids: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      })
      .parse(req.query);
    return {
      messages: await listMessages(u, {
        category: q.category,
        needsAction: q.needsAction ? q.needsAction === "true" : undefined,
        text: q.text,
        onlyTrash: q.trash === "true",
        sent: q.sent ? q.sent === "true" : undefined,
        ids: q.ids ? q.ids.split(",").filter(Boolean) : undefined,
        limit: q.limit,
      }),
    };
  });
  app.get("/api/messages/awaiting", async (req) => {
    const days = z.coerce.number().int().min(1).max(60).default(3).parse((req.query as { days?: string }).days);
    return { messages: await awaitingReplies(actorOf(req), days) };
  });
  app.get("/api/messages/:id", async (req) => ({ message: await getMessageDetail(actorOf(req), (req.params as { id: string }).id) }));
  app.patch("/api/messages/:id/category", async (req) => {
    const u = actorOf(req);
    const body = z.object({ category: z.enum(MAIL_CATEGORIES) }).parse(req.body);
    const m = await correctCategory(u.userId, (req.params as { id: string }).id, body.category);
    if (!m) throw notFound("Message");
    return { ok: true };
  });

  app.get("/api/events", async (req) => {
    const u = actorOf(req);
    const q = z.object({ from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional(), ids: z.string().optional() }).parse(req.query);
    const from = q.from ? new Date(q.from) : new Date(Date.now() - 86400_000);
    const to = q.to ? new Date(q.to) : new Date(Date.now() + 14 * 86400_000);
    return { events: await listEvents(u, from, to, q.ids ? q.ids.split(",").filter(Boolean) : undefined) };
  });

  app.get("/api/slots", async (req) => {
    const u = actorOf(req);
    const q = z.object({ duration: z.coerce.number().int().min(10).max(480).default(30), days: z.coerce.number().int().min(1).max(30).default(7) }).parse(req.query);
    const profile = await getProfile(u.userId);
    const busy = (await listEvents(u, new Date(), new Date(Date.now() + (q.days + 1) * 86400_000))).map((e) => ({ start: new Date(e.start), end: new Date(e.end) }));
    const slots = findFreeSlots({ from: new Date(), days: q.days, durationMin: q.duration, bufferMin: profile.meetingPrefs.bufferMin, prefs: profile, busy, count: 8 });
    return { slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })) };
  });

  app.get("/api/tasks", async (req) => {
    const q = z.object({ status: z.enum(["open", "done"]).optional(), ids: z.string().optional() }).parse(req.query);
    return { tasks: await listTasks(actorOf(req), { status: q.status, ids: q.ids ? q.ids.split(",").filter(Boolean) : undefined }) };
  });
  app.post("/api/tasks", async (req) => {
    const u = actorOf(req);
    const body = z.object({ title: z.string().min(1).max(300), dueAt: z.string().datetime({ offset: true }).nullable().optional(), notes: z.string().max(5000).nullable().optional() }).parse(req.body);
    const r = await proposeAction(u, { kind: "task.create", params: { title: body.title, dueAt: body.dueAt ?? null, notes: body.notes ?? null, sourceMessageId: null }, origin: "user" });
    return r;
  });
  app.post("/api/tasks/:id/complete", async (req) => {
    const u = actorOf(req);
    return proposeAction(u, { kind: "task.complete", params: { taskId: (req.params as { id: string }).id }, origin: "user", idempotencyKey: `user:task.complete:${(req.params as { id: string }).id}` });
  });
  /** Export clairement identifié (pas une synchronisation) pour les outils sans connexion exploitable. */
  app.get("/api/tasks/export.csv", async (req, reply) => {
    const tasks = await listTasks(actorOf(req));
    const lines = ["titre,echeance,statut,notes,origine", ...tasks.map((t) => [csvCell(t.title), csvCell(t.dueAt), csvCell(t.status), csvCell(t.notes), csvCell(t.createdBy)].join(","))];
    reply.header("Content-Type", "text/csv; charset=utf-8").header("Content-Disposition", 'attachment; filename="antonio-taches-export.csv"');
    return `﻿${lines.join("\n")}`;
  });

  app.get("/api/briefings/latest", async (req) => ({ briefing: await latestBriefing(actorOf(req)) }));
  app.post("/api/briefings", async (req) => ({ briefing: await generateBriefing(actorOf(req), "on_demand") }));
  app.get("/api/briefings/:id", async (req) => {
    const u = actorOf(req);
    const [row] = await db()
      .select()
      .from(schema.briefings)
      .where(and(eq(schema.briefings.id, (req.params as { id: string }).id), eq(schema.briefings.userId, u.userId)));
    if (!row) throw notFound("Point");
    return { briefing: toBriefingDTO(row) };
  });
}
