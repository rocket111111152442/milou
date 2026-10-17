import { list, put, del } from '@vercel/blob';
import { timingSafeEqual, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const DATA_PREFIX = 'data/biens-';
const KEEP_VERSIONS = 5; // anciennes versions gardées en secours

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

// Compare des empreintes pour un temps constant quelle que soit la longueur
export function isAuthorized(request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

async function seed() {
  const file = new URL('../data/biens.json', import.meta.url);
  return JSON.parse(await readFile(file, 'utf8'));
}

// Chaque sauvegarde crée un nouveau fichier : pas de souci de cache CDN sur une URL réécrite
export async function readBiens() {
  return (await readRaw()).map(b => ({ ...b, ...cleanPhotos(b) }));
}

async function readRaw() {
  const { blobs } = await list({ prefix: DATA_PREFIX });
  if (!blobs.length) return seed();
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const res = await fetch(blobs[0].url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Lecture impossible (${res.status})`);
  return res.json();
}

export async function writeBiens(biens) {
  await put(`${DATA_PREFIX}${Date.now()}.json`, JSON.stringify(biens), {
    access: 'public',
    addRandomSuffix: true,
    contentType: 'application/json',
  });
  const { blobs } = await list({ prefix: DATA_PREFIX });
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const old = blobs.slice(KEEP_VERSIONS).map(b => b.url);
  if (old.length) await del(old);
}

const str = (v, max = 120) => String(v ?? '').trim().slice(0, max);
const BADGES = ['', 'Nouveauté', 'Exclusivité', 'Coup de cœur', 'Prix en baisse'];
const REGIONS = ['var', 'loiret', 'autre'];
const TYPES = ['Maison', 'Appartement', 'Villa', 'Terrain', 'Immeuble', 'Local commercial', 'Parking', 'Autre'];
const LETTRES = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

const strList = (v, maxItems, maxLen) =>
  (Array.isArray(v) ? v : []).map(x => str(x, maxLen)).filter(Boolean).slice(0, maxItems);

function cleanComposition(v) {
  return (Array.isArray(v) ? v : [])
    .map(r => ({ niveau: str(r?.niveau, 40), piece: str(r?.piece, 60), surface: str(r?.surface, 12) }))
    .filter(r => r.piece)
    .slice(0, 60);
}

// N'accepte qu'une image locale du site ou une photo hébergée sur Vercel Blob
function cleanPhoto(v) {
  const s = str(v, 500);
  if (/^img\/(?:[\w-]+\/)*[\w.-]+\.(webp|jpe?g|png)$/i.test(s) && !s.includes('..')) return s;
  try {
    const u = new URL(s);
    if (u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com')) return u.href;
  } catch {}
  return '';
}

const MAX_PHOTOS = 30;

// `photos` est la liste complète ; `photo` (la première) reste pour les anciennes données
export function cleanPhotos(b) {
  const raw = Array.isArray(b.photos) ? b.photos : b.photo ? [b.photo] : [];
  const photos = [...new Set(raw.map(cleanPhoto).filter(Boolean))].slice(0, MAX_PHOTOS);
  return { photo: photos[0] || '', photos };
}

export function sanitize(input) {
  if (!Array.isArray(input)) throw new Error('Liste de biens attendue');
  if (input.length > 500) throw new Error('Trop de biens');
  const ids = new Set();
  return input.map((b, i) => {
    let id = str(b.id, 60).replace(/[^\w-]/g, '') || `bien-${Date.now()}-${i}`;
    while (ids.has(id)) id += '-x';
    ids.add(id);
    return {
      id,
      titre: str(b.titre) || 'Bien',
      ville: str(b.ville, 60),
      cp: str(b.cp, 10),
      region: REGIONS.includes(b.region) ? b.region : 'autre',
      surface: str(b.surface, 20),
      chambres: str(b.chambres, 10),
      terrain: str(b.terrain, 20),
      extra: str(b.extra, 40),
      prix: str(b.prix, 30),
      badge: BADGES.includes(b.badge) ? b.badge : '',
      vendu: Boolean(b.vendu),
      ...cleanPhotos(b),
      ref: str(b.ref, 30),
      type: TYPES.includes(b.type) ? b.type : 'Maison',
      pieces: str(b.pieces, 10),
      sdb: str(b.sdb, 10),
      sde: str(b.sde, 10),
      niveaux: str(b.niveaux, 10),
      annee: str(b.annee, 10),
      cuisine: str(b.cuisine, 60),
      chauffage: str(b.chauffage, 120),
      description: str(b.description, 6000),
      equipements: strList(b.equipements, 30, 40),
      composition: cleanComposition(b.composition),
      dpe: LETTRES.includes(b.dpe) ? b.dpe : '',
      dpeKwh: str(b.dpeKwh, 10),
      ges: LETTRES.includes(b.ges) ? b.ges : '',
      gesCo2: str(b.gesCo2, 10),
      energieMin: str(b.energieMin, 20),
      energieMax: str(b.energieMax, 20),
      energieRef: str(b.energieRef, 10),
      honoraires: str(b.honoraires, 200),
      taxeFonciere: str(b.taxeFonciere, 20),
      chargesCopro: str(b.chargesCopro, 20),
      lotsCopro: str(b.lotsCopro, 10),
    };
  });
}
