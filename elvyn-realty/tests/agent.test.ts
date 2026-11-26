import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { runTurn } from "@/lib/ai/agent";
import { createSession, loadSession, loadTranscript } from "@/lib/ai/store";
import { TOOL_DEFINITIONS, executeTool, ensureHandoff, ensureCards } from "@/lib/ai/tools";
import { loadDemoDetails } from "@/lib/catalog/demo";
import { getDb, schema } from "@/lib/db";
import { reply, scripted, text, tool, lastToolResult } from "./helpers/fake-model";

let sessionId: string;
beforeEach(async () => {
  sessionId = randomUUID();
  await createSession(sessionId, "es");
});
const state = async () => (await loadSession(sessionId))!;

describe("conversational search", () => {
  it("searches the real catalogue in Spanish and shows cards with real data", async () => {
    const m = scripted([
      () => reply([tool("update_prospect_profile", { intent: "buy", property_types: ["apartment"], zones: ["Cabrera"], budget_max: 180000, currency: "USD" }), tool("search_properties", { operation: "sale", property_types: ["apartment"], location: null, budget_min: null, budget_max: 180000, currency: "USD", bedrooms_min: 2, bathrooms_min: null, condition: "any", keywords: null, sort: "recent", limit: 3 })]),
      (p) => {
        const res = lastToolResult(p).content as unknown as { listings: { slug: string }[]; total_matches: number };
        // tool results come back in the same user message
        expect(Array.isArray((p.messages[p.messages.length - 1].content as unknown[]))).toBe(true);
        const slugs = (JSON.parse(((p.messages[p.messages.length - 1].content as { content: string }[])[1]).content) as { listings: { slug: string }[] }).listings.map((l) => l.slug);
        void res;
        return reply([tool("show_properties", { items: slugs.slice(0, 2).map((s) => ({ slug: s, reason: "2 hab. en Cabrera dentro del presupuesto" })) })]);
      },
      () => reply([text("Encontré estas opciones en Cabrera. ¿Quieres que coordine una visita?")]),
    ]);
    const r = await runTurn(await state(), "Busco un apartamento de dos habitaciones en la costa norte, presupuesto 180.000 dólares", "es", { type: "other" }, m.fn);
    expect(r.mode).toBe("ok");
    expect(r.cards.length).toBeGreaterThan(0);
    const inv = await loadDemoDetails();
    for (const c of r.cards) {
      const real = inv.find((l) => l.slug === c.slug)!;
      expect(real).toBeTruthy();
      expect(c.title).toBe(real.title);
      expect(c.url).toBe(`/propiedad/${real.slug}`);
      expect((real.usd.sale ?? real.price.sale?.amount ?? 0) <= 180000).toBe(true);
      expect(real.bedrooms ?? 0).toBeGreaterThanOrEqual(2);
    }
    // system prompt is cached and the page context is a mid-conversation system message
    expect(m.calls[0].system).toMatchObject([{ cache_control: { type: "ephemeral" } }]);
    expect(m.calls[0].messages[1].role).toBe("system");
    expect((await state()).profile).toMatchObject({ intent: "buy", zones: ["Cabrera"], budget_max: 180000 });
  });

  it("works in English and keeps the transcript append-only", async () => {
    const m1 = scripted([() => reply([tool("search_properties", { operation: "sale", property_types: ["villa"], location: null, budget_min: null, budget_max: null, currency: "USD", bedrooms_min: null, bathrooms_min: null, condition: "any", keywords: null, sort: "price_asc", limit: 2 })]), () => reply([text("Here are some villas.")])]);
    await runTurn(await state(), "Show me villas", "en", { type: "other" }, m1.fn);
    const before = await loadTranscript(sessionId);
    const m2 = scripted([(p) => {
      // history replayed verbatim, then the new user message
      expect(JSON.stringify(p.messages.slice(0, before.length))).toBe(JSON.stringify(before.map((x) => ({ role: x.role, content: x.content }))));
      return reply([text("Sure.")]);
    }]);
    const r = await runTurn(await state(), "Cheaper please", "en", { type: "other" }, m2.fn);
    expect(r.text).toBe("Sure.");
    const after = await loadTranscript(sessionId);
    expect(after.slice(0, before.length)).toEqual(before);
  });

  it("answers about the property being viewed without asking for its reference", async () => {
    const inv = await loadDemoDetails();
    const page = inv.find((l) => l.amenities.length > 0)!;
    const m = scripted([
      (p) => {
        expect(JSON.stringify(p.messages[1].content)).toContain(page.slug);
        return reply([tool("get_property", { slug_or_ref: page.slug })]);
      },
      (p) => {
        const r = lastToolResult(p).content as { found: boolean; title: string; amenities: string[] };
        expect(r.found).toBe(true);
        expect(r.title).toBe(page.title);
        return reply([text(`Tiene: ${r.amenities.slice(0, 2).join(", ")}.`)]);
      },
    ]);
    const r = await runTurn(await state(), "¿Qué amenidades tiene?", "es", { type: "listing", slug: page.slug, title: page.title }, m.fn);
    expect(r.text).toContain(page.amenities[0]);
  });

  it("reports no results with concrete ways to broaden", async () => {
    const m = scripted([
      () => reply([tool("search_properties", { operation: "sale", property_types: ["penthouse"], location: "Cabrera", budget_min: null, budget_max: 5000, currency: "USD", bedrooms_min: 5, bathrooms_min: null, condition: "any", keywords: null, sort: "recent", limit: 3 })]),
      (p) => {
        const r = lastToolResult(p).content as { total_matches: number; broader_options: { change: string; matches: number }[] };
        expect(r.total_matches).toBe(0);
        expect(r.broader_options.map((o) => o.change)).toEqual(expect.arrayContaining(["budget_max +20%", "any location"]));
        return reply([text("No encontré nada exacto. ¿Amplío el presupuesto?")]);
      },
    ]);
    expect((await runTurn(await state(), "penthouse 5 hab por 5000", "es", { type: "other" }, m.fn)).cards).toEqual([]);
  });

  it("refuses to show listings that no tool returned (no invented properties)", async () => {
    const m = scripted([() => reply([tool("show_properties", { items: [{ slug: "villa-inventada-999", reason: "x" }] })]), (p) => {
      expect(lastToolResult(p).is_error).toBe(true);
      return reply([text("Déjame buscar primero.")]);
    }]);
    const r = await runTurn(await state(), "muéstrame algo", "es", { type: "other" }, m.fn);
    expect(r.cards).toEqual([]);
  });

  it("lets the visitor correct a previous answer", async () => {
    const m1 = scripted([() => reply([tool("update_prospect_profile", { budget_max: 150000, zones: ["Nagua"] })]), () => reply([text("Ok")])]);
    await runTurn(await state(), "150k en Nagua", "es", { type: "other" }, m1.fn);
    const m2 = scripted([() => reply([tool("update_prospect_profile", { budget_max: 200000, zones: null })]), (p) => {
      expect((lastToolResult(p).content as { profile: Record<string, unknown> }).profile).toMatchObject({ budget_max: 200000, zones: ["Nagua"] });
      return reply([text("Corregido")]);
    }]);
    await runTurn(await state(), "perdón, son 200k", "es", { type: "other" }, m2.fn);
    expect((await state()).profile).toMatchObject({ budget_max: 200000, zones: ["Nagua"] });
  });
});

