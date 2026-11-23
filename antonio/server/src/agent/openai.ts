import { config } from "../config.js";
import { sha256 } from "../lib/crypto.js";

/**
 * Client minimal de l'API Responses (POST /v1/responses), sans SDK pour garder
 * la maîtrise des délais, des erreurs et de la mesure de consommation.
 * Modèle texte par défaut : gpt-6-luna (texte uniquement — la voix passe par GPT-Live).
 */

export interface ResponsesTool {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: boolean;
}

export type InputItem = Record<string, unknown>;

export interface ResponsesResult {
  output: InputItem[];
  text: string;
  functionCalls: { call_id: string; name: string; arguments: string }[];
  usage: { input: number; cached: number; output: number };
}

export class ModelError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export async function createResponse(opts: { instructions: string; input: InputItem[]; tools: ResponsesTool[]; userId: string }): Promise<ResponsesResult> {
  const c = config();
  if (!c.OPENAI_API_KEY) throw new ModelError("OPENAI_API_KEY non configurée");
  const body = {
    model: c.OPENAI_TEXT_MODEL,
    instructions: opts.instructions,
    input: opts.input,
    tools: opts.tools,
    tool_choice: "auto",
    parallel_tool_calls: false,
    reasoning: { effort: c.OPENAI_TEXT_REASONING },
    store: false,
    // Identifiant stable et non réversible de l'utilisateur final (recommandé par OpenAI).
    safety_identifier: sha256(`antonio:${opts.userId}`).slice(0, 64),
  };
  let res: Response;
  try {
    res = await fetch(`${c.OPENAI_BASE_URL}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    throw new ModelError(`Service IA injoignable (${(e as Error).name})`);
  }
  const json = (await res.json().catch(() => ({}))) as {
    output?: InputItem[];
    usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
    error?: { message?: string };
  };
  if (!res.ok) throw new ModelError(json.error?.message ?? `HTTP ${res.status}`, res.status);
  const output = json.output ?? [];
  let text = "";
  const functionCalls: ResponsesResult["functionCalls"] = [];
  for (const item of output) {
    if (item.type === "message") {
      for (const part of (item.content as { type: string; text?: string }[]) ?? []) if (part.type === "output_text" && part.text) text += part.text;
    } else if (item.type === "function_call") {
      functionCalls.push({ call_id: item.call_id as string, name: item.name as string, arguments: item.arguments as string });
    }
  }
  return {
    output,
    text,
    functionCalls,
    usage: {
      input: json.usage?.input_tokens ?? 0,
      cached: json.usage?.input_tokens_details?.cached_tokens ?? 0,
      output: json.usage?.output_tokens ?? 0,
    },
  };
}
