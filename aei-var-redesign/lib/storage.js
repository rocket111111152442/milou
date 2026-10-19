// Couche de stockage. Toute l'application passe par ces fonctions :
// pour passer à une vraie base de données (PostgreSQL…), seul ce fichier change.
//
// - Production : Vercel Blob en accès PRIVÉ (BLOB_READ_WRITE_TOKEN).
// - Développement / tests : fichiers dans .data/ (STORAGE=fs).
import { put, get, list, del, head } from '@vercel/blob';
import { mkdir, readFile, writeFile, rm, readdir, stat, rename } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const useFs = process.env.STORAGE === 'fs' || !process.env.BLOB_READ_WRITE_TOKEN;
const FS_ROOT = process.env.STORAGE_DIR || join(process.cwd(), '.data');

export class ConflictError extends Error {
  constructor() { super('Les données ont été modifiées entre-temps. Rechargez puis réessayez.'); this.status = 409; }
}

const safeKey = (key) => {
  if (!/^[\w\-./]+$/.test(key) || key.includes('..') || key.startsWith('/')) throw new Error(`Clé de stockage invalide : ${key}`);
  return key;
};

// ---------- Fichiers locaux ----------
const fsAdapter = {
  async getBuffer(key) {
    try { return await readFile(join(FS_ROOT, safeKey(key))); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  },
  async etag(key) {
    const buf = await this.getBuffer(key);
    return buf ? createHash('sha1').update(buf).digest('hex') : null;
  },
  async put(key, body, { ifMatch } = {}) {
    const file = join(FS_ROOT, safeKey(key));
    if (ifMatch !== undefined) {
      const current = await this.etag(key);
      if (current !== ifMatch && !(current === null && ifMatch === null)) throw new ConflictError();
    }
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body);
  },
  async list(prefix) {
    const out = [];
    const walk = async (dir) => {
      let entries = [];
      try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else {
          const key = relative(FS_ROOT, p).split('\\').join('/');
          if (key.startsWith(prefix)) out.push({ key, uploadedAt: (await stat(p)).mtime, size: (await stat(p)).size });
        }
      }
    };
    await walk(FS_ROOT);
    return out;
  },
  async del(keys) {
    await Promise.all([].concat(keys).map(k => rm(join(FS_ROOT, safeKey(k)), { force: true })));
  },
  async move(from, to) {
    const dest = join(FS_ROOT, safeKey(to));
    await mkdir(dirname(dest), { recursive: true });
    await rename(join(FS_ROOT, safeKey(from)), dest);
  },
};

// ---------- Vercel Blob privé ----------
const streamToBuffer = async (stream) => Buffer.from(await new Response(stream).arrayBuffer());

const blobAdapter = {
  async getBuffer(key) {
    const res = await get(safeKey(key), { access: 'private', useCache: false });
    if (!res || res.statusCode !== 200) return null;
    return streamToBuffer(res.stream);
  },
  async etag(key) {
    try { return (await head(safeKey(key))).etag; } catch (e) { if (e?.name === 'BlobNotFoundError' || /not.?found/i.test(e?.message)) return null; throw e; }
  },
  async put(key, body, { ifMatch, contentType } = {}) {
    const opts = { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: contentType || 'application/json', cacheControlMaxAge: 60 };
    if (ifMatch) opts.ifMatch = ifMatch;
    else if (ifMatch === null) opts.allowOverwrite = false; // création : ne doit pas exister
    try {
      await put(safeKey(key), body, opts);
    } catch (e) {
      if (e?.name === 'BlobPreconditionFailedError' || /precondition|already exists/i.test(e?.message)) throw new ConflictError();
      throw e;
    }
  },
  async list(prefix) {
    const out = [];
    let cursor;
    do {
      const res = await list({ prefix, cursor, limit: 1000 });
      res.blobs.forEach(b => out.push({ key: b.pathname, uploadedAt: new Date(b.uploadedAt), size: b.size }));
      cursor = res.hasMore ? res.cursor : undefined;
    } while (cursor);
    return out;
  },
  async del(keys) {
    const arr = [].concat(keys).map(safeKey);
    if (arr.length) await del(arr);
  },
  async move(from, to) {
    const buf = await this.getBuffer(from);
    if (!buf) throw new Error('Fichier introuvable');
    const type = (await head(safeKey(from))).contentType;
    await this.put(to, buf, { contentType: type });
    await this.del(from);
  },
};

const adapter = useFs ? fsAdapter : blobAdapter;
export const storageMode = useFs ? 'fichiers locaux (.data)' : 'Vercel Blob privé';

// ---------- API utilisée par l'application ----------
export async function readJSON(key, fallback = null) {
  const buf = await adapter.getBuffer(key);
  if (!buf) return fallback;
  return JSON.parse(buf.toString('utf8'));
}

// Lecture + empreinte, pour une écriture protégée contre les modifications concurrentes
export async function readJSONWithEtag(key, fallback = null) {
  const etag = await adapter.etag(key);
  if (etag === null) return { data: fallback, etag: null };
  const buf = await adapter.getBuffer(key);
  return { data: buf ? JSON.parse(buf.toString('utf8')) : fallback, etag };
}

export const writeJSON = (key, data, opts = {}) => adapter.put(key, JSON.stringify(data), { ...opts, contentType: 'application/json' });
export const readBuffer = (key) => adapter.getBuffer(key);
export const writeBuffer = (key, buf, contentType) => adapter.put(key, buf, { contentType });
export const listKeys = (prefix) => adapter.list(prefix);
export const removeKeys = (keys) => adapter.del(keys);
export const moveKey = (from, to) => adapter.move(from, to);

// Modification atomique « lire → transformer → écrire », avec quelques essais en cas de conflit
export async function updateJSON(key, fallback, fn, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const { data, etag } = await readJSONWithEtag(key, fallback);
    const next = await fn(structuredClone(data));
    try {
      await writeJSON(key, next, { ifMatch: etag });
      return next;
    } catch (e) {
      if (!(e instanceof ConflictError) || i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 80 * (i + 1)));
    }
  }
}

// Lecture en parallèle limitée (évite de saturer le stockage)
export async function readMany(keys, concurrency = 16) {
  const out = new Array(keys.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, keys.length) }, async () => {
    while (i < keys.length) {
      const n = i++;
      try { out[n] = await readJSON(keys[n]); } catch { out[n] = null; }
    }
  }));
  return out.filter(Boolean);
}
