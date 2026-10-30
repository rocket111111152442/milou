import { json, withActor } from "@/lib/api";
import { listNotifications } from "@/lib/data/monitors";

export const GET = withActor(
  async (req, actor) => {
    const u = new URL(req.url);
    const before = u.searchParams.get("before");
    const items = await listNotifications(actor.userId, {
      unread: u.searchParams.get("unread") === "1",
      limit: Number(u.searchParams.get("limit") ?? 50) || 50,
      before: before && !Number.isNaN(Date.parse(before)) ? new Date(before) : undefined,
    });
    return json({ notifications: items });
  },
  { allowDevice: true },
);
