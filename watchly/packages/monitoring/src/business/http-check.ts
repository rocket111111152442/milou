/** Contrôle HTTP d'un point de contrôle Business (statut attendu, mot-clé, temps de réponse). */
import { normalizeForMatch } from "../extract/text";
import { decodeBody, FetchError, safeFetch, type SafeFetchOptions } from "../net/safe-fetch";

export interface EndpointSpec {
  url: string;
  method: "GET" | "HEAD";
  expectedStatusMin: number;
  expectedStatusMax: number;
  expectedKeyword: string | null;
  timeoutMs: number;
  slowThresholdMs: number;
}

export interface HttpCheckResult {
  ok: boolean;
  slow: boolean;
  statusCode: number | null;
  responseMs: number;
  errorCode: string | null;
  error: string | null;
}

export async function checkEndpoint(spec: EndpointSpec, fetchOptions: SafeFetchOptions = {}): Promise<HttpCheckResult> {
  const started = Date.now();
  try {
    const res = await safeFetch(spec.url, {
      ...fetchOptions,
      method: spec.method,
      timeoutMs: spec.timeoutMs,
      maxBytes: spec.expectedKeyword ? 1024 * 1024 : 64 * 1024,
      headers: { "cache-control": "no-cache" },
    });
    const responseMs = res.durationMs;
    if (res.status < spec.expectedStatusMin || res.status > spec.expectedStatusMax) {
      return { ok: false, slow: false, statusCode: res.status, responseMs, errorCode: "unexpected_status", error: `Statut HTTP ${res.status} inattendu.` };
    }
    if (spec.expectedKeyword && spec.method === "GET") {
      const text = normalizeForMatch(decodeBody(res.body, res.contentType));
      if (!text.includes(normalizeForMatch(spec.expectedKeyword))) {
        return { ok: false, slow: false, statusCode: res.status, responseMs, errorCode: "keyword_missing", error: `Le texte « ${spec.expectedKeyword} » est absent de la page.` };
      }
    }
    return { ok: true, slow: responseMs > spec.slowThresholdMs, statusCode: res.status, responseMs, errorCode: null, error: null };
  } catch (err) {
    const fe = err instanceof FetchError ? err : null;
    return {
      ok: false,
      slow: false,
      statusCode: null,
      responseMs: Date.now() - started,
      errorCode: fe?.code ?? "network_error",
      error: fe?.message ?? "Connexion impossible.",
    };
  }
}
