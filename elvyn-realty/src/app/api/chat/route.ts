import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env, crmStorageConfigured } from "@/config/env";
import { runTurn, assistantAvailable } from "@/lib/ai/agent";
import { createSession, discardSession, loadDisplay, loadSession } from "@/lib/ai/store";
import { CHAT_COOKIE, newChatId, readChatId, setChatCookie } from "@/lib/ai/session-cookie";
import { clientIp, rateLimit, sameOrigin } from "@/lib/security/rate-limit";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({
  message: z.string().trim().min(1).max(1000),
  lang: z.enum(["es", "en"]),
  page: z.object({ type: z.enum(["listing", "catalog", "other"]), slug: z.string().max(220).nullable().optional(), title: z.string().max(250).nullable().optional() }).default({ type: "other" }),
});

/** Visible transcript of the current conversation (to resume after closing the window). */
export async function GET(req: NextRequest) {
  const id = readChatId(req);
  const avail = assistantAvailable();
  if (!id || !crmStorageConfigured()) return NextResponse.json({ available: avail.ok, messages: [] });
  try {
    const s = await loadSession(id);
    if (!s) return NextResponse.json({ available: avail.ok, messages: [] });
    return NextResponse.json({ available: avail.ok, messages: await loadDisplay(id), handoffSent: s.handoff?.status === "sent" });
  } catch {
    return NextResponse.json({ available: avail.ok, messages: [] });
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers, env.siteUrl)) return NextResponse.json({ mode: "error" }, { status: 403 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ mode: "error", error: "invalid" }, { status: 400 });
  const avail = assistantAvailable();
  if (!avail.ok || !crmStorageConfigured()) return NextResponse.json({ mode: "fallback", reason: avail.reason ?? "storage" });

  const ip = clientIp(req.headers);
  const rl = rateLimit(`chat:${ip}`, env.ai.perIpPer10Min, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ mode: "rate_limited", retryAfter: rl.retryAfterSec }, { status: 429 });

  let id = readChatId(req);
  let state = id ? await loadSession(id) : null;
  if (!state) {
    id = newChatId();
    state = await createSession(id, parsed.data.lang);
  }
  state.lang = parsed.data.lang;
  try {
    const r = await runTurn(state, parsed.data.message, parsed.data.lang, { type: parsed.data.page.type, slug: parsed.data.page.slug ?? null, title: parsed.data.page.title ?? null });
    const prefill = r.handoff
      ? { fullName: state.profile.full_name ?? null, email: state.profile.email ?? null, phone: state.profile.whatsapp ?? null, country: state.profile.country ?? null }
      : undefined;
    const res = NextResponse.json({ ...r, prefill });
    setChatCookie(res, state.id, env.crm.chatRetentionDays);
    return res;
  } catch (err) {
    log.error("chat.failed", { reason: (err as Error).message.slice(0, 120) });
    return NextResponse.json({ mode: "fallback", reason: "server" });
  }
}

/** "New conversation": forget the current one (deleted if it is not linked to a prospect). */
export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req.headers, env.siteUrl)) return NextResponse.json({ ok: false }, { status: 403 });
  const id = readChatId(req);
  if (id && crmStorageConfigured()) await discardSession(id).catch(() => undefined);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(CHAT_COOKIE);
  return res;
}
