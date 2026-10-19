// API de synchronisation des annonces, pour un futur logiciel de transaction.
// STATUT : « À CONNECTER ». Aucune intégration avec un logiciel précis n'est implémentée :
// le format exact dépendra de la documentation officielle du logiciel choisi par l'agence.
// Cette API générique permet à un connecteur (script, service d'import) de créer, mettre à jour
// et retirer des biens identifiés par leur référence externe. Voir docs/API.md.
import { timingSafeEqual, createHash } from 'node:crypto';
import { json, readBody, HttpError } from '../http.js';
import { readBiensWithEtag, writeBiens, sanitizeBien, readBiens } from '../biens.js';

function requireSyncKey(request) {
  const key = process.env.SYNC_API_KEY;
  if (!key) throw new HttpError(503, 'API de synchronisation non activée (SYNC_API_KEY absente)');
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = createHash('sha256').update(given).digest(), b = createHash('sha256').update(key).digest();
  if (!timingSafeEqual(a, b)) throw new HttpError(401, 'Clé d’API invalide');
}

async function mutate(fn) {
  for (let i = 0; i < 4; i++) {
    const { data, etag } = await readBiensWithEtag();
    const list = data || [];
    const res = await fn(list);
    try { await writeBiens(list, etag); return res; } catch (e) { if (e.status !== 409 || i === 3) throw e; }
  }
}

async function list({ request }) {
  requireSyncKey(request);
  return json({ biens: await readBiens() });
}

async function upsert({ request, params }) {
  requireSyncKey(request);
  const ref = String(params.ref).slice(0, 80);
  const body = await readBody(request, 200_000);
  const result = await mutate(list => {
    const i = list.findIndex(b => b.externalRef === ref);
    const bien = sanitizeBien({ ...body, externalRef: ref, source: 'api', id: i >= 0 ? list[i].id : '' }, i >= 0 ? list[i] : null);
    if (i >= 0) list[i] = bien; else list.unshift(bien);
    return { bien, created: i < 0 };
  });
  return json(result, result.created ? 201 : 200);
}

async function remove({ request, params }) {
  requireSyncKey(request);
  const found = await mutate(list => {
    const i = list.findIndex(b => b.externalRef === params.ref);
    if (i >= 0) list.splice(i, 1);
    return i >= 0;
  });
  if (!found) throw new HttpError(404, 'Aucun bien avec cette référence externe');
  return json({ ok: true });
}

// Appels machine à machine : pas d'en-tête Origin, la clé d'API fait foi
export default [
  ['GET', '/v1/biens', list, { skipOrigin: true }],
  ['PUT', '/v1/biens/:ref', upsert, { skipOrigin: true }],
  ['DELETE', '/v1/biens/:ref', remove, { skipOrigin: true }],
];
