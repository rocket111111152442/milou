import { put } from '@vercel/blob';
import { json, isAuthorized } from './_lib.js';

const MAX_BYTES = 4 * 1024 * 1024; // limite d'un corps de requête Vercel : ~4,5 Mo
const TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

export async function POST(request) {
  if (!isAuthorized(request)) return json({ error: 'Non autorisé' }, 401);
  const type = (request.headers.get('content-type') || '').split(';')[0];
  const ext = TYPES[type];
  if (!ext) return json({ error: 'Format accepté : WebP, JPEG ou PNG' }, 415);

  const body = await request.arrayBuffer();
  if (!body.byteLength) return json({ error: 'Fichier vide' }, 400);
  if (body.byteLength > MAX_BYTES) return json({ error: 'Image trop lourde (4 Mo max)' }, 413);

  try {
    const blob = await put(`photos/bien.${ext}`, body, {
      access: 'public',
      addRandomSuffix: true,
      contentType: type,
    });
    return json({ url: blob.url });
  } catch (e) {
    console.error(e);
    return json({ error: "Échec de l'envoi de la photo" }, 500);
  }
}
