import { z } from "zod";
import { and, eq, inArray, isNull, notifications } from "@waverti/database";
import { json, readJson, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";

export const POST = withActor(
  async (req, actor) => {
    const body = await readJson(req, z.union([z.object({ all: z.literal(true) }), z.object({ ids: z.array(z.string().uuid()).min(1).max(200) })]));
    if (!body.ok) return body.res;
    const where =
      "all" in body.data
        ? and(eq(notifications.userId, actor.userId), isNull(notifications.readAt))
        : and(eq(notifications.userId, actor.userId), inArray(notifications.id, body.data.ids));
    await getDb().update(notifications).set({ readAt: new Date() }).where(where);
    return json({ ok: true });
  },
  { allowDevice: true },
);
