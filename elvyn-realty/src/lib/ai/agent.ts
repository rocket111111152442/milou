import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env, catalogMode } from "@/config/env";
import type { Lang } from "@/i18n/config";
import { log } from "@/lib/log";
import { site } from "@/config/site";
import { isOfficeOpen } from "@/lib/hours";
import { systemPrompt } from "./prompt";
import { correctFalseClaims, typesFromText, ensureCards, ensureHandoff, executeTool, TOOL_DEFINITIONS, type Card, type Handoff, type ToolContext } from "./tools";
import { recordUsage, budgetBlock } from "./usage";
import { loadTranscript, saveTurn, type ChatSessionState } from "./store";
import { runTurnOpenAI, type OpenAICreateFn } from "./openai-agent";

type Params = Anthropic.Beta.MessageCreateParamsNonStreaming;
type Message = Anthropic.Beta.BetaMessage;
export type CreateMessageFn = (params: Params) => Promise<Message>;

let client: Anthropic | null = null;
const defaultCreate: CreateMessageFn = (params) => {
  client ??= new Anthropic({ maxRetries: 2, timeout: 60_000 });
  return client.beta.messages.create(params);
};

export interface PageContext { type: "listing" | "catalog" | "other"; slug?: string | null; title?: string | null }

export interface TurnResult {
  mode: "ok" | "fallback" | "limit" | "refusal";
  reason?: string;
  text: string;
  cards: Card[];
  handoff: (Handoff & { propertyTitle?: string | null }) | null;
}

const SUPPORTS_SERVER_FALLBACK = /^claude-(opus-5-5|sonnet-5-5|fable-5|opus-5$)/;

export function assistantAvailable(): { ok: boolean; reason?: string } {
  if (!env.ai.enabled) return { ok: false, reason: "disabled" };
  if (!env.ai.apiKeyConfigured) return { ok: false, reason: "not_configured" };
  return { ok: true };
}

function contextMessage(state: ChatSessionState, lang: Lang, page: PageContext): string {
  const now = new Intl.DateTimeFormat("es-DO", { timeZone: "America/Santo_Domingo", dateStyle: "full", timeStyle: "short" }).format(new Date());
  const pageLine =
    page.type === "listing" && page.slug
      ? `property page: slug=${page.slug}${page.title ? `, title «${page.title.slice(0, 160)}»` : ""} (questions about "this property" refer to it)`
      : page.type === "catalog"
        ? "catalogue search page"
        : "general page";
  const handoff = !state.handoff ? "not proposed" : state.handoff.status === "sent" ? "SENT: the visitor sent their request to Elvyn; a prospect record exists" : "card shown, NOT sent yet";
  return [
    "[Site context — written by the website, not by the visitor]",
    `Date/time in the Dominican Republic: ${now}`,
    `Page language: ${lang}`,
    `Current page: ${pageLine}`,
    `Request to Elvyn: ${handoff}`,
    "Calendar connected: no (visit requests stay pending confirmation by Elvyn)",
    `Office hours: ${site.hours?.en ?? "not published"}. The office is ${isOfficeOpen() ? "OPEN now" : "CLOSED now: when handing over, say Elvyn will reply on the next business day"}.`,
    `Catalogue: ${catalogMode() === "demo" ? "DEMO snapshot of 2026-11-24, not live" : "live"}`,
  ].join("\n");
}

function textOf(content: Message["content"]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
}

/**
 * One visitor turn: append-only transcript, bounded tool loop, usage accounting, and an
 * atomic save at the end (a failed turn leaves no half-written history).
 */
