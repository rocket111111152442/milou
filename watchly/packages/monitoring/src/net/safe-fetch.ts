/**
 * Récupération HTTP sécurisée d'une URL publique.
 *  - La résolution DNS et la validation de l'IP sont faites DANS la fonction `lookup` utilisée
 *    pour ouvrir la connexion : l'adresse contactée est exactement l'adresse validée
 *    (pas de fenêtre de DNS rebinding entre vérification et connexion).
 *  - Redirections suivies manuellement (5 max), chacune revalidée (protocole, port, hôte, IP).
 *  - Délais (connexion, en-têtes, corps, global), taille maximale APRÈS décompression.
 */
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { Readable } from "node:stream";
import { Agent, request } from "undici";
import { USER_AGENT } from "@watchly/config/constants";
import { BlockedAddressError, isPublicAddress } from "./ip-policy";
import { InvalidTargetError, parseTargetUrl, type UrlPolicyOptions } from "./safe-url";

export type Resolver = (hostname: string) => Promise<LookupAddress[]>;

export interface SafeFetchOptions extends UrlPolicyOptions {
  method?: "GET" | "HEAD";
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  accept?: string;
  allowedContentTypes?: RegExp;
  allowLoopback?: boolean;
  resolver?: Resolver;
  headers?: Record<string, string>;
}

export interface SafeFetchResult {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  contentType: string;
  body: Buffer;
  truncated: boolean;
  redirects: number;
  durationMs: number;
  remoteAddress: string | null;
}

export class FetchError extends Error {
  constructor(
    public readonly code:
      | "timeout"
      | "too_many_redirects"
      | "too_large"
      | "unsupported_content"
      | "network_error"
      | "blocked_address"
      | "invalid_url"
      | "blocked_port"
      | "blocked_host"
      | "unsupported_protocol"
      | "credentials_in_url"
      | "dns_error",
    message: string,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

const defaultResolver: Resolver = (hostname) =>
  new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => (err ? reject(err) : resolve(addresses)));
  });

function guardedLookup(resolver: Resolver, allowLoopback: boolean, state: { address: string | null }): LookupFunction {
  return ((hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
    resolver(hostname)
      .then((addresses) => {
        if (!addresses.length) throw new FetchError("dns_error", `Aucune adresse pour ${hostname}`);
        // Stratégie stricte : si UNE des adresses est non publique, on refuse (anti round-robin).
        for (const a of addresses) {
          if (!isPublicAddress(a.address, { allowLoopback })) throw new BlockedAddressError(hostname);
        }
        state.address = addresses[0]!.address;
        if (options?.all) callback(null, addresses);
        else callback(null, addresses[0]!.address, addresses[0]!.family);
      })
      .catch((err) => callback(err));
  }) as unknown as LookupFunction;
}

/** Abandonne un corps de réponse sans lever d'erreur non gérée. */
function discard(body: { dump?: (o?: { limit?: number }) => Promise<void>; on?: (e: string, f: () => void) => void; destroy?: () => void }): void {
  body.on?.("error", () => undefined);
  if (body.dump) body.dump({ limit: 64 * 1024 }).catch(() => undefined);
  else body.destroy?.();
}

async function readCapped(stream: Readable, encoding: string | undefined, maxBytes: number): Promise<{ body: Buffer; truncated: boolean }> {
  stream.on("error", () => undefined);
  let source: Readable = stream;
  const enc = (encoding ?? "").toLowerCase().trim();
  if (enc === "gzip" || enc === "x-gzip") source = stream.pipe(createGunzip());
  else if (enc === "br") source = stream.pipe(createBrotliDecompress());
  else if (enc === "deflate") source = stream.pipe(createInflate());
  if (source !== stream) source.on("error", () => undefined);
  const chunks: Buffer[] = [];
  let total = 0;
  let truncated = false;
  try {
    for await (const chunk of source) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      if (total + buf.length > maxBytes) {
        chunks.push(buf.subarray(0, maxBytes - total));
        total = maxBytes;
        truncated = true;
        break;
      }
      chunks.push(buf);
      total += buf.length;
    }
  } finally {
    stream.destroy();
    if (source !== stream) source.destroy();
  }
  return { body: Buffer.concat(chunks, total), truncated };
}

