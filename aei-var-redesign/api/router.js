// Point d'entrée unique de l'API (vercel.json redirige /api/* ici).
// Une seule fonction serveur : plus simple à sécuriser et compatible avec la limite de fonctions de Vercel.
import { json, HttpError, assertSameOrigin } from '../lib/http.js';
import { ConflictError } from '../lib/storage.js';
import authRoutes from '../lib/routes/auth.js';
import publicRoutes from '../lib/routes/public.js';
import adminRoutes from '../lib/routes/admin.js';
import syncRoutes from '../lib/routes/sync.js';
import cronRoutes from '../lib/routes/cron.js';
import ssrRoutes from '../lib/routes/ssr.js';
import crmRoutes from '../lib/routes/crm.js';

// Chaque route : [méthode, motif, gestionnaire]. Les :params sont extraits du chemin.
const ROUTES = [...publicRoutes, ...authRoutes, ...adminRoutes, ...syncRoutes, ...cronRoutes, ...ssrRoutes, ...crmRoutes].map(([method, pattern, handler, opts = {}]) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  return { method, re, keys, handler, opts };
});

async function handle(request) {
  const url = new URL(request.url);
  // Le chemin d'origine est transmis par la réécriture de vercel.json (?__path=…)
  const path = '/' + (url.searchParams.get('__path') || url.pathname.replace(/^\/api\/?/, '')).replace(/^\/+|\/+$/g, '');
  url.searchParams.delete('__path');

  let allowed = false;
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (!m) continue;
    allowed = true;
    if (r.method !== request.method) continue;
    if (!r.opts.skipOrigin) assertSameOrigin(request);
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    return r.handler({ request, url, params, query: url.searchParams });
  }
  if (allowed) throw new HttpError(405, 'Méthode non autorisée');
  throw new HttpError(404, 'Route inconnue');
}

async function entry(request) {
  try {
    return await handle(request);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
    if (e instanceof ConflictError) return json({ error: e.message }, 409);
    console.error(e);
    if (e?.name === 'BlobError' || /Vercel Blob/i.test(e?.message || '')) return json({ error: 'Le service de stockage est momentanément indisponible. Réessayez plus tard ou appelez l’agence.' }, 503);
    return json({ error: 'Erreur interne. Réessayez dans un instant.' }, 500);
  }
}

export const GET = entry;
export const POST = entry;
export const PUT = entry;
export const PATCH = entry;
export const DELETE = entry;
