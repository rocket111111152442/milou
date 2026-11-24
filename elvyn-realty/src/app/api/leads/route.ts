import { NextResponse, type NextRequest } from "next/server";
import { env, crmStorageConfigured } from "@/config/env";
import { leadInput } from "@/lib/crm/lead-input";
import { createLead } from "@/lib/crm/leads";
import { clientIp, looksLikeSpam, rateLimit, sameOrigin } from "@/lib/security/rate-limit";
import { log } from "@/lib/log";

export const runtime = "nodejs";

/** Public form submissions (contact, property information, visit request, seller). */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers, env.siteUrl)) return NextResponse.json({ ok: false, error: "origin" }, { status: 403 });
  if (!crmStorageConfigured()) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  const ip = clientIp(req.headers);
  const rl = rateLimit(`lead:${ip}`, 5, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (looksLikeSpam(body)) {
    // Pretend nothing special happened, but record nothing.
    log.warn("lead.spam_rejected", {});
    return NextResponse.json({ ok: false, error: "rejected" }, { status: 400 });
  }
  const parsed = leadInput.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "form")))];
    return NextResponse.json({ ok: false, error: "invalid", fields }, { status: 400 });
  }
  if (parsed.data.kind === "chat_handoff") return NextResponse.json({ ok: false, error: "invalid", fields: ["kind"] }, { status: 400 });
  try {
    const r = await createLead(parsed.data);
    return NextResponse.json({ ok: true, pendingConfirmation: Boolean(r.appointmentId) });
  } catch (err) {
    log.error("lead.create_failed", { reason: (err as Error).message.slice(0, 120) });
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
