import pg from "pg";
import type { ServerEvent } from "@antonio/shared";
import { config } from "../config.js";
import { getPool } from "../db/client.js";

/**
 * Diffusion d'événements temps réel. Le worker et le serveur web peuvent être
 * des processus distincts : on passe donc par LISTEN/NOTIFY de PostgreSQL.
 * Les événements sont petits (identifiants) ; l'interface relit l'état serveur.
 */
type Listener = (event: ServerEvent) => void;
const listeners = new Map<string, Set<Listener>>();
let listenClient: pg.Client | null = null;
const CHANNEL = "antonio_events";

export async function publish(userId: string, event: ServerEvent) {
  const payload = JSON.stringify({ userId, event });
  if (payload.length > 7900) return; // limite NOTIFY : on n'envoie jamais de contenu volumineux
  try {
    await getPool().query("SELECT pg_notify($1, $2)", [CHANNEL, payload]);
  } catch {
    // Diffusion locale si la base est indisponible (best effort).
    deliver(userId, event);
  }
}

function deliver(userId: string, event: ServerEvent) {
  const set = listeners.get(userId);
  if (!set) return;
  for (const l of set) {
    try {
      l(event);
    } catch {
      /* ignorer un abonné défaillant */
    }
  }
}

export async function startHub() {
  if (listenClient) return;
  const client = new pg.Client({ connectionString: config().DATABASE_URL });
  await client.connect();
  await client.query(`LISTEN ${CHANNEL}`);
  client.on("notification", (msg) => {
    if (!msg.payload) return;
    try {
      const { userId, event } = JSON.parse(msg.payload) as { userId: string; event: ServerEvent };
      deliver(userId, event);
    } catch {
      /* charge utile invalide ignorée */
    }
  });
  client.on("error", () => {
    listenClient = null;
    setTimeout(() => void startHub().catch(() => undefined), 2000);
  });
  listenClient = client;
}

export async function stopHub() {
  if (listenClient) await listenClient.end().catch(() => undefined);
  listenClient = null;
}

export function subscribe(userId: string, listener: Listener): () => void {
  let set = listeners.get(userId);
  if (!set) {
    set = new Set();
    listeners.set(userId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(userId);
  };
}
