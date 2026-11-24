import "server-only";
import OpenAI from "openai";
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { env } from "@/config/env";
import type { Lang } from "@/i18n/config";
import { log } from "@/lib/log";
import { systemPrompt } from "./prompt";
import { correctFalseClaims, ensureCards, ensureHandoff, executeTool, TOOL_DEFINITIONS, type ToolContext } from "./tools";
import { recordUsage } from "./usage";
import { loadTranscript, saveTurn, type ChatSessionState } from "./store";
import type { PageContext, TurnResult } from "./agent";

export type OpenAICreateFn = (params: ChatCompletionCreateParamsNonStreaming) => Promise<ChatCompletion>;

let client: OpenAI | null = null;
const defaultCreate: OpenAICreateFn = (params) => {
  client ??= new OpenAI({ maxRetries: 2, timeout: 60_000 });
  return client.chat.completions.create(params);
};

/** Same tools as the Claude version, in OpenAI function-calling format (validated server-side with Zod). */
export const OPENAI_TOOLS: ChatCompletionTool[] = TOOL_DEFINITIONS.map((t) => ({
  type: "function",
  function: { name: t.name, description: t.description ?? "", parameters: t.input_schema as Record<string, unknown> },
}));

/** Models tried in order if the configured one is not available on the account. */
function modelChain(): string[] {
  return [...new Set([env.ai.model, "gpt-5.4-mini", "gpt-4.1-mini"])];
}
let workingModel: string | null = null;
let reasoningSupported = true;

/**
 * One visitor turn with OpenAI: append-only transcript (OpenAI message format), bounded tool loop,
 * usage accounting and an atomic save at the end.
 */
