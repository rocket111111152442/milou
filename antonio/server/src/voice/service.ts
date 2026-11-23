import { and, eq } from "drizzle-orm";
import { config } from "../config.js";
import { db, schema } from "../db/client.js";
import { AppError, notFound } from "../lib/audit.js";
import { sha256 } from "../lib/crypto.js";
import { getProfile } from "../lib/profile.js";
import type { Actor } from "../connectors/service.js";
import { budgetStatus, recordUsage, voiceCostMicros } from "../usage/service.js";
import { getOrCreateConversation, recentTurns, runTurn } from "../agent/orchestrator.js";

/**
 * Voix : GPT-Live (gpt-live-1.1) gère la conversation orale (écoute pendant qu'il
 * parle, interruptions, transcription). Il DÉLÈGUE tout travail métier à notre
 * serveur (délégation « client ») : le même orchestrateur texte (gpt-6-luna),
 * les mêmes outils et la même politique d'autorisation que l'écrit.
 * La clé API reste sur le serveur : le navigateur n'envoie que son offre SDP.
 */

function liveInstructions(assistantName: string, firstName: string | null, tutoiement: boolean) {
  return `Tu es ${assistantName}, assistant de travail de ${firstName ?? "l'utilisateur"}. Parle français, ${tutoiement ? "tutoie" : "vouvoie"} l'utilisateur, phrases courtes et naturelles.
Tu n'as accès à aucune donnée et ne peux rien faire toi-même : pour toute demande sur les messages, l'agenda, les tâches, les règles, les validations ou le point du jour, délègue au backend, y compris quand l'utilisateur répond « oui », « non » ou corrige une demande précédente.
Pendant que le backend travaille, tu peux dire brièvement que tu regardes, mais n'annonce jamais un résultat avant son retour, et répète fidèlement ce qu'il confirme : préparé, en attente de validation, fait, échoué ou incertain.
Si l'utilisateur t'interrompt, arrête-toi et écoute. Une interruption n'annule pas une action déjà lancée : demande au backend si besoin.`;
}

