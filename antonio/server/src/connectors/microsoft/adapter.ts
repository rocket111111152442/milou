import type { Capability, ConnectorDescriptor, Reversibility } from "@antonio/shared";
import { apiPublicUrl, config } from "../../config.js";
import { randomToken } from "../../lib/crypto.js";
import { htmlToText } from "../google/adapter.js";
import {
  type Address,
  type ConnectionRow,
  type EventMeta,
  type MessageMeta,
  type NewEvent,
  type OAuthTokens,
  type OutgoingMail,
  type ProviderAdapter,
  type SyncResult,
  ProviderError,
  fetchJson,
} from "../types.js";

/**
 * Connecteur Microsoft : Microsoft Graph v1.0 (Outlook Mail + Calendar).
 * Références :
 *  - https://learn.microsoft.com/graph/delta-query-messages (deltaLink par dossier)
 *  - https://learn.microsoft.com/graph/change-notifications-delivery-webhooks (validationToken, clientState)
 *  - https://learn.microsoft.com/graph/api/user-post-events (transactionId pour l'idempotence)
 *  - https://learn.microsoft.com/graph/outlook-immutable-id (identifiants stables lors des déplacements)
 */

const GRAPH = "https://graph.microsoft.com/v1.0";
const authority = () => `https://login.microsoftonline.com/${config().MICROSOFT_TENANT}/oauth2/v2.0`;
const redirectUri = () => `${apiPublicUrl()}/api/oauth/microsoft/callback`;

const CAPABILITY_SCOPES: Record<Capability, string[]> = {
  "mail.read": ["Mail.Read"],
  "mail.draft": ["Mail.ReadWrite"],
  "mail.send": ["Mail.Send"],
  "mail.modify": ["Mail.ReadWrite"],
  // Graph permet la suppression définitive avec Mail.ReadWrite : Waverti la traite comme une action à part, jamais automatique.
  "mail.delete_permanent": ["Mail.ReadWrite"],
  "calendar.read": ["Calendars.Read"],
  "calendar.write": ["Calendars.ReadWrite"],
};

/** En-têtes communs : identifiants immuables et heures en UTC. */
const H = { Prefer: 'IdType="ImmutableId", outlook.timezone="UTC"' };

interface GraphRecipient {
  emailAddress: { address?: string; name?: string };
}
interface GraphMessage {
  id: string;
  conversationId?: string;
  internetMessageId?: string;
  subject?: string;
  bodyPreview?: string;
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  receivedDateTime?: string;
  isRead?: boolean;
  isDraft?: boolean;
  hasAttachments?: boolean;
  parentFolderId?: string;
  categories?: string[];
  "@removed"?: unknown;
}

const addr = (r?: GraphRecipient): Address => ({ email: (r?.emailAddress.address ?? "inconnu@invalid").toLowerCase(), name: r?.emailAddress.name ?? null });
const recipients = (list: Address[]) => list.map((a) => ({ emailAddress: { address: a.email, name: a.name ?? undefined } }));

const SELECT = "id,conversationId,internetMessageId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,isRead,isDraft,hasAttachments,parentFolderId,categories";

function toMeta(m: GraphMessage, folder: string, folderIds: Record<string, string>): MessageMeta {
  return {
    providerMessageId: m.id,
    providerThreadId: m.conversationId ?? m.id,
    internetMessageId: m.internetMessageId ?? null,
    from: addr(m.from),
    to: (m.toRecipients ?? []).map(addr),
    cc: (m.ccRecipients ?? []).map(addr),
    subject: m.subject ?? "",
    snippet: m.bodyPreview ?? "",
    receivedAt: new Date(m.receivedDateTime ?? Date.now()),
    unread: m.isRead === false,
    inTrash: m.parentFolderId === folderIds.deleteditems,
    archived: m.parentFolderId === folderIds.archive,
    isSent: folder === "sentitems",
    labels: m.categories ?? [],
    folderId: m.parentFolderId ?? null,
    hasAttachments: Boolean(m.hasAttachments),
  };
}

