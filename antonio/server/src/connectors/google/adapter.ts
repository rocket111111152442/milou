import type { Capability, ConnectorDescriptor, Reversibility } from "@antonio/shared";
import { apiPublicUrl, config } from "../../config.js";
import { randomToken } from "../../lib/crypto.js";
import {
  type ConnectionRow,
  type EventMeta,
  type MessageBody,
  type MessageMeta,
  type NewEvent,
  type OAuthTokens,
  type OutgoingMail,
  type ProviderAdapter,
  type SyncResult,
  ProviderError,
  encodeHeaderWord,
  fetchJson,
  formatAddress,
  parseAddress,
  parseAddressList,
} from "../types.js";

/**
 * Connecteur Google : Gmail API v1 + Google Calendar API v3.
 * Références (consultées le 2026-11-23) :
 *  - https://developers.google.com/workspace/gmail/api/guides/sync (history.list, 404 => resynchronisation complète)
 *  - https://developers.google.com/workspace/gmail/api/guides/push (users.watch + Pub/Sub)
 *  - https://developers.google.com/workspace/calendar/api/guides/sync (syncToken, 410 => resynchronisation)
 *  - https://developers.google.com/identity/protocols/oauth2/web-server (PKCE, include_granted_scopes)
 */

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const CAL = "https://www.googleapis.com/calendar/v3";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

const S = {
  readonly: "https://www.googleapis.com/auth/gmail.readonly",
  compose: "https://www.googleapis.com/auth/gmail.compose",
  send: "https://www.googleapis.com/auth/gmail.send",
  modify: "https://www.googleapis.com/auth/gmail.modify",
  full: "https://mail.google.com/",
  calRead: "https://www.googleapis.com/auth/calendar.readonly",
  calEvents: "https://www.googleapis.com/auth/calendar.events",
};

const CAPABILITY_SCOPES: Record<Capability, string[]> = {
  "mail.read": [S.readonly],
  // gmail.compose permet aussi l'envoi : Antonio n'envoie pourtant rien sans règle ou validation.
  "mail.draft": [S.compose],
  "mail.send": [S.send],
  "mail.modify": [S.modify],
  "mail.delete_permanent": [S.full],
  "calendar.read": [S.calRead],
  "calendar.write": [S.calEvents],
};

function redirectUri() {
  return `${apiPublicUrl()}/api/oauth/google/callback`;
}

interface GmailHeader {
  name: string;
  value: string;
}
interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}
interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
}

const header = (m: GmailMessage, name: string) =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;

function toMeta(m: GmailMessage): MessageMeta {
  const labels = m.labelIds ?? [];
  return {
    providerMessageId: m.id,
    providerThreadId: m.threadId,
    internetMessageId: header(m, "Message-ID") ?? header(m, "Message-Id"),
    from: parseAddress(header(m, "From") ?? "inconnu@invalid"),
    to: parseAddressList(header(m, "To")),
    cc: parseAddressList(header(m, "Cc")),
    subject: header(m, "Subject") ?? "",
    snippet: decodeEntities(m.snippet ?? ""),
    receivedAt: new Date(Number(m.internalDate ?? Date.now())),
    unread: labels.includes("UNREAD"),
    inTrash: labels.includes("TRASH"),
    archived: !labels.includes("INBOX") && !labels.includes("TRASH") && !labels.includes("SENT"),
    isSent: labels.includes("SENT"),
    labels,
    folderId: null,
    // En format « metadata », la présence d'un multipart/mixed indique des pièces jointes.
    hasAttachments: m.payload?.mimeType === "multipart/mixed",
  };
}

