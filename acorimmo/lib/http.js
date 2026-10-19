// Outils HTTP partagés par toutes les routes
export class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

// Lit un corps JSON avec une taille maximale
export async function readBody(request, maxBytes = 200_000) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > maxBytes) throw new HttpError(413, 'Requête trop volumineuse');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Requête trop volumineuse');
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Format de données invalide'); }
}

export async function readBinary(request, maxBytes) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > maxBytes) throw new HttpError(413, `Fichier trop lourd (${Math.round(maxBytes / 1e6)} Mo max)`);
  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.length > maxBytes) throw new HttpError(413, `Fichier trop lourd (${Math.round(maxBytes / 1e6)} Mo max)`);
  if (!buf.length) throw new HttpError(400, 'Fichier vide');
  return buf;
}

export const clientIp = (request) =>
  (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'local';

// Protection CSRF : les requêtes qui modifient des données doivent venir du site lui-même
export function assertSameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (origin) {
    let o;
    try { o = new URL(origin); } catch { throw new HttpError(403, 'Origine refusée'); }
    if (o.host !== host) throw new HttpError(403, 'Origine refusée');
  } else if (request.headers.get('x-requested-with') !== 'site') {
    throw new HttpError(403, 'Origine refusée');
  }
}

export function parseCookies(request) {
  const out = {};
  (request.headers.get('cookie') || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

// Détecte le vrai format d'une image d'après ses premiers octets (ne pas croire l'en-tête du client)
export function sniffImage(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' };
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return { type: 'image/png', ext: 'png' };
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { type: 'image/webp', ext: 'webp' };
  return null;
}