describe("hand-off, visits and safety", () => {
  it("proposes a hand-off card but stores nothing in the CRM until the visitor sends it", async () => {
    const db = await getDb();
    const before = (await db.select().from(schema.contacts)).length;
    const m = scripted([() => reply([tool("update_prospect_profile", { full_name: "Luis Gómez", whatsapp: "+1 917 555 0101", intent: "buy" }), tool("propose_handoff", { reason: "visit", summary: "Luis Gómez · +19175550101 · EE. UU. · Compra", next_step: "Coordinar visita", include_visit_form: true, property_slug: null })]), () => reply([text("Te comunico con Elvyn.")])]);
    const r = await runTurn(await state(), "Quiero visitar el sábado", "es", { type: "other" }, m.fn);
    expect(r.handoff).toMatchObject({ reason: "visit", includeVisitForm: true, status: "proposed" });
    expect((await db.select().from(schema.contacts)).length).toBe(before);
  });

  it("the hand-off endpoint creates the prospect and a pending visit after consent", async () => {
    const m = scripted([() => reply([tool("update_prospect_profile", { full_name: "Marta Ruiz", whatsapp: "+34 612 345 678", intent: "buy", zones: ["Cabrera"], budget_max: 250000, currency: "USD", timeline: "en 1 mes", payment_method: "contado" }), tool("propose_handoff", { reason: "visit", summary: "Marta", next_step: "Visita", include_visit_form: true, property_slug: null })]), () => reply([text("ok")])]);
    await runTurn(await state(), "Quiero visitar", "es", { type: "other" }, m.fn);
    const { POST } = await import("@/app/api/chat/handoff/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost:3000/api/chat/handoff", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `ea_chat=${sessionId}`, origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({ fullName: "Marta Ruiz", phone: "+34 612 345 678", consent: true, visit: { type: "virtual", timezone: "Europe/Madrid", slots: ["2026-12-05T10:00"] } }),
    });
    const res = await POST(req);
    expect(await res.json()).toMatchObject({ ok: true, pendingConfirmation: true });
    const db = await getDb();
    const [c] = await db.select().from(schema.contacts).where(eq(schema.contacts.phone, "+34612345678"));
    expect(c.temperature).toBe("caliente");
    expect(c.priority).toBe(true); // budget ≥ US$150,000
    const [ap] = await db.select().from(schema.appointments).where(eq(schema.appointments.contactId, c.id));
    expect(ap.status).toBe("solicitada");
    expect((await state()).handoff?.status).toBe("sent");
    // a second click does not duplicate
    const again = await POST(new NextRequest(req.url, { method: "POST", headers: req.headers, body: JSON.stringify({ fullName: "Marta Ruiz", phone: "+34612345678", consent: true }) }));
    expect(await again.json()).toMatchObject({ ok: true, already: true });
  });

  it("finds features listed only in amenities, with English keywords (regression)", async () => {
    const ctx = { lang: "en" as const, pageSlug: null, profile: {}, seenSlugs: new Set<string>(), handoff: null, cards: [], executed: new Map() };
    const r = JSON.parse((await executeTool("search_properties", { operation: "sale", property_types: ["villa"], location: null, budget_min: null, budget_max: 400000, currency: "USD", bedrooms_min: null, bathrooms_min: null, condition: "any", keywords: "pool", sort: "recent", limit: 6 }, ctx)).content);
    expect(r.total_matches).toBeGreaterThanOrEqual(5);
  });

  it("shows the hand-off card for visit/human requests even if the model forgot (safety net)", () => {
    const mk = () => ({ lang: "es" as const, pageSlug: "lote-x-1", profile: { full_name: "Ana" }, seenSlugs: new Set<string>(), handoff: null, cards: [], executed: new Map() });
    const a = mk();
    ensureHandoff("Quiero visitarlo el sábado", a);
    expect(a.handoff).toMatchObject({ reason: "visit", includeVisitForm: true, propertySlug: "lote-x-1", status: "proposed" });
    const b = mk();
    ensureHandoff("I'd like to talk to a person", b);
    expect(b.handoff).toMatchObject({ reason: "human_request", includeVisitForm: false });
    const c = mk();
    ensureHandoff("¿Cuál es la forma de pago y qué tan cerca está de la playa?", c);
    expect(c.handoff).toBeNull();
  });

  it("attaches cards when the model describes search results without showing them", async () => {
    const inv = await loadDemoDetails();
    const ctx = { lang: "en" as const, pageSlug: null, profile: {}, seenSlugs: new Set<string>(), handoff: null, cards: [] as never[], executed: new Map(), lastSearch: inv.slice(0, 5).map((l) => l.slug) };
    await ensureCards(ctx, "Here are some options");
    expect((ctx.cards as { slug: string }[]).map((c) => c.slug)).toEqual(inv.slice(0, 3).map((l) => l.slug));
  });

  it("exposes no tool that can read prospects, notes or other conversations", async () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name).sort();
    expect(names).toEqual(["get_property", "propose_handoff", "search_properties", "show_properties", "update_prospect_profile"]);
    const ctx = { lang: "es" as const, pageSlug: null, profile: {}, seenSlugs: new Set<string>(), handoff: null, cards: [], executed: new Map() };
    expect((await executeTool("list_contacts", {}, ctx)).isError).toBe(true);
    const bad = await executeTool("search_properties", { operation: "sale; DROP TABLE contacts" }, ctx);
    expect(bad.isError).toBe(true);
  });

  it("returns fallback mode (nothing saved) when the model API fails", async () => {
    const before = await loadTranscript(sessionId);
    const r = await runTurn(await state(), "hola", "es", { type: "other" }, async () => {
      throw new Error("503");
    });
    expect(r.mode).toBe("fallback");
    expect(await loadTranscript(sessionId)).toEqual(before);
  });

  it("handles a refusal with a contact message", async () => {
    const m = scripted([() => reply([], "refusal")]);
    const r = await runTurn(await state(), "…", "es", { type: "other" }, m.fn);
    expect(r.mode).toBe("refusal");
    expect(r.text).toContain("Elvyn");
  });

  it("stops tool loops: the last round forbids tools", async () => {
    const steps = Array.from({ length: 6 }, (_, i) => (p: any) =>
      i < 5 ? reply([tool("search_properties", { operation: "sale", property_types: null, location: `loop${i}`, budget_min: null, budget_max: null, currency: "USD", bedrooms_min: null, bathrooms_min: null, condition: "any", keywords: null, sort: "recent", limit: 1 })]) : (expect(p.tool_choice).toEqual({ type: "none" }), reply([text("Resumen final")])),
    );
    const m = scripted(steps);
    const r = await runTurn(await state(), "busca", "es", { type: "other" }, m.fn);
    expect(r.text).toBe("Resumen final");
    expect(m.calls).toHaveLength(6);
  });

  it("switches to fallback when the assistant tokens are spent", async () => {
    const db = await getDb();
    await db.insert(schema.aiUsage).values({ day: new Date().toISOString().slice(0, 10), model: "claude-opus-5-5", costUsd: 1000, outcome: "ok" });
    const r = await runTurn(await state(), "hola", "es", { type: "other" }, async () => {
      throw new Error("must not be called");
    });
    expect(r).toMatchObject({ mode: "fallback", reason: "credits_exhausted" });
    await db.delete(schema.aiUsage).where(eq(schema.aiUsage.costUsd, 1000));
  });
});

