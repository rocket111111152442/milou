// Serveur local / auto-hébergé : sert public/ et l'API. Sur Vercel, c'est vercel.json + api/index.js.
import http from 'node:http';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { handleApi } from '../lib/api.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
const HEADERS = Object.fromEntries(vercel.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key, h.value]));

const files = new Map();
(function load(dir, base = '') {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { load(full, base + '/' + name); continue; }
    const buf = readFileSync(full);
    const type = TYPES[extname(name)] || 'application/octet-stream';
    const text = /text|json|svg|manifest/.test(type);
    files.set(base + '/' + name, { buf, type, etag: '"' + createHash('sha1').update(buf).digest('hex').slice(0, 16) + '"', gz: text ? gzipSync(buf) : null, br: text ? brotliCompressSync(buf) : null });
  }
})(join(ROOT, 'public'));

http.createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path.startsWith('/api/')) return handleApi(req, res);
  const f = files.get(path === '/' ? '/index.html' : path) || (!extname(path) && files.get('/index.html'));
  if (!f) { res.writeHead(404).end('Not found'); return; }
  const headers = { ...HEADERS, 'Content-Type': f.type, ETag: f.etag, 'Cache-Control': path.startsWith('/icons/') ? 'public, max-age=604800' : 'no-cache', Vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === f.etag) { res.writeHead(304, headers).end(); return; }
  const ae = req.headers['accept-encoding'] || '';
  let body = f.buf;
  if (f.br && ae.includes('br')) { body = f.br; headers['Content-Encoding'] = 'br'; } else if (f.gz && ae.includes('gzip')) { body = f.gz; headers['Content-Encoding'] = 'gzip'; }
  res.writeHead(200, headers).end(body);
}).listen(PORT, () => console.log(`Netdex sur http://localhost:${PORT}`));
