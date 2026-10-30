import { json, withActor } from "@/lib/api";
import { listDevices } from "@/lib/data/account";

export const GET = withActor(async (_req, actor) => json({ devices: await listDevices(actor.userId) }));
