import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/config/env";
import { purgeExpired } from "@/lib/crm/retention";
import { retryFailed } from "@/lib/notify";

export const runtime = "nodejs";

/** Daily maintenance (Vercel Cron or any scheduler): retention purge + notification retries. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.cronSecret}`;
  if (!env.cronSecret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected)))
    return NextResponse.json({ ok: false }, { status: 401 });
  const purged = await purgeExpired();
  const retried = await retryFailed();
  return NextResponse.json({ ok: true, purged, retried });
}