export async function createVoiceSession(actor: Actor, sdp: string) {
  const c = config();
  if (!c.OPENAI_API_KEY) throw new AppError(503, "voice_unavailable", "La voix nécessite OPENAI_API_KEY côté serveur. Le mode écrit reste disponible.");
  if (!sdp || sdp.length > 64 * 1024) throw new AppError(400, "invalid_sdp", "Offre SDP invalide");
  const status = await budgetStatus(actor.orgId, actor.userId);
  if (status.exceeded) throw new AppError(402, "budget_exceeded", "Budget mensuel atteint : la voix est suspendue. Le mode écrit sans IA reste disponible.");
  if (status.voiceExceeded) {
    throw new AppError(429, "voice_daily_limit", `Limite quotidienne de ${status.budget.voiceMinutesDaily} minutes de voix atteinte. Le mode écrit reste disponible.`);
  }
  const profile = await getProfile(actor.userId);
  const conv = await getOrCreateConversation(actor, null, "voice");
  // Reprise du contexte après interruption : derniers échanges réinjectés en texte.
  const turns = (await recentTurns(conv.id, 8)).slice(-8);
  const input = turns.map((t) => ({
    type: "message",
    role: t.role === "user" ? "user" : "assistant",
    content: [{ type: t.role === "user" ? "input_text" : "output_text", text: t.content.slice(0, 600) }],
  }));
  const [vs] = await db().insert(schema.voiceSessions).values({ orgId: actor.orgId, userId: actor.userId, conversationId: conv.id }).returning();
  const res = await fetch(`${c.OPENAI_BASE_URL}/live/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": sha256(`antonio:${actor.userId}`).slice(0, 64),
    },
    body: JSON.stringify({
      session: {
        model: c.OPENAI_LIVE_MODEL,
        instructions: liveInstructions(profile.assistantName, profile.firstName, profile.tutoiement),
        input,
        audio: { output: { voice: profile.assistantVoice } },
        delegation: { type: "client" },
        // Veille côté OpenAI : l'inférence ne démarre qu'à la parole et se met en pause après 20 s de silence (tarif réduit).
        wake_policy: { type: "speech" },
        idle_timeout_s: 20,
        // Pas d'enregistrement durable (store: false par défaut, explicite ici).
        store: false,
      },
      transport: { type: "webrtc", sdp },
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch((e) => {
    throw new AppError(502, "voice_unreachable", `Service vocal injoignable (${(e as Error).name})`);
  });
  const json = (await res.json().catch(() => ({}))) as { session?: { id: string }; transport?: { sdp: string }; error?: { message?: string } };
  if (!res.ok || !json.transport?.sdp) {
    await db().update(schema.voiceSessions).set({ status: "failed", closeReason: json.error?.message ?? `HTTP ${res.status}`, endedAt: new Date() }).where(eq(schema.voiceSessions.id, vs.id));
    throw new AppError(502, "voice_failed", `Création de la session vocale refusée : ${json.error?.message ?? res.status}`);
  }
  await db().update(schema.voiceSessions).set({ status: "active", providerSessionId: json.session?.id ?? null }).where(eq(schema.voiceSessions.id, vs.id));
  return {
    voiceSessionId: vs.id,
    conversationId: conv.id,
    answerSdp: json.transport.sdp,
    limits: { sessionMaxMinutes: status.budget.voiceSessionMaxMinutes, remainingTodaySeconds: status.budget.voiceMinutesDaily * 60 - status.voiceSecondsToday },
  };
}

async function ownedVoiceSession(actor: Actor, id: string) {
  const [vs] = await db()
    .select()
    .from(schema.voiceSessions)
    .where(and(eq(schema.voiceSessions.id, id), eq(schema.voiceSessions.userId, actor.userId)));
  if (!vs) throw notFound("Session vocale");
  return vs;
}

/** Une délégation de GPT-Live : on exécute le tour côté serveur et on renvoie un texte à dire. */
export async function handleDelegation(actor: Actor, voiceSessionId: string, utterance: string) {
  const vs = await ownedVoiceSession(actor, voiceSessionId);
  if (vs.status !== "active") throw new AppError(409, "voice_closed", "Session vocale fermée");
  const reply = await runTurn(actor, { text: utterance || "(inaudible)", conversationId: vs.conversationId, channel: "voice" });
  return { ...reply, speak: reply.text.slice(0, 1500) };
}

/** Rapport d'usage (secondes cumulées envoyées par session.usage.updated). Décide si la session peut continuer. */
export async function reportUsage(actor: Actor, voiceSessionId: string, seconds: number, final = false, reason?: string) {
  const vs = await ownedVoiceSession(actor, voiceSessionId);
  const total = Math.max(vs.reportedSeconds, Math.floor(seconds));
  const delta = total - vs.reportedSeconds;
  if (delta > 0) {
    await recordUsage({
      orgId: actor.orgId,
      userId: actor.userId,
      kind: "voice",
      model: config().OPENAI_LIVE_MODEL,
      quantity: delta,
      unit: "seconds",
      costMicros: voiceCostMicros(delta),
      meta: { voiceSessionId },
    });
  }
  await db()
    .update(schema.voiceSessions)
    .set({ reportedSeconds: total, ...(final ? { status: "closed", endedAt: new Date(), closeReason: reason ?? "close_requested" } : {}) })
    .where(eq(schema.voiceSessions.id, vs.id));
  const status = await budgetStatus(actor.orgId, actor.userId);
  const sessionMax = status.budget.voiceSessionMaxMinutes * 60;
  if (status.exceeded) return { continue: false, reason: "Budget mensuel atteint." };
  if (status.voiceExceeded) return { continue: false, reason: "Limite quotidienne de voix atteinte." };
  if (total >= sessionMax) return { continue: false, reason: `Durée maximale d'une session vocale atteinte (${status.budget.voiceSessionMaxMinutes} min).` };
  return { continue: true, reason: null };
}

/**
 * Dictée ponctuelle (onboarding, champs de saisie) : l'audio enregistré après un
 * appui explicite est transcrit par gpt-transcribe puis oublié (rien n'est stocké).
 */
export async function transcribe(actor: Actor, audio: Buffer, mimeType: string, durationSeconds: number) {
  const c = config();
  if (!c.OPENAI_API_KEY) throw new AppError(503, "voice_unavailable", "La dictée nécessite OPENAI_API_KEY côté serveur.");
  if (audio.length > 8 * 1024 * 1024) throw new AppError(413, "too_large", "Enregistrement trop long");
  const status = await budgetStatus(actor.orgId, actor.userId);
  if (status.exceeded) throw new AppError(402, "budget_exceeded", "Budget atteint : la dictée est suspendue.");
  const form = new FormData();
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm";
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `dictee.${ext}`);
  form.append("model", "gpt-transcribe");
  form.append("language", "fr");
  const res = await fetch(`${c.OPENAI_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.OPENAI_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await res.json().catch(() => ({}))) as { text?: string; error?: { message?: string } };
  if (!res.ok) throw new AppError(502, "transcription_failed", json.error?.message ?? `HTTP ${res.status}`);
  await recordUsage({
    orgId: actor.orgId,
    userId: actor.userId,
    kind: "voice",
    model: "gpt-transcribe",
    quantity: Math.ceil(durationSeconds),
    unit: "seconds",
    costMicros: Math.round((durationSeconds / 60) * 0.0045 * 1_000_000),
    meta: { purpose: "dictation" },
  });
  return { text: json.text ?? "" };
}
