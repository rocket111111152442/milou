// Serveur de développement local : sert le site et l'API sans compte Vercel.
// Usage : STORAGE=fs SESSION_SECRET=… ADMIN_EMAIL=… ADMIN_PASSWORD=… node scripts/dev.mjs
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import * as router from '../api/router.js';

const ROOT = resolve(new URL('../public', import.meta.url).pathname);
// Mêmes en-têtes de sécurité qu'en production (CSP…), pour détecter les problèmes en local
const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const SECURITY = Object.fromEntries((vercel.headers.find(h => h.source === '/(.*)')?.headers || []).filter(h => h.key !== 'Strict-Transport-Security').map(h => [h.key.toLowerCase(), h.value]));
const PORT = Number(process.env.PORT || 3000);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    // Mêmes réécritures que vercel.json pour les pages rendues côté serveur
    const rewrites = [[/^\/bien\/([\w-]+)$/, m => `/api/ssr/bien/${m[1]}`], [/^\/immobilier\/([\w-]+)$/, m => `/api/ssr/ville/${m[1]}`], [/^\/sitemap\.xml$/, () => '/api/ssr/sitemap'], [/^\/robots\.txt$/, () => '/api/ssr/robots'], [/^\/biens$/, () => '/biens.html']];
    for (const [re, to] of rewrites) { const m = url.pathname.match(re); if (m) { const t = to(m); if (t.startsWith('/api/')) url.pathname = t; else { url.pathname = t; } break; } }
    if (url.pathname === '/bien.html') { res.writeHead(301, { location: url.searchParams.get('id') ? `/bien/${url.searchParams.get('id')}` : '/biens' }); return res.end(); }
    if (url.pathname.startsWith('/api/')) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
      const handler = router[req.method];
      const response = handler ? await handler(request) : new Response('Méthode non gérée', { status: 405 });
      const headers = {};
      response.headers.forEach((v, k) => { headers[k] = v; });
      res.writeHead(response.status, headers);
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    let file = join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) throw Object.assign(new Error(), { code: 'ENOENT' });
    if (url.pathname === '/admin') file = join(ROOT, 'admin/index.html');
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const buf = await readFile(file);
    res.writeHead(200, { ...SECURITY, 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch (e) {
    if (e.code !== 'ENOENT') console.error(e);
    res.writeHead(e.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(e.code === 'ENOENT' ? 'Introuvable' : 'Erreur');
  }
}).listen(PORT, () => console.log(`Site local : http://localhost:${PORT}`));