export async function runTurn(
  state: ChatSessionState,
  userText: string,
  lang: Lang,
  page: PageContext,
  create: CreateMessageFn = defaultCreate,
  openaiCreate?: OpenAICreateFn,
): Promise<TurnResult> {
  const empty = { cards: [], handoff: null };
  const avail = assistantAvailable();
  if (!avail.ok) return { mode: "fallback", reason: avail.reason, text: "", ...empty };
  if (state.userTurns >= env.ai.maxTurnsPerSession) return { mode: "limit", reason: "session_turns", text: "", ...empty };
  const blocked = await budgetBlock();
  if (blocked) return { mode: "fallback", reason: blocked, text: "", ...empty };
  if (env.ai.provider === "openai") return runTurnOpenAI(state, userText, lang, page, contextMessage(state, lang, page), openaiCreate);

  const history = (await loadTranscript(state.id)) as Anthropic.Beta.BetaMessageParam[] & { role: string }[];
  const newMessages: { role: string; content: unknown; display?: Record<string, unknown> | null }[] = [
    { role: "user", content: [{ type: "text", text: userText }], display: { text: userText } },
    { role: "system", content: contextMessage(state, lang, page) },
  ];
  const ctx: ToolContext = {
    lang,
    pageSlug: page.type === "listing" ? (page.slug ?? null) : null,
    profile: { ...state.profile },
    seenSlugs: new Set(state.seenSlugs),
    handoff: state.handoff,
    cards: [],
    executed: new Map(),
    requestedTypes: typesFromText(userText),
  };
  if (ctx.pageSlug) ctx.seenSlugs.add(ctx.pageSlug);
  const handoffBefore = JSON.stringify(state.handoff);

  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }];
  const useFallbacks = SUPPORTS_SERVER_FALLBACK.test(env.ai.model);
  const texts: string[] = [];
  let refused = false;

  try {
    for (let round = 0; round <= env.ai.maxToolRounds; round++) {
      const lastRound = round === env.ai.maxToolRounds;
      const params = {
        model: env.ai.model,
        max_tokens: env.ai.maxOutputTokens,
        system,
        tools: TOOL_DEFINITIONS,
        ...(lastRound ? { tool_choice: { type: "none" as const } } : {}),
        messages: [...history, ...newMessages].map((m) => ({ role: m.role, content: m.content })) as Params["messages"],
        output_config: { effort: env.ai.effort },
        cache_control: { type: "ephemeral" as const },
        ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      } as Params;

      const res = await create(params);
      await recordUsage(state.id, res.model ?? env.ai.model, res.usage ?? {}, res.stop_reason === "refusal" ? "refusal" : "ok");
      newMessages.push({ role: "assistant", content: res.content });
      const t = textOf(res.content);
      if (t) texts.push(t);

      if (res.stop_reason === "refusal") {
        refused = true;
        break;
      }
      if (res.stop_reason !== "tool_use") break;

      const toolUses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const r = await executeTool(tu.name, tu.input, ctx);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: r.content, ...(r.isError ? { is_error: true } : {}) });
      }
      newMessages.push({ role: "user", content: results });
    }
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : null;
    log.error("ai.turn_failed", { status: status ?? null, kind: (err as Error).name });
    await recordUsage(state.id, env.ai.model, {}, "error").catch(() => undefined);
    return { mode: "fallback", reason: status === 401 || status === 403 ? "auth" : "api_error", text: "", ...empty };
  }

  // A trailing tool_use without results would corrupt the history: never persist it.
  const last = newMessages[newMessages.length - 1];
  if (last.role === "assistant" && Array.isArray(last.content) && (last.content as { type: string }[]).some((b) => b.type === "tool_use")) {
    log.warn("ai.dangling_tool_use", {});
    return { mode: "fallback", reason: "loop_guard", text: "", ...empty };
  }

  let text = refused
    ? lang === "es"
      ? "No puedo ayudar con esa solicitud. Si lo deseas, puedes hablar directamente con Elvyn."
      : "I can't help with that request. If you wish, you can talk to Elvyn directly."
    : texts[texts.length - 1] ?? "";
  if (!refused) {
    await ensureCards(ctx, text);
    ensureHandoff(userText, ctx);
    text = correctFalseClaims(text, ctx, JSON.stringify(ctx.handoff) !== handoffBefore && ctx.handoff?.status === "proposed");
  }
  const handoffChanged = JSON.stringify(ctx.handoff) !== handoffBefore && ctx.handoff?.status === "proposed";
  const display = { text, cards: ctx.cards, handoff: handoffChanged ? ctx.handoff : null };
  newMessages[newMessages.length - 1].display = display;

  state.profile = ctx.profile;
  state.seenSlugs = [...ctx.seenSlugs];
  state.handoff = ctx.handoff;
  state.userTurns += 1;
  if (ctx.pageSlug) state.propertySlug = ctx.pageSlug;
  await saveTurn(state, newMessages);
  await recordUsage(state.id, env.ai.model, {}, "turn");

  return { mode: refused ? "refusal" : "ok", text, cards: ctx.cards, handoff: display.handoff };
}
