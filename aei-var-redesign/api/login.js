import { json, isAuthorized } from './_lib.js';

export async function POST(request) {
  if (!process.env.ADMIN_PASSWORD) return json({ error: 'Mot de passe admin non configuré' }, 500);
  if (!isAuthorized(request)) {
    await new Promise(r => setTimeout(r, 800)); // ralentit les essais en série
    return json({ error: 'Mot de passe incorrect' }, 401);
  }
  return json({ ok: true });
}
