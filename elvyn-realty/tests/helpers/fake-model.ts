import type Anthropic from "@anthropic-ai/sdk";

type Params = Anthropic.Beta.MessageCreateParamsNonStreaming;
type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown };
let n = 0;

export function reply(blocks: Block[], stop: "end_turn" | "tool_use" | "refusal" = blocks.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn") {
  return { id: `msg_${++n}`, type: "message", role: "assistant", model: "claude-opus-5-5", content: blocks, stop_reason: stop, stop_sequence: null, usage: { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0 } } as unknown as Anthropic.Beta.BetaMessage;
}
export const text = (t: string): Block => ({ type: "text", text: t });
export const tool = (name: string, input: unknown): Block => ({ type: "tool_use", id: `tu_${++n}`, name, input });

/** Scripted model: each step receives the request and returns the next response. */
export function scripted(steps: ((p: Params) => Anthropic.Beta.BetaMessage)[]) {
  const calls: Params[] = [];
  const fn = async (p: Params) => {
    calls.push(JSON.parse(JSON.stringify(p)));
    const step = steps[calls.length - 1];
    if (!step) throw new Error("unexpected extra model call");
    return step(p);
  };
  return { fn, calls };
}

/** Last tool_result content (parsed) sent to the model. */
export function lastToolResult(p: Params): { content: unknown; is_error?: boolean } {
  const last = p.messages[p.messages.length - 1];
  const blocks = last.content as { type: string; content?: string; is_error?: boolean }[];
  const r = blocks.find((b) => b.type === "tool_result")!;
  return { content: JSON.parse(r.content as string), is_error: r.is_error };
}
