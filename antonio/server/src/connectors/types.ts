import type { Capability, ConnectorDescriptor, ProviderId, Reversibility } from "@antonio/shared";
import type { schema } from "../db/client.js";

export type ConnectionRow = typeof schema.connections.$inferSelect;

export interface Address {
  email: string;
  name: string | null;
}

/** Message normalisé (métadonnées seulement). */
export interface MessageMeta {
  providerMessageId: string;
  providerThreadId: string;
  internetMessageId: string | null;
  from: Address;
  to: Address[];
  cc: Address[];
  subject: string;
  snippet: string;
  receivedAt: Date;
  unread: boolean;
  inTrash: boolean;
  archived: boolean;
  isSent: boolean;
  labels: string[];
  folderId: string | null;
  hasAttachments: boolean;
  /** Corps : uniquement fourni par le connecteur de démonstration. */
  demoBody?: string;
}

export interface MessageBody {
  text: string;
  attachments: { name: string; size: number; mimeType: string }[];
}

export interface EventMeta {
  providerEventId: string;
  calendarId: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  timezone: string | null;
  location: string | null;
  onlineMeetingUrl: string | null;
  attendees: { email: string; name: string | null; response: string }[];
  organizerEmail: string | null;
  status: "confirmed" | "tentative" | "cancelled";
  recurring: boolean;
  showAs: "busy" | "free";
}

export interface OutgoingMail {
  to: Address[];
  cc: Address[];
  subject: string;
  body: string;
  /** Message-ID RFC 5322 généré par Waverti pour vérifier un envoi incertain. */
  internetMessageId: string;
  inReplyTo?: { providerMessageId: string; providerThreadId: string; internetMessageId: string | null } | null;
}

export interface NewEvent {
  title: string;
  start: Date;
  end: Date;
  timezone: string;
  attendees: Address[];
  location: string | null;
  description: string | null;
  addOnlineMeeting: boolean;
}

export interface SyncResult<T> {
  upserts: T[];
  deletedIds: string[];
  cursor: Record<string, unknown>;
  full: boolean;
}