describe("false claim correction", () => {
  it("keeps honest sentences and removes claims in Spanish and English", async () => {
    const { correctFalseClaims } = await import("@/lib/ai/tools");
    const ctx = (lang: "es" | "en", status?: "proposed" | "sent") => ({ lang, pageSlug: null, profile: {}, seenSlugs: new Set<string>(), handoff: status ? ({ status } as never) : null, cards: [], executed: new Map() });
    // Honest wording is untouched
    for (const t of ["Elvyn confirmará la disponibilidad.", "Para que Elvyn confirme la visita, pulsa el botón de la tarjeta.", "Elvyn will confirm availability.", "La visita queda pendiente de confirmación cuando envíes la tarjeta."])
      expect(correctFalseClaims(t, ctx("es", "proposed"))).toBe(t);
    for (const t of ["Te dejé 4 opciones abajo.", "Te envié las fichas de las villas.", "I've sent you a few listings below."])
      expect(correctFalseClaims(t, ctx("es"))).toBe(t);
    // False claims are removed
    expect(correctFalseClaims("Ya te dejé la solicitud con Elvyn.", ctx("es", "proposed"))).not.toMatch(/dejé/);
    expect(correctFalseClaims("I've sent your request to Elvyn.", ctx("en", "proposed"))).not.toMatch(/I've sent/);
    expect(correctFalseClaims("Listo. Tu visita ha sido confirmada para el sábado. ¿Algo más?", ctx("es", "proposed"))).toMatch(/^Todavía no se ha enviado nada[\s\S]*¿Algo más\?$/);
    expect(correctFalseClaims("He enviado tu solicitud a Elvyn.", ctx("es", "proposed"))).not.toMatch(/He enviado/);
    expect(correctFalseClaims("I've booked your visit for Saturday.", ctx("en", "proposed"))).toMatch(/^Nothing has been sent yet/);
    expect(correctFalseClaims("Your viewing is now confirmed.", ctx("en", "proposed"))).not.toMatch(/confirmed\./);
    // When the card appears, the real next step is always added
    expect(correctFalseClaims("Ya preparé la solicitud para la primera villa.", ctx("es", "proposed"), true)).toMatch(/pulsa el botón de envío/);
    expect(correctFalseClaims("Ya preparé la solicitud para la primera villa.", ctx("es", "proposed"), false)).toBe("Ya preparé la solicitud para la primera villa.");
    // After the visitor really sent it, nothing changes
    expect(correctFalseClaims("He enviado tu solicitud a Elvyn.", ctx("es", "sent"))).toBe("He enviado tu solicitud a Elvyn.");
  });
});


describe("types from the visitor's words", () => {
  it("detects land-only requests", async () => {
    const { typesFromText } = await import("@/lib/ai/tools");
    expect(typesFromText("Do you have land for sale in Río San Juan?")).toEqual(["land"]);
    expect(typesFromText("Busco un solar en Cabrera")).toEqual(["land"]);
    expect(typesFromText("Busco una villa con terreno grande")).toBeUndefined();
    expect(typesFromText("Busco algo en Cabrera")).toBeUndefined();
  });
});

describe("visitor language and forced search", () => {
  it("detects the visitor's language and writes the site's sentences in it", async () => {
    const { visitorLang, correctFalseClaims, PROPERTY_TALK } = await import("@/lib/ai/tools");
    expect(visitorLang("Je voudrais visiter la villa samedi", "es")).toBe("fr");
    expect(visitorLang("Bonjour, je cherche une villa à Las Terrenas", "es")).toBe("fr");
    expect(visitorLang("Do you have land for sale near Río San Juan?", "es")).toBe("en");
    expect(visitorLang("Busco un apartamento en Punta Cana", "en")).toBe("es");
    expect(visitorLang("300000", "es")).toBe("es");
    const ctx = { lang: "es" as const, replyLang: "fr" as const, pageSlug: null, profile: {}, seenSlugs: new Set<string>(), handoff: { status: "proposed" } as never, cards: [], executed: new Map() };
    expect(correctFalseClaims("Parfait.", ctx, true)).toMatch(/appuie sur le bouton d'envoi/);
    expect(PROPERTY_TALK.test("Busco un apartamento en Punta Cana")).toBe(true);
    expect(PROPERTY_TALK.test("How does buying work for a foreigner?")).toBe(false);
  });
});

describe("funnel: budget question", () => {
  it("adds the budget question once the type is known and no budget was given", async () => {
    const { ensureBudgetQuestion } = await import("@/lib/ai/tools");
    const ctx = (profile = {}) => ({ lang: "es" as const, replyLang: "es" as const, pageSlug: null, profile, seenSlugs: new Set<string>(), handoff: null, cards: [], executed: new Map() });
    const r = ensureBudgetQuestion("Tengo estas casas en Cabrera.", ctx(), "Busco una casa de 4 habitaciones en Cabrera", "");
    expect(r).toMatch(/¿cuál es tu presupuesto máximo\?/);
    // not when the budget is known, was just given, already asked, or asked in the previous reply
    expect(ensureBudgetQuestion("Ok.", ctx({ budget_max: 200000 }), "casa en Cabrera", "")).toBe("Ok.");
    expect(ensureBudgetQuestion("Ok.", ctx(), "casa en Cabrera hasta 200.000 dólares", "")).toBe("Ok.");
    expect(ensureBudgetQuestion("¿Cuál es tu presupuesto?", ctx(), "casa en Cabrera", "")).toBe("¿Cuál es tu presupuesto?");
    expect(ensureBudgetQuestion("Ok.", ctx(), "casa en Cabrera", "Para encontrar tu propiedad ideal, ¿cuál es tu presupuesto máximo?")).toBe("Ok.");
    // mentioning the budget in passing is not asking for it
    expect(ensureBudgetQuestion("Puedo filtrar por piscina, vista o presupuesto.", ctx(), "casa de 4 habitaciones en Cabrera", "")).toMatch(/¿cuál es tu presupuesto máximo\?/);
    expect(ensureBudgetQuestion("¿Quieres que te muestre solo las opciones de presupuesto más bajo?", ctx(), "casa de 4 habitaciones en Cabrera", "")).toMatch(/¿cuál es tu presupuesto máximo\?/);
    expect(ensureBudgetQuestion("Ok.", ctx(), "que tenga piscina", "¿Quieres ver opciones de presupuesto más bajo?")).toBe("Ok."); // type unknown in this message and profile
    // not before the type is known
    expect(ensureBudgetQuestion("Hola.", ctx(), "Hola", "")).toBe("Hola.");
  });
});
