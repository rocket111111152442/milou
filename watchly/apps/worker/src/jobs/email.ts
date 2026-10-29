import { processEmailOutbox } from "@watchly/notifications";
import type { WorkerContext } from "../context";

export async function processEmails(ctx: WorkerContext): Promise<number> {
  if (!ctx.email) return 0;
  const r = await processEmailOutbox(ctx.db, ctx.email, {
    from: ctx.config.EMAIL_FROM,
    appUrl: ctx.config.APP_URL,
    workerId: ctx.config.WORKER_ID,
    batchSize: 25,
  });
  return r.sent + r.failed;
}
