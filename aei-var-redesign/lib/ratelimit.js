// Limitation du nombre d'essais (anti-spam, anti force brute).
// Les compteurs sont stockés par fenêtre de temps ; l'identifiant est haché (pas d'IP en clair).
import { createHash } from 'node:crypto';
import { readJSON, writeJSON } from './storage.js';
import { HttpError } from './http.js';

const hash = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 32);

export async function rateLimit(bucket, id, max, windowSec) {
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const key = `ratelimit/${bucket}/${win}-${hash(id)}.json`;
  const cur = await readJSON(key, { n: 0 });
  if (cur.n >= max) throw new HttpError(429, 'Trop de tentatives. Merci de réessayer un peu plus tard.');
  await writeJSON(key, { n: cur.n + 1 }); // pas besoin d'exactitude parfaite ici
}

// Verrouillage d'un compte après plusieurs mots de passe erronés
const LOCK_MAX = 5;
const LOCK_MIN = 15;

export async function assertNotLocked(email) {
  const s = await readJSON(`auth/attempts/${hash(email.toLowerCase())}.json`, null);
  if (s?.until && s.until > Date.now()) {
    const min = Math.ceil((s.until - Date.now()) / 60000);
    throw new HttpError(429, `Compte temporairement verrouillé après plusieurs essais. Réessayez dans ${min} min.`);
  }
}

export async function recordFailure(email) {
  const key = `auth/attempts/${hash(email.toLowerCase())}.json`;
  const s = await readJSON(key, { n: 0 });
  const n = (s.until && s.until < Date.now()) ? 1 : s.n + 1;
  await writeJSON(key, { n, until: n >= LOCK_MAX ? Date.now() + LOCK_MIN * 60000 : 0 });
}

export async function clearFailures(email) {
  await writeJSON(`auth/attempts/${hash(email.toLowerCase())}.json`, { n: 0 });
}
