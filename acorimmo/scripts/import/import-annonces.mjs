// Importe un fichier d'annonces (produit par scrape-acorimmo.mjs) dans le stockage du site :
// télécharge les photos, les redimensionne (1600 px, WebP, comme l'admin) puis crée ou met à jour chaque bien
// d'après sa référence externe. Relancer l'import met à jour les biens sans créer de doublon.
//
// Prérequis : ImageMagick (commande `magick` ou `convert`) pour le redimensionnement.
//
// Deux destinations :
//   - local : STORAGE=fs node scripts/import/import-annonces.mjs --fichier=annonces.json
//       (écrit dans .data/, pour le serveur de développement)
//   - site en ligne, via l'API de synchronisation (docs/API.md) :
//       SYNC_API_KEY=… node scripts/import/import-annonces.mjs --fichier=annonces.json --api=https://mon-site.vercel.app
//
// Options : --photos=8 (photos par bien, 30 max), --photos-vendus=3, --cache=dossier (photos déjà redimensionnées)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
if (!args.fichier) { console.error('Usage : node scripts/import/import-annonces.mjs --fichier=annonces.json [--api=https://…]'); process.exit(1); }
const MAX = Math.min(30, Number(args.photos || 8));
const MAX_VENDUS = Math.min(MAX, Number(args['photos-vendus'] || 3));
const CACHE = args.cache || join(tmpdir(), 'import-photos');
const API = (args.api || '').replace(/\/+$/, '');
const KEY = process.env.SYNC_API_KEY || '';
if (API && !KEY) { console.error('SYNC_API_KEY manquante'); process.exit(1); }
if (!API && process.env.STORAGE !== 'fs') { console.error('Import local : lancer avec STORAGE=fs (ou utiliser --api=…)'); process.exit(1); }

const IM = ['magick', 'convert'].find(c => spawnSync(c, ['-version']).status === 0);
if (!IM) { console.error('ImageMagick introuvable (magick ou convert)'); process.exit(1); }
await mkdir(CACHE, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const resize = (buf) => new Promise((resolve, reject) => {
  const p = spawn(IM, ['-', '-auto-orient', '-resize', '1600x1600>', '-strip', '-quality', '78', 'webp:-']);
  const out = [];
  p.stdout.on('data', d => out.push(d));
  p.on('error', reject);
  p.on('close', code => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ImageMagick : code ${code}`))));
  p.stdin.end(buf);
});

async function download(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (import annonces)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (i === 3) throw e;
      await sleep(1500 * (i + 1));
    }
  }
}

// Photo d'origine → fichier WebP nommé d'après son empreinte (mémorisé dans le cache)
async function preparePhoto(url) {
  const key = createHash('sha1').update(url).digest('hex');
  const index = join(CACHE, `${key}.name`);
  try {
    const name = (await readFile(index, 'utf8')).trim();
    return { name, buf: await readFile(join(CACHE, name)) };
  } catch {}
  const webp = await resize(await download(url));
  const name = `${createHash('sha256').update(webp).digest('hex').slice(0, 32)}.webp`;
  await writeFile(join(CACHE, name), webp);
  await writeFile(index, name);
  return { name, buf: webp };
}

async function api(method, path, body, type = 'application/json') {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(`${API}/api${path}`, { method, headers: { authorization: `Bearer ${KEY}`, 'content-type': type }, body });
    if (res.ok) return res.json();
    if (res.status < 500 && res.status !== 409 && res.status !== 429) throw new Error(`${method} ${path} : ${res.status} ${await res.text()}`);
    await sleep(2000 * (i + 1));
  }
  throw new Error(`${method} ${path} : échec après plusieurs essais`);
}

// Destination locale : mêmes fonctions que l'API de synchronisation
const local = API ? null : {
  storage: await import('../../lib/storage.js'),
  biens: await import('../../lib/biens.js'),
};

const { biens, source, releveLe } = JSON.parse(await readFile(args.fichier, 'utf8'));
console.log(`${biens.length} annonces (${source}, relevé du ${releveLe}) → ${API || 'stockage local .data/'}`);

// Ordre conservé : la première annonce du fichier reste en tête de liste (chaque création s'ajoute en tête)
let n = 0, nbPhotos = 0;
const errors = [];
for (const b of [...biens].reverse()) {
  n++;
  try {
    const limit = b.statut === 'vendu' || b.statut === 'loue' ? MAX_VENDUS : MAX;
    const photos = [];
    for (const url of (b._photosSource || []).slice(0, limit)) {
      try {
        const { name, buf } = await preparePhoto(url);
        if (API) await api('PUT', `/v1/photos/${name}`, buf, 'image/webp');
        else await local.storage.writeBuffer(`photos/${name}`, buf, 'image/webp');
        photos.push(`/api/media/photos/${name}`);
      } catch (e) { errors.push(`${b.ref} photo ${url} : ${e.message}`); }
    }
    nbPhotos += photos.length;
    const bien = Object.fromEntries(Object.entries(b).filter(([k]) => !k.startsWith('_')));
    bien.photos = photos;
    if (API) await api('PUT', `/v1/biens/${encodeURIComponent(bien.externalRef)}`, JSON.stringify(bien));
    else {
      const { data, etag } = await local.biens.readBiensWithEtag();
      const list = data || [];
      const i = list.findIndex(x => x.externalRef === bien.externalRef);
      const clean = local.biens.sanitizeBien({ ...bien, id: i >= 0 ? list[i].id : bien.id }, i >= 0 ? list[i] : null);
      if (i >= 0) list[i] = clean; else list.unshift(clean);
      await local.biens.writeBiens(list, etag);
    }
    process.stdout.write(`\r${n}/${biens.length} biens, ${nbPhotos} photos`);
  } catch (e) { errors.push(`${b.ref} : ${e.message}`); }
}
console.log(`\nTerminé : ${n - errors.filter(e => !e.includes(' photo ')).length} biens, ${nbPhotos} photos.`);
if (errors.length) { console.log(`${errors.length} erreur(s) :`); errors.slice(0, 30).forEach(e => console.log(' - ' + e)); process.exitCode = 1; }
