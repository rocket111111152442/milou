import { and, asc, eq, inArray, notifications } from "@waverti/database";
import { noStore, withDevice } from "@/lib/agent";
import { toNotificationView } from "@/lib/data/monitors";
import { getDb } from "@/lib/db";

/** Notifications à afficher nativement sur le bureau (remises une seule fois). */
export const GET = withDevice(async (_req, device) => {
  const db = getDb();
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, device.userId), eq(notifications.desktopStatus, "pending")))
    .orderBy(asc(notifications.createdAt))
    .limit(20);
  if (rows.length) {
    await db
      .update(notifications)
      .set({ desktopStatus: "delivered" })
      .where(and(eq(notifications.userId, device.userId), inArray(notifications.id, rows.map((r) => r.id))));
  }
  return noStore({ notifications: rows.map(toNotificationView) });
});