interface GraphEvent {
  id: string;
  subject?: string;
  start?: { dateTime: string; timeZone: string };
  end?: { dateTime: string; timeZone: string };
  isAllDay?: boolean;
  isCancelled?: boolean;
  location?: { displayName?: string };
  onlineMeeting?: { joinUrl?: string } | null;
  attendees?: { emailAddress: { address: string; name?: string }; status?: { response?: string } }[];
  organizer?: GraphRecipient;
  type?: string;
  seriesMasterId?: string;
  showAs?: string;
  "@removed"?: unknown;
}

const RESPONSE_MAP: Record<string, string> = {
  none: "needsAction",
  notResponded: "needsAction",
  accepted: "accepted",
  declined: "declined",
  tentativelyAccepted: "tentative",
  organizer: "accepted",
};

const utc = (s?: string) => new Date(s ? (s.endsWith("Z") ? s : `${s}Z`) : 0);

function toEvent(e: GraphEvent): EventMeta {
  return {
    providerEventId: e.id,
    calendarId: "primary",
    title: e.subject ?? "(sans titre)",
    start: utc(e.start?.dateTime),
    end: utc(e.end?.dateTime),
    allDay: Boolean(e.isAllDay),
    timezone: e.start?.timeZone ?? null,
    location: e.location?.displayName || null,
    onlineMeetingUrl: e.onlineMeeting?.joinUrl ?? null,
    attendees: (e.attendees ?? []).map((a) => ({
      email: a.emailAddress.address.toLowerCase(),
      name: a.emailAddress.name ?? null,
      response: RESPONSE_MAP[a.status?.response ?? "none"] ?? "unknown",
    })),
    organizerEmail: e.organizer?.emailAddress.address?.toLowerCase() ?? null,
    status: e.isCancelled ? "cancelled" : "confirmed",
    recurring: Boolean(e.seriesMasterId) || e.type === "occurrence",
    showAs: e.showAs === "free" ? "free" : "busy",
  };
}

const graphDate = (d: Date) => d.toISOString().replace("Z", "");

async function folderIds(token: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const f of ["deleteditems", "archive", "inbox", "sentitems"]) {
    try {
      const r = await fetchJson<{ id: string }>(`${GRAPH}/me/mailFolders/${f}?$select=id`, { token, headers: H });
      out[f] = r.id;
    } catch {
      /* dossier indisponible (ex. archive non créée) */
    }
  }
  return out;
}

