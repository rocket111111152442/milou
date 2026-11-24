import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env, crmStorageConfigured } from "@/config/env";
import { leadInput } from "@/lib/crm/lead-input";
import { createLead } from "@/lib/crm/leads";
import { loadSession, updateSessionState } from "@/lib/ai/store";
import { readChatId } from "@/lib/ai/session-cookie";
import { getListing } from "@/lib/catalog/service";
import { clientIp, rateLimit, sameOrigin } from "@/lib/security/rate-limit";
import type { Profile } from "@/lib/ai/tools";
import { log } from "@/lib/log";

export const runtime = "nodejs";

const body = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  consent: z.literal(true),
  visit: z.object({ type: z.enum(["physical", "virtual"]), timezone: z.string().max(60), slots: z.array(z.string().trim().min(3).max(80)).min(1).max(3) }).optional().nullable(),
});

function criteriaFrom(p: Profile) {
  return {
    intent: p.intent ?? undefined,
    propertyTypes: p.property_types ?? undefined,
    zones: p.zones ?? undefined,
    budgetMin: p.budget_min ?? null,
    budgetMax: p.budget_max ?? null,
    currency: p.currency ?? null,
    paymentMethod: p.payment_method ?? null,
    usage: p.usage ?? null,
    timeline: p.timeline ?? null,
    bedrooms: p.bedrooms ?? null,
    mustHaves: p.must_haves ?? undefined,
    visitPreference: p.visit_preference ?? null,
    availability: p.availability ?? null,
    titleDeslindado: p.title_deslindado ?? null,
    hasMortgage: p.has_mortgage ?? null,
    expectedPrice: p.expected_price ?? null,
    guests: p.guests ?? null,
    dates: p.dates ?? null,
    multipleUnits: p.multiple_units ?? null,
  };
}

/**
 * The visitor confirms the hand-off card: only now are their details stored in the CRM.
 * The assistant cannot call this endpoint; it requires the visitor's click (and consent).
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers, env.siteUrl)) return NextResponse.json({ ok: false }, { status: 403 });
  if (!crmStorageConfigured()) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  const rl = rateLimit(`handoff:${clientIp(req.headers)}`, 5, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const id = readChatId(req);
  const state = id ? await loadSession(id) : null;
  if (!state || !state.handoff) return NextResponse.json({ ok: false, error: "no_handoff" }, { status: 400 });
  if (state.handoff.status === "sent") return NextResponse.json({ ok: true, already: true });

  const b = body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ ok: false, error: "invalid", fields: [...new Set(b.error.issues.map((i) => String(i.path[0])))] }, { status: 400 });

  let property: { slug: string; ref: string | null; title: string | null } | null = null;
  if (state.handoff.propertySlug) {
    const d = await getListing(state.handoff.propertySlug).catch(() => null);
    property = { slug: state.handoff.propertySlug, ref: d?.ref ?? null, title: d?.title ?? null };
  }
  const p = state.profile;
  const input = leadInput.safeParse({
    kind: "chat_handoff",
    fullName: b.data.fullName,
    email: b.data.email || null,
    phone: b.data.phone || null,
    country: b.data.country || p.country || null,
    city: p.city ?? null,
    language: state.lang === "en" ? "en" : "es",
    howFound: p.how_found ?? null,
    criteria: criteriaFrom(p),
    reason: state.handoff.reason,
    summary: `${state.handoff.summary}${state.handoff.nextStep ? `\nPróximo paso: ${state.handoff.nextStep}` : ""}`,
    property,
    visit: b.data.visit ?? null,
    consent: true,
  });
  if (!input.success) return NextResponse.json({ ok: false, error: "invalid", fields: [...new Set(input.error.issues.map((i) => String(i.path[0])))] }, { status: 400 });

  try {
    const r = await createLead(input.data, { chatSessionId: state.id });
    state.handoff = { ...state.handoff, status: "sent", contactId: r.contactId };
    state.contactId = r.contactId;
    await updateSessionState(state);
    return NextResponse.json({ ok: true, pendingConfirmation: Boolean(r.appointmentId) });
  } catch (err) {
    log.error("handoff.failed", { reason: (err as Error).message.slice(0, 120) });
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
