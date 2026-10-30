import { sql } from "@waverti/database";
import type { WorkerContext } from "../context";
import type { LoopHandle } from "../loop";

export async function writeHeartbeat(ctx: WorkerContext, startedAt: Date, loops: LoopHandle[]): Promise<void> {
  const mem = process.memoryUsage();
  const [queue] = await ctx.db.execute<{ pending: number; claimed: number; overdue: number }>(sql`
    select count(*) filter (where status = 'pending')::int as pending,
           count(*) filter (where status = 'claimed')::int as claimed,
           count(*) filter (where status = 'pending' and slot_at < now() - interval '15 minutes')::int as overdue
    from monitoring_jobs where status in ('pending', 'claimed')`);
  const stats = {
    rssMb: Math.round(mem.rss / 1048576),
    heapMb: Math.round(mem.heapUsed / 1048576),
    loadavg: (await import("node:os")).loadavg()[0],
    browser: ctx.browser?.load ?? null,
    blockedBrowserRequests: ctx.browser?.blockedRequests ?? 0,
    queue,
    loops: Object.fromEntries(loops.map((l) => [l.name, l.stats()])),
    emailConfigured: Boolean(ctx.email),
    searchConfigured: Boolean(ctx.search),
  };
  await ctx.db.execute(sql`
    insert into worker_heartbeats (worker_id, hostname, version, role, started_at, last_seen_at, jobs_succeeded, jobs_failed, stats)
    values (${ctx.config.WORKER_ID}, ${(await import("node:os")).hostname()}, ${process.env.npm_package_version ?? "0.1.0"}, ${[...ctx.config.roles].join(",")},
            ${startedAt.toISOString()}::timestamptz, now(), ${ctx.counters.succeeded}, ${ctx.counters.failed}, ${JSON.stringify(stats)}::jsonb)
    on conflict (worker_id) do update set last_seen_at = now(), jobs_succeeded = excluded.jobs_succeeded,
      jobs_failed = excluded.jobs_failed, stats = excluded.stats, role = excluded.role`);
}