export const microsoftAdapter: ProviderAdapter = {
  id: "microsoft",
  label: "Microsoft (Outlook et Calendrier)",

  descriptor(): ConnectorDescriptor {
    const configured = Boolean(config().MICROSOFT_CLIENT_ID && config().MICROSOFT_CLIENT_SECRET);
    return {
      id: "microsoft",
      label: "Outlook et Calendrier Microsoft",
      status: configured ? "available" : "needs_configuration",
      reads: ["Boîte de réception et éléments envoyés (métadonnées synchronisées, contenu à la demande)", "Calendrier principal", "Disponibilités"],
      writes: [
        "Brouillons et envois",
        "Catégories, archivage, éléments supprimés et restauration",
        "Création, modification et annulation d'événements avec invitations",
        "Réunion Teams lorsque le compte professionnel le permet",
      ],
      unsupported: [
        "Annulation d'un message déjà envoyé",
        "Révocation du consentement depuis l'application : à faire dans le portail du compte Microsoft",
        "Teams indisponible sur la plupart des comptes personnels",
      ],
      notes: ["Notifications Graph si l'URL publique est en HTTPS ; abonnements renouvelés avant leur expiration (≈ 3 jours ici)."],
    };
  },

  scopesFor(capabilities) {
    const scopes = new Set<string>(["openid", "email", "offline_access", "User.Read"]);
    for (const c of capabilities) for (const s of CAPABILITY_SCOPES[c] ?? []) scopes.add(s);
    return [...scopes];
  },

  capabilitiesFromScopes(scopes) {
    const has = (s: string) => scopes.some((x) => x.toLowerCase() === s.toLowerCase() || x.toLowerCase().endsWith(`/${s.toLowerCase()}`));
    const caps: Capability[] = [];
    if (has("Mail.Read") || has("Mail.ReadWrite")) caps.push("mail.read");
    if (has("Mail.ReadWrite")) caps.push("mail.draft", "mail.modify");
    if (has("Mail.Send")) caps.push("mail.send");
    if (has("Calendars.Read") || has("Calendars.ReadWrite")) caps.push("calendar.read");
    if (has("Calendars.ReadWrite")) caps.push("calendar.write");
    return caps;
  },

  reversibility(kind): Reversibility {
    if (kind === "email.trash" || kind === "email.archive" || kind === "email.label" || kind === "email.untrash") return "reversible";
    if (kind === "calendar.create" || kind === "calendar.update") return "partial";
    return "irreversible";
  },

  buildAuthUrl({ state, codeChallenge, scopes, loginHint }) {
    const q = new URLSearchParams({
      client_id: config().MICROSOFT_CLIENT_ID ?? "",
      response_type: "code",
      redirect_uri: redirectUri(),
      response_mode: "query",
      scope: scopes.join(" "),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    if (loginHint) q.set("login_hint", loginHint);
    return `${authority()}/authorize?${q}`;
  },

  async exchangeCode(code, codeVerifier): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      client_id: config().MICROSOFT_CLIENT_ID ?? "",
      client_secret: config().MICROSOFT_CLIENT_SECRET ?? "",
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    });
    const t = await fetchJson<{ access_token: string; refresh_token?: string; expires_in: number; scope: string }>(`${authority()}/token`, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const me = await fetchJson<{ id: string; mail?: string; userPrincipalName: string }>(`${GRAPH}/me?$select=id,mail,userPrincipalName`, {
      token: t.access_token,
    });
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token ?? null,
      expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000),
      scopes: t.scope.split(" "),
      accountEmail: (me.mail ?? me.userPrincipalName).toLowerCase(),
      providerAccountId: me.id,
    };
  },

  async refreshAccessToken(refreshToken) {
    const body = new URLSearchParams({
      client_id: config().MICROSOFT_CLIENT_ID ?? "",
      client_secret: config().MICROSOFT_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const t = await fetchJson<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }>(`${authority()}/token`, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token ?? null, // Microsoft fait tourner le jeton de rafraîchissement
      expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000),
      scopes: t.scope?.split(" "),
    };
  },

  // Microsoft n'expose pas de révocation par jeton : on supprime nos jetons et abonnements.
  async revoke() {},

  // ------------------------------------------------------------------ Mail
  async syncMail(_conn, token, cursor): Promise<SyncResult<MessageMeta>> {
    const ids = (cursor.folderIds as Record<string, string>) ?? (await folderIds(token));
    const deltas = { ...((cursor.mailDelta as Record<string, string>) ?? {}) };
    const upserts: MessageMeta[] = [];
    const deletedIds: string[] = [];
    let full = false;
    for (const folder of ["inbox", "sentitems", "deleteditems"]) {
      let url: string | undefined = deltas[folder];
      if (!url) {
        full = true;
        const since = new Date(Date.now() - 14 * 86400_000).toISOString();
        url = `${GRAPH}/me/mailFolders/${folder}/messages/delta?$select=${SELECT}&$filter=receivedDateTime+ge+${since}`;
      }
      let guard = 0;
      while (url && guard++ < 20) {
        let page: { value: GraphMessage[]; "@odata.nextLink"?: string; "@odata.deltaLink"?: string };
        try {
          page = await fetchJson(url, { token, headers: { ...H, Prefer: `${H.Prefer}, odata.maxpagesize=50` } });
        } catch (e) {
          // deltaLink expiré (410) : on repart d'une synchronisation complète de ce dossier.
          if (e instanceof ProviderError && e.kind === "not_found" && deltas[folder]) {
            delete deltas[folder];
            url = undefined;
            break;
          }
          throw e;
        }
        for (const m of page.value) {
          if (m["@removed"]) {
            if (folder !== "deleteditems") deletedIds.push(m.id);
          } else if (!m.isDraft) upserts.push(toMeta(m, folder, ids));
        }
        url = page["@odata.nextLink"];
        if (page["@odata.deltaLink"]) deltas[folder] = page["@odata.deltaLink"];
      }
    }
    // Un message déplacé est « retiré » d'un dossier puis « ajouté » à un autre : ne pas le supprimer.
    const kept = new Set(upserts.map((u) => u.providerMessageId));
    return { upserts, deletedIds: deletedIds.filter((d) => !kept.has(d)), cursor: { mailDelta: deltas, folderIds: ids }, full };
  },

  async getMessageBody(_conn, token, id) {
    const m = await fetchJson<{ body?: { contentType: string; content: string } }>(`${GRAPH}/me/messages/${id}?$select=body`, {
      token,
      headers: { Prefer: `${H.Prefer}, outlook.body-content-type="text"` },
    });
    const att = await fetchJson<{ value: { name: string; size: number; contentType: string }[] }>(
      `${GRAPH}/me/messages/${id}/attachments?$select=name,size,contentType`,
      { token, headers: H },
    ).catch(() => ({ value: [] }));
    const raw = m.body?.content ?? "";
    return {
      text: m.body?.contentType === "html" ? htmlToText(raw) : raw,
      attachments: att.value.map((a) => ({ name: a.name, size: a.size, mimeType: a.contentType })),
    };
  },

  async searchMail(_conn, token, query) {
    const r = await fetchJson<{ value: { id: string }[] }>(`${GRAPH}/me/messages?$search=${encodeURIComponent(`"${query.replace(/"/g, "")}"`)}&$select=id&$top=25`, {
      token,
      headers: H,
    });
    return r.value.map((m) => m.id);
  },

  async createDraft(_conn, token, mail) {
    const draft = await createGraphDraft(token, mail);
    return { draftId: draft.id };
  },

  async sendMail(_conn, token, mail) {
    // Brouillon (avec notre Message-ID) puis envoi : permet de vérifier un envoi incertain.
    const draft = await createGraphDraft(token, mail);
    await fetchJson(`${GRAPH}/me/messages/${draft.id}/send`, { method: "POST", token, headers: H, timeoutMs: 30000 });
    return { providerMessageId: null, providerThreadId: draft.conversationId ?? null };
  },

  async findSent(_conn, token, internetMessageId) {
    const filter = encodeURIComponent(`internetMessageId eq '${internetMessageId.replace(/'/g, "''")}'`);
    const r = await fetchJson<{ value: { id: string }[] }>(`${GRAPH}/me/mailFolders/sentitems/messages?$filter=${filter}&$select=id&$top=1`, {
      token,
      headers: H,
    });
    return r.value[0] ? { providerMessageId: r.value[0].id } : null;
  },

  async trash(_conn, token, id) {
    const before = await fetchJson<{ parentFolderId: string }>(`${GRAPH}/me/messages/${id}?$select=parentFolderId`, { token, headers: H });
    await fetchJson(`${GRAPH}/me/messages/${id}/move`, { method: "POST", token, headers: H, body: JSON.stringify({ destinationId: "deleteditems" }) });
    return { revertInfo: { originalFolderId: before.parentFolderId } };
  },

  async untrash(_conn, token, id, revertInfo) {
    const dest = (revertInfo?.originalFolderId as string) ?? "inbox";
    await fetchJson(`${GRAPH}/me/messages/${id}/move`, { method: "POST", token, headers: H, body: JSON.stringify({ destinationId: dest }) });
  },

  async archive(_conn, token, id) {
    const before = await fetchJson<{ parentFolderId: string }>(`${GRAPH}/me/messages/${id}?$select=parentFolderId`, { token, headers: H });
    await fetchJson(`${GRAPH}/me/messages/${id}/move`, { method: "POST", token, headers: H, body: JSON.stringify({ destinationId: "archive" }) });
    return { revertInfo: { originalFolderId: before.parentFolderId } };
  },

  async applyLabel(_conn, token, id, label) {
    const m = await fetchJson<{ categories?: string[] }>(`${GRAPH}/me/messages/${id}?$select=categories`, { token, headers: H });
    const categories = [...new Set([...(m.categories ?? []), label])];
    await fetchJson(`${GRAPH}/me/messages/${id}`, { method: "PATCH", token, headers: H, body: JSON.stringify({ categories }) });
  },

  // -------------------------------------------------------------- Calendar
  async syncEvents(_conn, token, cursor, window): Promise<SyncResult<EventMeta>> {
    let url = cursor.calendarDelta as string | undefined;
    const full = !url;
    if (!url) url = `${GRAPH}/me/calendarView/delta?startDateTime=${window.from.toISOString()}&endDateTime=${window.to.toISOString()}`;
    const upserts: EventMeta[] = [];
    const deletedIds: string[] = [];
    let deltaLink: string | undefined;
    let guard = 0;
    while (url && guard++ < 30) {
      let page: { value: GraphEvent[]; "@odata.nextLink"?: string; "@odata.deltaLink"?: string };
      try {
        page = await fetchJson(url, { token, headers: { ...H, Prefer: `${H.Prefer}, odata.maxpagesize=100` } });
      } catch (e) {
        if (e instanceof ProviderError && e.kind === "not_found" && !full) return this.syncEvents(_conn, token, {}, window);
        throw e;
      }
      for (const ev of page.value) {
        if (ev["@removed"] || ev.isCancelled) deletedIds.push(ev.id);
        else if (ev.start) upserts.push(toEvent(ev));
      }
      url = page["@odata.nextLink"];
      deltaLink = page["@odata.deltaLink"] ?? deltaLink;
    }
    return { upserts, deletedIds, cursor: { calendarDelta: deltaLink }, full };
  },

  async freeBusy(_conn, token, from, to) {
    const r = await fetchJson<{ value: GraphEvent[] }>(
      `${GRAPH}/me/calendarView?startDateTime=${from.toISOString()}&endDateTime=${to.toISOString()}&$select=start,end,showAs,isCancelled&$top=200`,
      { token, headers: H },
    );
    return r.value
      .filter((e) => !e.isCancelled && e.showAs !== "free")
      .map((e) => ({ start: utc(e.start?.dateTime), end: utc(e.end?.dateTime) }));
  },

  async createEvent(_conn, token, ev, idempotencyKey) {
    const body: Record<string, unknown> = {
      subject: ev.title,
      body: ev.description ? { contentType: "text", content: ev.description } : undefined,
      start: { dateTime: graphDate(ev.start), timeZone: "UTC" },
      end: { dateTime: graphDate(ev.end), timeZone: "UTC" },
      attendees: ev.attendees.map((a) => ({ emailAddress: { address: a.email, name: a.name ?? undefined }, type: "required" })),
      location: ev.location ? { displayName: ev.location } : undefined,
      // transactionId : Graph ignore une seconde création portant le même identifiant.
      transactionId: idempotencyKey.slice(0, 200),
    };
    if (ev.addOnlineMeeting) {
      body.isOnlineMeeting = true;
      body.onlineMeetingProvider = "teamsForBusiness";
    }
    const r = await fetchJson<GraphEvent>(`${GRAPH}/me/events`, { method: "POST", token, headers: H, body: JSON.stringify(body) });
    return toEvent(r);
  },

  async updateEvent(_conn, token, providerEventId, patch) {
    const body: Record<string, unknown> = {};
    if (patch.title) body.subject = patch.title;
    if (patch.start) body.start = { dateTime: graphDate(patch.start), timeZone: "UTC" };
    if (patch.end) body.end = { dateTime: graphDate(patch.end), timeZone: "UTC" };
    if (patch.location !== undefined) body.location = { displayName: patch.location ?? "" };
    if (patch.attendees) body.attendees = patch.attendees.map((a) => ({ emailAddress: { address: a.email, name: a.name ?? undefined }, type: "required" }));
    const r = await fetchJson<GraphEvent>(`${GRAPH}/me/events/${providerEventId}`, { method: "PATCH", token, headers: H, body: JSON.stringify(body) });
    return toEvent(r);
  },

  async cancelEvent(_conn, token, providerEventId, notify) {
    if (notify) {
      try {
        await fetchJson(`${GRAPH}/me/events/${providerEventId}/cancel`, { method: "POST", token, headers: H, body: JSON.stringify({ comment: "" }) });
        return;
      } catch (e) {
        // /cancel est réservé à l'organisateur : à défaut, suppression simple.
        if (!(e instanceof ProviderError && (e.kind === "invalid" || e.status === 403))) throw e;
      }
    }
    await fetchJson(`${GRAPH}/me/events/${providerEventId}`, { method: "DELETE", token, headers: H });
  },

  async subscribe(conn, token) {
    if (!apiPublicUrl().startsWith("https://")) return {};
    const clientState = randomToken(24);
    const expiration = new Date(Date.now() + 3 * 86400_000).toISOString();
    const subs: Record<string, string> = {};
    const targets: [string, string][] = [];
    if (conn.capabilities.includes("mail.read")) targets.push(["mail", "me/mailFolders('inbox')/messages"]);
    if (conn.capabilities.includes("calendar.read")) targets.push(["calendar", "me/events"]);
    for (const [key, resource] of targets) {
      const r = await fetchJson<{ id: string }>(`${GRAPH}/subscriptions`, {
        method: "POST",
        token,
        body: JSON.stringify({
          changeType: "created,updated,deleted",
          notificationUrl: `${apiPublicUrl()}/api/webhooks/microsoft`,
          lifecycleNotificationUrl: `${apiPublicUrl()}/api/webhooks/microsoft/lifecycle`,
          resource,
          expirationDateTime: expiration,
          clientState,
        }),
      });
      subs[key] = r.id;
    }
    return { graphSubscriptions: subs, graphClientState: clientState, graphExpiration: Date.parse(expiration) };
  },

  async unsubscribe(conn, token) {
    const subs = (conn.webhookState.graphSubscriptions as Record<string, string>) ?? {};
    for (const id of Object.values(subs)) await fetchJson(`${GRAPH}/subscriptions/${id}`, { method: "DELETE", token }).catch(() => undefined);
  },
};

async function createGraphDraft(token: string, mail: OutgoingMail): Promise<{ id: string; conversationId?: string }> {
  if (mail.inReplyTo) {
    const draft = await fetchJson<{ id: string; conversationId?: string }>(`${GRAPH}/me/messages/${mail.inReplyTo.providerMessageId}/createReply`, {
      method: "POST",
      token,
      headers: H,
      body: JSON.stringify({}),
    });
    await fetchJson(`${GRAPH}/me/messages/${draft.id}`, {
      method: "PATCH",
      token,
      headers: H,
      body: JSON.stringify({
        body: { contentType: "Text", content: mail.body },
        toRecipients: recipients(mail.to),
        ccRecipients: recipients(mail.cc),
        internetMessageId: mail.internetMessageId,
      }),
    });
    return draft;
  }
  return fetchJson<{ id: string; conversationId?: string }>(`${GRAPH}/me/messages`, {
    method: "POST",
    token,
    headers: H,
    body: JSON.stringify({
      subject: mail.subject,
      body: { contentType: "Text", content: mail.body },
      toRecipients: recipients(mail.to),
      ccRecipients: recipients(mail.cc),
      internetMessageId: mail.internetMessageId,
    }),
  });
}

export type { NewEvent, ConnectionRow };
