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

// N'accepte qu'une image locale du site ou une photo hébergée sur Vercel Blob
function cleanPhoto(v) {
  const s = str(v, 500);
  if (/^img\/[\w.-]+\.(webp|jpe?g|png)$/i.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com')) return u.href;
  } catch {}
  return '';
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
      photo: cleanPhoto(b.photo),
    };
  });
}
