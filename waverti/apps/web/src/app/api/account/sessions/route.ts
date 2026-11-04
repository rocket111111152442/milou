import { and, eq, sql, userSessions } from "@waverti/database";
import { json, withActor } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/** Ferme toutes les AUTRES sessions du compte (appareils ou navigateurs perdus) ; la session courante est conservée. */
export const DELETE = withActor(
  async () => {
    const user = await getCurrentUser();
    const closed = await getDb()
      .delete(userSessions)
      .where(and(eq(userSessions.userId, user!.id), sql`${userSessions.id} <> ${user!.sessionId}`))
      .returning({ id: userSessions.id });
    return json({ ok: true, closed: closed.length });
  },
  { rate: { name: "sessions", limit: 10, windowSec: 3600 } },
);
