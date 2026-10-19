// API de synchronisation des annonces, pour un futur logiciel de transaction.
// STATUT : « À CONNECTER ». Aucune intégration avec un logiciel précis n'est implémentée :
// le format exact dépendra de la documentation officielle du logiciel choisi par l'agence.
// Cette API générique permet à un connecteur (script, service d'import) de créer, mettre à jour
// et retirer des biens identifiés par leur référence externe. Voir docs/API.md.
import { timingSafeEqual, createHash } from 'node:crypto';
import { json, readBody, readBinary, HttpError, sniffImage } from '../http.js';
import { readBiensWithEtag, writeBiens, sanitizeBien, readBiens } from '../biens.js';
import { writeBuffer } from '../storage.js';

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
    // Création : identifiant lisible proposé par le connecteur s'il est libre, sinon attribué par le site
    const wanted = /^[\w-]{3,60}$/.test(body.id || '') && !list.some(b => b.id === body.id) ? body.id : '';
    const bien = sanitizeBien({ ...body, externalRef: ref, source: 'api', id: i >= 0 ? list[i].id : wanted }, i >= 0 ? list[i] : null);
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

// Envoi d'une photo par le connecteur. Le nom est l'empreinte du fichier (un nouvel envoi du même fichier
// ne crée pas de doublon) ; le vrai format de l'image est contrôlé comme pour l'admin.
async function uploadPhoto({ request, params }) {
  requireSyncKey(request);
  const m = String(params.name).match(/^([a-f0-9]{24,64})\.(webp|jpg|png)$/);
  if (!m) throw new HttpError(400, 'Nom de fichier attendu : <empreinte hexadécimale>.webp|jpg|png');
  const buf = await readBinary(request, 4 * 1024 * 1024);
  const img = sniffImage(buf);
  if (!img || img.ext !== m[2]) throw new HttpError(415, 'Format accepté : JPEG, PNG ou WebP (extension conforme au contenu)');
  if (createHash('sha256').update(buf).digest('hex').slice(0, m[1].length) !== m[1]) throw new HttpError(400, 'Le nom ne correspond pas à l’empreinte du fichier');
  await writeBuffer(`photos/${params.name}`, buf, img.type);
  return json({ url: `/api/media/photos/${params.name}` });
}

// Appels machine à machine : pas d'en-tête Origin, la clé d'API fait foi
export default [
  ['PUT', '/v1/photos/:name', uploadPhoto, { skipOrigin: true }],
  ['GET', '/v1/biens', list, { skipOrigin: true }],
  ['PUT', '/v1/biens/:ref', upsert, { skipOrigin: true }],
  ['DELETE', '/v1/biens/:ref', remove, { skipOrigin: true }],
];