export async function safeFetch(input: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const started = Date.now();
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const maxRedirects = opts.maxRedirects ?? 5;
  const allowLoopback = Boolean(opts.allowLoopback) && process.env.NODE_ENV !== "production";
  const signal = AbortSignal.timeout(timeoutMs);
  const state = { address: null as string | null };
  const agent = new Agent({
    connect: { lookup: guardedLookup(opts.resolver ?? defaultResolver, allowLoopback, state), timeout: Math.min(timeoutMs, 10_000) },
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
    connections: 1,
    pipelining: 0,
  });
  let current: URL;
  try {
    current = parseTargetUrl(input, opts);
  } catch (err) {
    await agent.close();
    if (err instanceof InvalidTargetError) throw new FetchError(err.code, err.message);
    throw err;
  }
  const url = current.toString();
  try {
    for (let redirects = 0; ; redirects++) {
      // Une adresse IP littérale est validée directement (pas de lookup DNS dans ce cas).
      const literal = current.hostname.replace(/^\[|\]$/g, "");
      if (/^[\d.]+$/.test(literal) || literal.includes(":")) {
        if (!isPublicAddress(literal, { allowLoopback })) throw new BlockedAddressError(current.hostname);
        state.address = literal;
      }
      const res = await request(current, {
        dispatcher: agent,
        method: opts.method ?? "GET",
        signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: opts.accept ?? "text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8,*/*;q=0.1",
          "accept-language": "fr-FR,fr;q=0.9,en;q=0.6",
          "accept-encoding": "gzip, br, deflate",
          ...(opts.headers ?? {}),
        },
      });
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v ?? "");

      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        discard(res.body as never);
        if (redirects >= maxRedirects) throw new FetchError("too_many_redirects", "Trop de redirections");
        const location = headers.location;
        if (!location) throw new FetchError("network_error", "Redirection sans destination");
        try {
          current = parseTargetUrl(new URL(location, current).toString(), opts);
        } catch (err) {
          if (err instanceof InvalidTargetError) throw new FetchError(err.code, `Redirection refusée : ${err.message}`);
          throw err;
        }
        continue;
      }

      const contentType = (headers["content-type"] ?? "").toLowerCase();
      if (opts.allowedContentTypes && contentType && !opts.allowedContentTypes.test(contentType)) {
        discard(res.body as never);
        throw new FetchError("unsupported_content", `Type de contenu non pris en charge (${contentType.split(";")[0]})`);
      }
      const declared = Number(headers["content-length"] ?? 0);
      if (declared && declared > maxBytes * 4) {
        discard(res.body as never);
        throw new FetchError("too_large", "Page trop volumineuse");
      }
      const { body, truncated } =
        opts.method === "HEAD" ? { body: Buffer.alloc(0), truncated: false } : await readCapped(res.body as unknown as Readable, headers["content-encoding"], maxBytes);
      return {
        url,
        finalUrl: current.toString(),
        status: res.statusCode,
        headers,
        contentType,
        body,
        truncated,
        redirects,
        durationMs: Date.now() - started,
        remoteAddress: state.address,
      };
    }
  } catch (err) {
    throw normalizeFetchError(err, signal);
  } finally {
    agent.close().catch(() => undefined);
  }
}

export function normalizeFetchError(err: unknown, signal?: AbortSignal): FetchError {
  if (err instanceof FetchError) return err;
  if (err instanceof BlockedAddressError) return new FetchError("blocked_address", err.message);
  const e = err as { name?: string; code?: string; cause?: unknown; message?: string };
  if (e?.cause instanceof BlockedAddressError) return new FetchError("blocked_address", e.cause.message);
  if (e?.cause instanceof FetchError) return e.cause;
  if (signal?.aborted || e?.name === "TimeoutError" || e?.name === "AbortError" || e?.code === "UND_ERR_HEADERS_TIMEOUT" || e?.code === "UND_ERR_BODY_TIMEOUT" || e?.code === "UND_ERR_CONNECT_TIMEOUT") {
    return new FetchError("timeout", "Délai dépassé");
  }
  if (e?.code === "ENOTFOUND" || e?.code === "EAI_AGAIN") return new FetchError("dns_error", "Nom de domaine introuvable");
  return new FetchError("network_error", "Connexion impossible");
}

/** Décode le corps en texte selon le charset déclaré (en-tête ou balise meta). */
export function decodeBody(body: Buffer, contentType: string): string {
  let charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().replace(/["']/g, "");
  if (!charset) {
    const head = body.subarray(0, 2048).toString("latin1");
    charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  }
  const label = (charset ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(label === "iso-8859-1" ? "windows-1252" : label, { fatal: false }).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}