/** Erreur fournisseur classée pour décider : échec confirmé, nouvel essai ou incertitude. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public kind: "auth" | "not_found" | "conflict" | "rate_limit" | "invalid" | "transient" | "unknown",
    public status?: number,
    public retryAfterMs?: number,
  ) {
    super(message);
  }
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
  accountEmail: string;
  providerAccountId: string | null;
}

export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  descriptor(): ConnectorDescriptor;
  /** Scopes OAuth nécessaires pour chaque capacité (demande progressive). */
  scopesFor(capabilities: Capability[]): string[];
  /** Capacités réellement accordées, déduites des scopes renvoyés par le fournisseur. */
  capabilitiesFromScopes(scopes: string[]): Capability[];
  reversibility(kind: string): Reversibility;

  buildAuthUrl?(opts: { state: string; codeChallenge: string; scopes: string[]; loginHint?: string }): string;
  exchangeCode?(code: string, codeVerifier: string): Promise<OAuthTokens>;
  refreshAccessToken?(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date; refreshToken?: string | null; scopes?: string[] }>;
  revoke?(conn: ConnectionRow, token: string | null): Promise<void>;

  syncMail(conn: ConnectionRow, token: string, cursor: Record<string, unknown>): Promise<SyncResult<MessageMeta>>;
  getMessageBody(conn: ConnectionRow, token: string, providerMessageId: string): Promise<MessageBody>;
  searchMail(conn: ConnectionRow, token: string, query: string): Promise<string[]>;
  createDraft(conn: ConnectionRow, token: string, mail: OutgoingMail): Promise<{ draftId: string }>;
  sendMail(conn: ConnectionRow, token: string, mail: OutgoingMail): Promise<{ providerMessageId: string | null; providerThreadId: string | null }>;
  /** Vérifie si un envoi a eu lieu (après coupure) à partir du Message-ID généré. */
  findSent(conn: ConnectionRow, token: string, internetMessageId: string): Promise<{ providerMessageId: string } | null>;
  trash(conn: ConnectionRow, token: string, providerMessageId: string): Promise<{ revertInfo: Record<string, unknown> }>;
  untrash(conn: ConnectionRow, token: string, providerMessageId: string, revertInfo: Record<string, unknown> | null): Promise<void>;
  archive(conn: ConnectionRow, token: string, providerMessageId: string): Promise<{ revertInfo: Record<string, unknown> }>;
  applyLabel(conn: ConnectionRow, token: string, providerMessageId: string, label: string): Promise<void>;

  syncEvents(conn: ConnectionRow, token: string, cursor: Record<string, unknown>, window: { from: Date; to: Date }): Promise<SyncResult<EventMeta>>;
  freeBusy(conn: ConnectionRow, token: string, from: Date, to: Date, timezone: string): Promise<{ start: Date; end: Date }[]>;
  /** Création idempotente : la même clé ne crée jamais deux événements. */
  createEvent(conn: ConnectionRow, token: string, ev: NewEvent, idempotencyKey: string): Promise<EventMeta>;
  updateEvent(conn: ConnectionRow, token: string, providerEventId: string, patch: Partial<NewEvent>): Promise<EventMeta>;
  cancelEvent(conn: ConnectionRow, token: string, providerEventId: string, notify: boolean): Promise<void>;

  /** Abonnement aux notifications (webhooks) si disponible. */
  subscribe?(conn: ConnectionRow, token: string): Promise<Record<string, unknown>>;
  unsubscribe?(conn: ConnectionRow, token: string): Promise<void>;
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { token?: string; timeoutMs?: number } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(init.timeoutMs ?? 20000) });
  } catch (err) {
    // Coupure réseau / délai : l'effet côté fournisseur est inconnu.
    throw new ProviderError(`Réseau indisponible ou délai dépassé (${(err as Error).name})`, "transient");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = extractError(body) ?? `HTTP ${res.status}`;
    const retryAfter = Number(res.headers.get("retry-after"));
    const kind =
      res.status === 401
        ? "auth"
        : res.status === 403 && /insufficient|scope|permission/i.test(msg)
          ? "auth"
          : res.status === 404 || res.status === 410
            ? "not_found"
            : res.status === 409
              ? "conflict"
              : res.status === 429 || (res.status === 403 && /rate|quota/i.test(msg))
                ? "rate_limit"
                : res.status >= 500
                  ? "transient"
                  : res.status >= 400
                    ? "invalid"
                    : "unknown";
    throw new ProviderError(msg, kind, res.status, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined);
  }
  return body as T;
}

function extractError(body: unknown): string | null {
  if (!body || typeof body !== "object") return typeof body === "string" ? body.slice(0, 300) : null;
  const b = body as { error?: unknown; error_description?: string };
  if (typeof b.error_description === "string") return b.error_description;
  if (typeof b.error === "string") return b.error;
  if (b.error && typeof b.error === "object") {
    const e = b.error as { message?: string; code?: string };
    return e.message ?? e.code ?? null;
  }
  return null;
}

export function parseAddress(raw: string): Address {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  return { name: null, email: raw.trim().toLowerCase() };
}

export function parseAddressList(raw: string | undefined | null): Address[] {
  if (!raw) return [];
  // Découpe sur les virgules hors guillemets.
  const parts: string[] = [];
  let cur = "";
  let inQuote = false;
  for (const ch of raw) {
    if (ch === '"') inQuote = !inQuote;
    if (ch === "," && !inQuote) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map(parseAddress).filter((a) => a.email.includes("@"));
}

export function formatAddress(a: Address): string {
  if (!a.name) return a.email;
  const safe = a.name.replace(/["\\\r\n]/g, "");
  return `"${encodeHeaderWord(safe)}" <${a.email}>`;
}

/** Encodage RFC 2047 si nécessaire (caractères non ASCII dans les en-têtes). */
export function encodeHeaderWord(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}
