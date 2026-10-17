import { json, isAuthorized, readBiens, writeBiens, sanitize } from './_lib.js';

export async function GET() {
  try {
    return json(await readBiens());
  } catch (e) {
    console.error(e);
    return json({ error: 'Impossible de charger les biens' }, 500);
  }
}

export async function PUT(request) {
  if (!isAuthorized(request)) return json({ error: 'Non autorisé' }, 401);
  let biens;
  try {
    biens = sanitize(await request.json());
  } catch (e) {
    return json({ error: e.message || 'Données invalides' }, 400);
  }
  try {
    await writeBiens(biens);
    return json(biens);
  } catch (e) {
    console.error(e);
    return json({ error: "Échec de l'enregistrement" }, 500);
  }
}