export async function runTurnOpenAI(
  state: ChatSessionState,
  userText: string,
  lang: Lang,
  page: PageContext,
  contextText: string,
  create: OpenAICreateFn = defaultCreate,
): Promise<TurnResult> {
  const empty = { cards: [], handoff: null };
  const history = (await loadTranscript(state.id)) as ChatCompletionMessageParam[];
  const newMessages: { role: string; content: unknown; display?: Record<string, unknown> | null; raw: ChatCompletionMessageParam }[] = [];
  const push = (m: ChatCompletionMessageParam, display?: Record<string, unknown> | null) =>
    newMessages.push({ role: m.role, content: m, display: display ?? null, raw: m });
  push({ role: "user", content: userText }, { text: userText });
  push({ role: "system", content: contextText });

  const ctx: ToolContext = {
    lang,
    pageSlug: page.type === "listing" ? (page.slug ?? null) : null,
    profile: { ...state.profile },
    seenSlugs: new Set(state.seenSlugs),
    handoff: state.handoff,
    cards: [],
    executed: new Map(),
  };
  if (ctx.pageSlug) ctx.seenSlugs.add(ctx.pageSlug);
  const handoffBefore = JSON.stringify(state.handoff);
  // Stored rows hold the OpenAI message itself in `content`.
  const replay = history.map((h) => ((h as unknown as { content: unknown }).content ?? h) as ChatCompletionMessageParam);
  let finalText = "";
  let refused = false;

  try {
    for (let round = 0; round <= env.ai.maxToolRounds; round++) {
      const lastRound = round === env.ai.maxToolRounds;
      let res: ChatCompletion | null = null;
      for (const model of workingModel ? [workingModel] : modelChain()) {
        const reasoning = /^(gpt-5|o\d)/.test(model) && reasoningSupported && env.ai.reasoningEffort ? env.ai.reasoningEffort : null;
        const params = {
          model,
          // Reasoning models spend part of this budget thinking: give them more room.
          max_completion_tokens: reasoning ? Math.max(env.ai.maxOutputTokens, 4000) : env.ai.maxOutputTokens,
          messages: [{ role: "system" as const, content: systemPrompt() }, ...replay, ...newMessages.map((m) => m.raw)],
          tools: OPENAI_TOOLS,
          tool_choice: lastRound ? ("none" as const) : ("auto" as const),
          parallel_tool_calls: true,
          ...(reasoning ? { reasoning_effort: reasoning as ChatCompletionCreateParamsNonStreaming["reasoning_effort"] } : {}),
        } satisfies ChatCompletionCreateParamsNonStreaming;
        try {
          res = await create(params);
          workingModel = model;
          break;
        } catch (err) {
          const status = err instanceof OpenAI.APIError ? err.status : null;
          const message = (err as Error).message ?? "";
          if (status === 400 && reasoning && /reasoning/i.test(message)) {
            // The model refuses this parameter: retry once without it.
            reasoningSupported = false;
            const { reasoning_effort: _drop, ...rest } = params as typeof params & { reasoning_effort?: unknown };
            void _drop;
            res = await create(rest);
            workingModel = model;
            break;
          }
          if (status === 404 || (status === 400 && /model/i.test(message) && !/reasoning|parameter/i.test(message))) {
            log.warn("ai.openai_model_unavailable", { model });
            continue;
          }
          throw err;
        }
      }
      if (!res) throw new Error("no_model_available");

      const cached = res.usage?.prompt_tokens_details?.cached_tokens ?? 0;
      await recordUsage(state.id, res.model ?? workingModel ?? env.ai.model, {
        input_tokens: (res.usage?.prompt_tokens ?? 0) - cached,
        cache_read_input_tokens: cached,
        output_tokens: res.usage?.completion_tokens ?? 0,
      }, "ok");

      const choice = res.choices[0];
      const msg = choice.message;
      if (choice.finish_reason === "content_filter" || msg.refusal) {
        refused = true;
        push({ role: "assistant", content: msg.refusal ?? "" });
        break;
      }
      const toolCalls = (msg.tool_calls ?? []).filter((c) => c.type === "function");
      push({ role: "assistant", content: msg.content ?? "", ...(toolCalls.length ? { tool_calls: toolCalls } : {}) });
      if (msg.content) finalText = msg.content;
      if (!toolCalls.length) break;

      for (const call of toolCalls) {
        let input: unknown = {};
        try {
          input = JSON.parse(call.function.arguments || "{}");
        } catch {
          input = { __invalid_json: true };
        }
        const r = await executeTool(call.function.name, input, ctx);
        push({ role: "tool", tool_call_id: call.id, content: r.content });
      }
    }
  } catch (err) {
    const status = err instanceof OpenAI.APIError ? err.status : null;
    log.error("ai.turn_failed", { provider: "openai", status: status ?? null, kind: (err as Error).name });
    await recordUsage(state.id, env.ai.model, {}, "error").catch(() => undefined);
    return { mode: "fallback", reason: status === 401 || status === 403 ? "auth" : status === 429 ? "quota" : "api_error", text: "", ...empty };
  }

  const last = newMessages[newMessages.length - 1].raw;
  if (last.role === "tool" || (last.role === "assistant" && "tool_calls" in last && last.tool_calls?.length)) {
    log.warn("ai.dangling_tool_use", { provider: "openai" });
    return { mode: "fallback", reason: "loop_guard", text: "", ...empty };
  }

  let text = refused
    ? lang === "es"
      ? "No puedo ayudar con esa solicitud. Si lo deseas, puedes hablar directamente con Elvyn."
      : "I can't help with that request. If you wish, you can talk to Elvyn directly."
    : finalText.trim();
  if (!refused) {
    await ensureCards(ctx, text);
    ensureHandoff(userText, ctx);
    const corrected = correctFalseClaims(text, ctx);
    if (corrected !== text) {
      // Keep the corrected wording in the history too, so the model does not repeat the false claim.
      const lastMsg = newMessages[newMessages.length - 1];
      if (lastMsg.raw.role === "assistant") {
        lastMsg.raw = { ...lastMsg.raw, content: corrected } as ChatCompletionMessageParam;
        lastMsg.content = lastMsg.raw;
      }
      text = corrected;
    }
  }
  const handoffChanged = JSON.stringify(ctx.handoff) !== handoffBefore && ctx.handoff?.status === "proposed";
  const display = { text, cards: ctx.cards, handoff: handoffChanged ? ctx.handoff : null };
  newMessages[newMessages.length - 1].display = display;

  state.profile = ctx.profile;
  state.seenSlugs = [...ctx.seenSlugs];
  state.handoff = ctx.handoff;
  state.userTurns += 1;
  if (ctx.pageSlug) state.propertySlug = ctx.pageSlug;
  await saveTurn(state, newMessages.map(({ role, content, display }) => ({ role, content, display })));
  await recordUsage(state.id, env.ai.model, {}, "turn");
  return { mode: refused ? "refusal" : "ok", text, cards: ctx.cards, handoff: display.handoff };
}

export function __resetOpenAIModelForTests() {
  workingModel = null;
  reasoningSupported = true;
}