function decodeEntities(s: string) {
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function b64urlDecode(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

export function buildMime(mail: OutgoingMail, fromEmail: string): string {
  const lines = [
    `From: ${fromEmail}`,
    `To: ${mail.to.map(formatAddress).join(", ")}`,
    ...(mail.cc.length ? [`Cc: ${mail.cc.map(formatAddress).join(", ")}`] : []),
    `Subject: ${encodeHeaderWord(mail.subject)}`,
    `Message-ID: ${mail.internetMessageId}`,
    ...(mail.inReplyTo?.internetMessageId
      ? [`In-Reply-To: ${mail.inReplyTo.internetMessageId}`, `References: ${mail.inReplyTo.internetMessageId}`]
      : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(mail.body, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

const METADATA_HEADERS = ["From", "To", "Cc", "Subject", "Message-ID", "Date"];
const MAX_FETCH_PER_SYNC = 150;

async function getMeta(token: string, id: string): Promise<GmailMessage> {
  const q = new URLSearchParams({ format: "metadata" });
  for (const h of METADATA_HEADERS) q.append("metadataHeaders", h);
  return fetchJson<GmailMessage>(`${GMAIL}/messages/${id}?${q}`, { token });
}

function toEvent(e: GoogleEvent, calendarId: string): EventMeta {
  const allDay = Boolean(e.start?.date);
  const start = allDay ? new Date(`${e.start!.date}T00:00:00Z`) : new Date(e.start?.dateTime ?? 0);
  const end = allDay ? new Date(`${e.end!.date}T00:00:00Z`) : new Date(e.end?.dateTime ?? 0);
  return {
    providerEventId: e.id,
    calendarId,
    title: e.summary ?? "(sans titre)",
    start,
    end,
    allDay,
    timezone: e.start?.timeZone ?? null,
    location: e.location ?? null,
    onlineMeetingUrl: e.hangoutLink ?? e.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ?? null,
    attendees: (e.attendees ?? []).map((a) => ({ email: a.email.toLowerCase(), name: a.displayName ?? null, response: a.responseStatus ?? "needsAction" })),
    organizerEmail: e.organizer?.email?.toLowerCase() ?? null,
    status: (e.status as EventMeta["status"]) ?? "confirmed",
    recurring: Boolean(e.recurringEventId || e.recurrence),
    showAs: e.transparency === "transparent" ? "free" : "busy",
  };
}

interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  hangoutLink?: string;
  transparency?: string;
  recurringEventId?: string;
  recurrence?: string[];
  organizer?: { email?: string };
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
}

/** Identifiant d'événement Google : base32hex (a-v, 0-9), 5 à 1024 caractères. */
export function googleEventIdFromKey(key: string): string {
  const hex = Buffer.from(key).toString("hex");
  // hex ⊂ base32hex (0-9a-f) : identifiant stable et valide.
  return `ant${hex}`.slice(0, 1000);
}

export const googleAdapter: ProviderAdapter = {
  id: "google",
  label: "Google (Gmail et Google Agenda)",

  descriptor(): ConnectorDescriptor {
    const configured = Boolean(config().GOOGLE_CLIENT_ID && config().GOOGLE_CLIENT_SECRET);
    return {
      id: "google",
      label: "Gmail et Google Agenda",
      status: configured ? "available" : "needs_configuration",
      reads: ["Messages Gmail (métadonnées synchronisées, contenu lu à la demande)", "Événements du calendrier principal", "Disponibilités (free/busy)"],
      writes: [
        "Brouillons et envois Gmail",
        "Libellés, archivage, corbeille et restauration",
        "Création, modification et annulation d'événements avec invitations",
        "Lien Google Meet lorsque le compte le permet",
      ],
      unsupported: [
        "Annulation d'un e-mail déjà envoyé (l'« annuler l'envoi » de Gmail n'existe pas dans l'API)",
        "Suppression définitive sans autorisation explicite et scope complet",
        "Calendriers secondaires (prévu)",
      ],
      notes: [
        "Les scopes Gmail sont « restreints » : au-delà de 100 utilisateurs, Google exige une vérification de l'application et un audit de sécurité.",
        "Notifications en temps réel via Pub/Sub si GOOGLE_PUBSUB_TOPIC est configuré ; sinon synchronisation périodique.",
      ],
    };
  },

  scopesFor(capabilities) {
    const scopes = new Set<string>(["openid", "email"]);
    for (const c of capabilities) for (const s of CAPABILITY_SCOPES[c] ?? []) scopes.add(s);
    return [...scopes];
  },

  capabilitiesFromScopes(scopes) {
    const has = (s: string) => scopes.includes(s);
    const caps: Capability[] = [];
    const fullMail = has(S.full);
    if (fullMail || has(S.readonly) || has(S.modify)) caps.push("mail.read");
    if (fullMail || has(S.compose)) caps.push("mail.draft");
    if (fullMail || has(S.send) || has(S.compose)) caps.push("mail.send");
    if (fullMail || has(S.modify)) caps.push("mail.modify");
    if (fullMail) caps.push("mail.delete_permanent");
    if (has(S.calRead) || has(S.calEvents) || has("https://www.googleapis.com/auth/calendar")) caps.push("calendar.read");
    if (has(S.calEvents) || has("https://www.googleapis.com/auth/calendar")) caps.push("calendar.write");
    return caps;
  },

  reversibility(kind): Reversibility {
    if (kind === "email.trash" || kind === "email.archive" || kind === "email.label" || kind === "email.untrash") return "reversible";
    if (kind === "calendar.create" || kind === "calendar.update") return "partial"; // les invités ont déjà reçu l'invitation
    return "irreversible";
  },

  buildAuthUrl({ state, codeChallenge, scopes, loginHint }) {
    const q = new URLSearchParams({
      client_id: config().GOOGLE_CLIENT_ID ?? "",
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    if (loginHint) q.set("login_hint", loginHint);
    return `${AUTH_URL}?${q}`;
  },

  async exchangeCode(code, codeVerifier): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      code,
      code_verifier: codeVerifier,
      client_id: config().GOOGLE_CLIENT_ID ?? "",
      client_secret: config().GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    });
    const t = await fetchJson<{ access_token: string; refresh_token?: string; expires_in: number; scope: string; id_token?: string }>(TOKEN_URL, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const info = await fetchJson<{ email: string; sub: string }>("https://openidconnect.googleapis.com/v1/userinfo", { token: t.access_token });
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token ?? null,
      expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000),
      scopes: t.scope.split(" "),
      accountEmail: info.email.toLowerCase(),
      providerAccountId: info.sub,
    };
  },

  async refreshAccessToken(refreshToken) {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config().GOOGLE_CLIENT_ID ?? "",
      client_secret: config().GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    });
    const t = await fetchJson<{ access_token: string; expires_in: number; scope?: string }>(TOKEN_URL, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return { accessToken: t.access_token, expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000), scopes: t.scope?.split(" ") };
  },

  async revoke(_conn, token) {
    if (!token) return;
    await fetchJson(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }).catch(
      () => undefined,
    );
  },

  // ----------------------------------------------------------------- Gmail
  async syncMail(_conn, token, cursor): Promise<SyncResult<MessageMeta>> {
    const historyId = cursor.historyId as string | undefined;
    if (historyId) {
      try {
        const changed = new Set<string>();
        const deleted = new Set<string>();
        let pageToken: string | undefined;
        let latest = historyId;
        do {
          const q = new URLSearchParams({ startHistoryId: historyId, maxResults: "100" });
          for (const t of ["messageAdded", "messageDeleted", "labelAdded", "labelRemoved"]) q.append("historyTypes", t);
          if (pageToken) q.set("pageToken", pageToken);
          const page = await fetchJson<{
            history?: { messagesAdded?: { message: { id: string } }[]; messagesDeleted?: { message: { id: string } }[]; labelsAdded?: { message: { id: string } }[]; labelsRemoved?: { message: { id: string } }[] }[];
            historyId: string;
            nextPageToken?: string;
          }>(`${GMAIL}/history?${q}`, { token });
          for (const h of page.history ?? []) {
            for (const x of h.messagesAdded ?? []) changed.add(x.message.id);
            for (const x of h.labelsAdded ?? []) changed.add(x.message.id);
            for (const x of h.labelsRemoved ?? []) changed.add(x.message.id);
            for (const x of h.messagesDeleted ?? []) deleted.add(x.message.id);
          }
          latest = page.historyId ?? latest;
          pageToken = page.nextPageToken;
        } while (pageToken && changed.size < MAX_FETCH_PER_SYNC);
        const upserts: MessageMeta[] = [];
        for (const id of [...changed].filter((id) => !deleted.has(id)).slice(0, MAX_FETCH_PER_SYNC)) {
          try {
            upserts.push(toMeta(await getMeta(token, id)));
          } catch (e) {
            if (e instanceof ProviderError && e.kind === "not_found") deleted.add(id);
            else throw e;
          }
        }
        return { upserts, deletedIds: [...deleted], cursor: { historyId: latest }, full: false };
      } catch (e) {
        // historyId trop ancien : Google renvoie 404, il faut une resynchronisation complète.
        if (!(e instanceof ProviderError && e.kind === "not_found")) throw e;
      }
    }
    const profile = await fetchJson<{ historyId: string }>(`${GMAIL}/profile`, { token });
    const list = await fetchJson<{ messages?: { id: string }[] }>(`${GMAIL}/messages?${new URLSearchParams({ q: "newer_than:14d", maxResults: "100" })}`, {
      token,
    });
    const upserts: MessageMeta[] = [];
    for (const m of list.messages ?? []) upserts.push(toMeta(await getMeta(token, m.id)));
    return { upserts, deletedIds: [], cursor: { historyId: profile.historyId }, full: true };
  },

  async getMessageBody(_conn, token, id): Promise<MessageBody> {
    const m = await fetchJson<GmailMessage>(`${GMAIL}/messages/${id}?format=full`, { token });
    let plain: string | null = null;
    let html: string | null = null;
    const attachments: MessageBody["attachments"] = [];
    const walk = (p?: GmailPart) => {
      if (!p) return;
      if (p.filename) attachments.push({ name: p.filename, size: p.body?.size ?? 0, mimeType: p.mimeType ?? "application/octet-stream" });
      else if (p.mimeType === "text/plain" && p.body?.data && plain === null) plain = b64urlDecode(p.body.data);
      else if (p.mimeType === "text/html" && p.body?.data && html === null) html = b64urlDecode(p.body.data);
      p.parts?.forEach(walk);
    };
    walk(m.payload);
    const text = plain ?? (html ? htmlToText(html) : m.snippet ?? "");
    return { text, attachments };
  },

  async searchMail(_conn, token, query) {
    const r = await fetchJson<{ messages?: { id: string }[] }>(`${GMAIL}/messages?${new URLSearchParams({ q: query, maxResults: "25" })}`, { token });
    return (r.messages ?? []).map((m) => m.id);
  },

  async createDraft(conn, token, mail) {
    const r = await fetchJson<{ id: string }>(`${GMAIL}/drafts`, {
      method: "POST",
      token,
      body: JSON.stringify({ message: { raw: buildMime(mail, conn.accountEmail), threadId: mail.inReplyTo?.providerThreadId } }),
    });
    return { draftId: r.id };
  },

  async sendMail(conn, token, mail) {
    const r = await fetchJson<{ id: string; threadId: string }>(`${GMAIL}/messages/send`, {
      method: "POST",
      token,
      timeoutMs: 30000,
      body: JSON.stringify({ raw: buildMime(mail, conn.accountEmail), threadId: mail.inReplyTo?.providerThreadId }),
    });
    return { providerMessageId: r.id, providerThreadId: r.threadId };
  },

  async findSent(_conn, token, internetMessageId) {
    const id = internetMessageId.replace(/^<|>$/g, "");
    const r = await fetchJson<{ messages?: { id: string }[] }>(`${GMAIL}/messages?${new URLSearchParams({ q: `rfc822msgid:${id}`, maxResults: "1" })}`, { token });
    return r.messages?.[0] ? { providerMessageId: r.messages[0].id } : null;
  },

  async trash(_conn, token, id) {
    await fetchJson(`${GMAIL}/messages/${id}/trash`, { method: "POST", token });
    return { revertInfo: { method: "untrash" } };
  },

  async untrash(_conn, token, id) {
    await fetchJson(`${GMAIL}/messages/${id}/untrash`, { method: "POST", token });
  },

  async archive(_conn, token, id) {
    await fetchJson(`${GMAIL}/messages/${id}/modify`, { method: "POST", token, body: JSON.stringify({ removeLabelIds: ["INBOX"] }) });
    return { revertInfo: { addLabelIds: ["INBOX"] } };
  },

  async applyLabel(_conn, token, id, label) {
    const labels = await fetchJson<{ labels: { id: string; name: string }[] }>(`${GMAIL}/labels`, { token });
    let target = labels.labels.find((l) => l.name === label);
    if (!target) {
      target = await fetchJson<{ id: string; name: string }>(`${GMAIL}/labels`, {
        method: "POST",
        token,
        body: JSON.stringify({ name: label, labelListVisibility: "labelShow", messageListVisibility: "show" }),
      });
    }
    await fetchJson(`${GMAIL}/messages/${id}/modify`, { method: "POST", token, body: JSON.stringify({ addLabelIds: [target.id] }) });
  },

  // -------------------------------------------------------------- Calendar
  async syncEvents(_conn, token, cursor, window): Promise<SyncResult<EventMeta>> {
    const syncToken = cursor.calendarSyncToken as string | undefined;
    const run = async (useToken: boolean) => {
      const upserts: EventMeta[] = [];
      const deletedIds: string[] = [];
      let pageToken: string | undefined;
      let nextSyncToken: string | undefined;
      do {
        const q = new URLSearchParams({ singleEvents: "true", maxResults: "250" });
        if (useToken && syncToken) q.set("syncToken", syncToken);
        else {
          q.set("timeMin", window.from.toISOString());
        }
        if (pageToken) q.set("pageToken", pageToken);
        const page = await fetchJson<{ items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string }>(
          `${CAL}/calendars/primary/events?${q}`,
          { token },
        );
        for (const e of page.items ?? []) {
          if (e.status === "cancelled") deletedIds.push(e.id);
          else if (e.start) upserts.push(toEvent(e, "primary"));
        }
        pageToken = page.nextPageToken;
        nextSyncToken = page.nextSyncToken ?? nextSyncToken;
      } while (pageToken);
      return { upserts, deletedIds, cursor: { calendarSyncToken: nextSyncToken }, full: !useToken };
    };
    if (syncToken) {
      try {
        return await run(true);
      } catch (e) {
        // 410 GONE : jeton expiré, resynchronisation complète.
        if (!(e instanceof ProviderError && e.kind === "not_found")) throw e;
      }
    }
    return run(false);
  },

  async freeBusy(_conn, token, from, to, timezone) {
    const r = await fetchJson<{ calendars: Record<string, { busy: { start: string; end: string }[] }> }>(`${CAL}/freeBusy`, {
      method: "POST",
      token,
      body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), timeZone: timezone, items: [{ id: "primary" }] }),
    });
    return (r.calendars.primary?.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
  },

  async createEvent(_conn, token, ev, idempotencyKey) {
    const eventId = googleEventIdFromKey(idempotencyKey);
    const body: Record<string, unknown> = {
      id: eventId,
      summary: ev.title,
      description: ev.description ?? undefined,
      location: ev.location ?? undefined,
      start: { dateTime: ev.start.toISOString(), timeZone: ev.timezone },
      end: { dateTime: ev.end.toISOString(), timeZone: ev.timezone },
      attendees: ev.attendees.map((a) => ({ email: a.email, displayName: a.name ?? undefined })),
    };
    if (ev.addOnlineMeeting) body.conferenceData = { createRequest: { requestId: randomToken(12), conferenceSolutionKey: { type: "hangoutsMeet" } } };
    try {
      const created = await fetchJson<GoogleEvent>(`${CAL}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      return toEvent(created, "primary");
    } catch (e) {
      // 409 : l'événement avec cet identifiant existe déjà => création antérieure réussie, pas de doublon.
      if (e instanceof ProviderError && e.kind === "conflict") {
        const existing = await fetchJson<GoogleEvent>(`${CAL}/calendars/primary/events/${eventId}`, { token });
        return toEvent(existing, "primary");
      }
      throw e;
    }
  },

  async updateEvent(_conn, token, providerEventId, patch) {
    const body: Record<string, unknown> = {};
    if (patch.title) body.summary = patch.title;
    if (patch.start) body.start = { dateTime: patch.start.toISOString(), timeZone: patch.timezone };
    if (patch.end) body.end = { dateTime: patch.end.toISOString(), timeZone: patch.timezone };
    if (patch.location !== undefined) body.location = patch.location;
    if (patch.attendees) body.attendees = patch.attendees.map((a) => ({ email: a.email, displayName: a.name ?? undefined }));
    const r = await fetchJson<GoogleEvent>(`${CAL}/calendars/primary/events/${providerEventId}?sendUpdates=all`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
    return toEvent(r, "primary");
  },

  async cancelEvent(_conn, token, providerEventId, notify) {
    await fetchJson(`${CAL}/calendars/primary/events/${providerEventId}?sendUpdates=${notify ? "all" : "none"}`, { method: "DELETE", token });
  },

  async subscribe(conn, token) {
    const state: Record<string, unknown> = {};
    const topic = config().GOOGLE_PUBSUB_TOPIC;
    if (topic && conn.capabilities.includes("mail.read")) {
      const w = await fetchJson<{ historyId: string; expiration: string }>(`${GMAIL}/watch`, {
        method: "POST",
        token,
        body: JSON.stringify({ topicName: topic, labelIds: ["INBOX"], labelFilterBehavior: "INCLUDE" }),
      });
      state.gmailWatchExpiration = Number(w.expiration);
    }
    if (conn.capabilities.includes("calendar.read") && apiPublicUrl().startsWith("https://")) {
      const channelId = crypto.randomUUID();
      const channelToken = randomToken(24);
      const r = await fetchJson<{ resourceId: string; expiration: string }>(`${CAL}/calendars/primary/events/watch`, {
        method: "POST",
        token,
        body: JSON.stringify({ id: channelId, type: "web_hook", address: `${apiPublicUrl()}/api/webhooks/google/calendar`, token: channelToken }),
      });
      state.calendarChannel = { id: channelId, resourceId: r.resourceId, token: channelToken, expiration: Number(r.expiration) };
    }
    return state;
  },

  async unsubscribe(conn, token) {
    const ch = conn.webhookState.calendarChannel as { id: string; resourceId: string } | undefined;
    if (ch) await fetchJson(`${CAL}/channels/stop`, { method: "POST", token, body: JSON.stringify({ id: ch.id, resourceId: ch.resourceId }) }).catch(() => undefined);
    if (conn.webhookState.gmailWatchExpiration) await fetchJson(`${GMAIL}/stop`, { method: "POST", token }).catch(() => undefined);
  },
};

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
