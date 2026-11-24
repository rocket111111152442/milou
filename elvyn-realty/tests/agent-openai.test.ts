/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

/** OpenAI provider: same tools and rules, Chat Completions function calling (simulated model). */
type Msg = { role: string; content?: unknown; tool_calls?: unknown[]; tool_call_id?: string };
let n = 0;
const completion = (message: Record<string, unknown>, finish = "stop") =>
  ({ id: `c${++n}`, model: "gpt-4.1-mini", choices: [{ index: 0, finish_reason: finish, message: { role: "assistant", content: null, refusal: null, ...message } }], usage: { prompt_tokens: 3000, completion_tokens: 120, prompt_tokens_details: { cached_tokens: 2000 } } }) as never;
const call = (name: string, args: unknown) => ({ id: `call_${++n}`, type: "function", function: { name, arguments: JSON.stringify(args) } });

let mod: typeof import("@/lib/ai/agent");
let store: typeof import("@/lib/ai/store");
beforeAll(async () => {
  vi.resetModules();
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.AI_MODEL = "";
  mod = await import("@/lib/ai/agent");
  store = await import("@/lib/ai/store");
});
afterAll(() => {
  delete process.env.OPENAI_API_KEY;
});

describe("OpenAI provider", () => {
  it("selects OpenAI when OPENAI_API_KEY is set", async () => {
    const { env } = await import("@/config/env");
    expect(env.ai.provider).toBe("openai");
    expect(env.ai.model).toBe("gpt-4.1-mini");
    expect(mod.assistantAvailable().ok).toBe(true);
  });

  it("runs the tool loop, shows real cards and keeps an append-only transcript", async () => {
    const id = randomUUID();
    const state = await store.createSession(id, "es");
    const calls: { messages: Msg[]; tool_choice: unknown; tools: unknown[] }[] = [];
    const create = async (p: any) => {
      calls.push(JSON.parse(JSON.stringify(p)));
      const i = calls.length;
      if (i === 1) return completion({ tool_calls: [call("search_properties", { operation: "sale", property_types: ["land"], location: "Cabrera", budget_min: null, budget_max: 60000, currency: "USD", bedrooms_min: null, bathrooms_min: null, condition: "any", keywords: null, sort: "price_asc", limit: 3 })] }, "tool_calls");
      if (i === 2) {
        const last = calls[1].messages.at(-1)!;
        expect(last.role).toBe("tool");
        const slugs = (JSON.parse(last.content as string) as { listings: { slug: string }[] }).listings.map((l) => l.slug);
        expect(slugs.length).toBeGreaterThan(0);
        return completion({ tool_calls: [call("show_properties", { items: slugs.slice(0, 2).map((slug) => ({ slug, reason: "Solar en Cabrera dentro del presupuesto" })) })] }, "tool_calls");
      }
      return completion({ content: "Aquí tienes dos solares en Cabrera por menos de US$60,000." });
    };
    const r = await mod.runTurn(state, "Busco un solar en Cabrera por menos de 60.000 dólares", "es", { type: "other" }, undefined, create);
    expect(r.mode).toBe("ok");
    expect(r.text).toContain("Cabrera");
    expect(r.cards.length).toBeGreaterThan(0);
    expect(r.cards.every((c) => c.url.startsWith("/propiedad/"))).toBe(true);
    expect(calls[0].messages[0].role).toBe("system");
    expect(calls[0].messages.at(-1)!.role).toBe("system"); // page context after the user message
    expect(calls[0].tools).toHaveLength(5);

    const before = await store.loadTranscript(id);
    const calls2: { messages: Msg[] }[] = [];
    const r2 = await mod.runTurn((await store.loadSession(id))!, "¿Y en Río San Juan?", "es", { type: "other" }, undefined, async (p: any) => {
      calls2.push(JSON.parse(JSON.stringify(p)));
      return completion({ content: "Déjame buscar." });
    });
    expect(r2.mode).toBe("ok");
    // Past turns are replayed compacted: same order, no old context messages, shortened tool results.
    const { compactHistory } = await import("@/lib/ai/openai-agent");
    const expected = compactHistory(before.map((b) => b.content) as never);
    expect(calls2[0].messages.slice(1, 1 + expected.length)).toEqual(expected);
    expect(expected.some((m) => m.role === "system")).toBe(false);
    const pastTool = expected.find((m) => m.role === "tool") as { content: string };
    expect(JSON.parse(pastTool.content).listings[0]).toHaveProperty("slug");
    expect(pastTool.content.length).toBeLessThan((before.find((b) => b.role === "tool")!.content as { content: string }).content.length);
  });

  it("falls back to another model if the configured one is unavailable", async () => {
    const OpenAI = (await import("openai")).default;
    const { __resetOpenAIModelForTests } = await import("@/lib/ai/openai-agent");
    __resetOpenAIModelForTests();
    const state = await store.createSession(randomUUID(), "en");
    const tried: string[] = [];
    const r = await mod.runTurn(state, "hi", "en", { type: "other" }, undefined, async (p: any) => {
      const model = (p as { model: string }).model;
      tried.push(model);
      if (tried.length === 1) throw new OpenAI.NotFoundError(404, { message: "The model does not exist" }, undefined, new Headers());
      return completion({ content: "Hello!" });
    });
    expect(r.text).toBe("Hello!");
    expect(tried.length).toBe(2);
    expect(tried[1]).not.toBe(tried[0]);
  });

  it("switches to fallback mode on an invalid key (401) without saving anything", async () => {
    const OpenAI = (await import("openai")).default;
    const id = randomUUID();
    const state = await store.createSession(id, "es");
    const r = await mod.runTurn(state, "hola", "es", { type: "other" }, undefined, async () => {
      throw new OpenAI.AuthenticationError(401, { message: "Incorrect API key" }, undefined, new Headers());
    });
    expect(r).toMatchObject({ mode: "fallback", reason: "auth" });
    expect(await store.loadTranscript(id)).toEqual([]);
  });

  it("forbids tools on the last round (loop guard)", async () => {
    const state = await store.createSession(randomUUID(), "es");
    const choices: unknown[] = [];
    const r = await mod.runTurn(state, "busca", "es", { type: "other" }, undefined, async (p: any) => {
      choices.push((p as { tool_choice: unknown }).tool_choice);
      if (choices.length <= 5) return completion({ tool_calls: [call("search_properties", { operation: "sale", property_types: null, location: `x${choices.length}`, budget_min: null, budget_max: null, currency: "USD", bedrooms_min: null, bathrooms_min: null, condition: "any", keywords: null, sort: "recent", limit: 1 })] }, "tool_calls");
      return completion({ content: "Resumen" });
    });
    expect(choices.at(-1)).toBe("none");
    expect(r.text).toBe("Resumen");
  });

  it("sends reasoning_effort to GPT-5 models and retries without it if refused", async () => {
    const OpenAI = (await import("openai")).default;
    const { env } = await import("@/config/env");
    const { __resetOpenAIModelForTests } = await import("@/lib/ai/openai-agent");
    __resetOpenAIModelForTests();
    const prev = env.ai.model;
    (env.ai as { model: string }).model = "gpt-5.4";
    try {
      const state = await store.createSession(randomUUID(), "es");
      const seen: Record<string, unknown>[] = [];
      const r = await mod.runTurn(state, "hola", "es", { type: "other" }, undefined, async (p: any) => {
        seen.push({ ...p, messages: undefined });
        if (seen.length === 1) throw new OpenAI.BadRequestError(400, { message: "Unsupported parameter: 'reasoning_effort'" }, undefined, new Headers());
        return completion({ content: "¡Hola!" });
      });
      expect(r.text).toBe("¡Hola!");
      expect(seen[0]).toMatchObject({ model: "gpt-5.4", reasoning_effort: "low" });
      expect(seen[0].max_completion_tokens).toBeGreaterThanOrEqual(4000);
      expect(seen[1].model).toBe("gpt-5.4");
      expect(seen[1]).not.toHaveProperty("reasoning_effort");
    } finally {
      (env.ai as { model: string }).model = prev;
      __resetOpenAIModelForTests();
    }
  });

  it("removes a false 'request sent' claim when the visitor has not pressed the card button", async () => {
    const state = await store.createSession(randomUUID(), "es");
    const r = await mod.runTurn(state, "Quiero visitar la villa este sábado", "es", { type: "listing", slug: "x" }, undefined, async () =>
      completion({ content: "Perfecto. Ya dejé la visita pendiente de confirmación con Elvyn para la primera villa.\n\nSi quieres, dime tu nombre y WhatsApp." }),
    );
    expect(r.handoff?.reason).toBe("visit");
    expect(r.text).not.toMatch(/Ya dejé/);
    expect(r.text).toMatch(/Todavía no se ha enviado nada/);
    expect(r.text).toMatch(/dime tu nombre/);
    const t = await store.loadTranscript(state.id);
    expect(JSON.stringify(t.at(-1))).not.toMatch(/Ya dejé/);
  });

  it("does not show cards of another property type than the one searched", async () => {
    const { getInventory } = await import("@/lib/catalog/service");
    const inv = await getInventory();
    const isLand = (l: (typeof inv)[number]) => /solar|terreno|lote|land/i.test(`${l.category?.name ?? ""} ${l.category?.nameEn ?? ""}`);
    const other = inv.find((l) => !isLand(l))!;
    const state = await store.createSession(randomUUID(), "en");
    let i = 0;
    let lastTool = "";
    const r = await mod.runTurn(state, "Do you have land for sale?", "en", { type: "other" }, undefined, async (p: any) => {
      i++;
      if (i === 1) return completion({ tool_calls: [call("search_properties", { operation: "sale", property_types: ["land"], location: null, budget_min: null, budget_max: null, currency: "USD", bedrooms_min: null, bathrooms_min: null, condition: "any", keywords: null, sort: "recent", limit: 3 })] }, "tool_calls");
      if (i === 2) {
        const land = (JSON.parse(p.messages.at(-1).content) as { listings: { slug: string }[] }).listings.map((l) => l.slug);
        return completion({ tool_calls: [call("get_property", { slug_or_ref: other.slug }), call("show_properties", { items: [...land.slice(0, 2), other.slug].map((slug) => ({ slug, reason: "r" })) })] }, "tool_calls");
      }
      lastTool = p.messages.at(-1).content;
      return completion({ content: "Here are some lots." });
    });
    expect(r.cards.length).toBeGreaterThan(0);
    expect(r.cards.some((c) => c.slug === other.slug)).toBe(false);
    expect(lastTool).toMatch(/property type differs/);
  });

  it("never leaves a dead end: shows labelled closest alternatives when nothing matches", async () => {
    const state = await store.createSession(randomUUID(), "es");
    let i = 0;
    const r = await mod.runTurn(state, "Busco algo por menos de 1 dólar", "es", { type: "other" }, undefined, async () => {
      i++;
      if (i === 1) return completion({ tool_calls: [call("search_properties", { operation: "sale", property_types: null, location: null, budget_min: null, budget_max: 1, currency: "USD", bedrooms_min: null, bathrooms_min: null, condition: "any", keywords: null, sort: "price_asc", limit: 3 })] }, "tool_calls");
      return completion({ content: "No encontré nada exacto, pero tengo opciones cercanas." });
    });
    // budget +20 % of 1 still finds nothing; the next broader option that has results is used
    expect(r.cards.length).toBeGreaterThan(0);
    expect(r.cards.every((c) => c.reason.startsWith("Alternativa"))).toBe(true);
  });
});
