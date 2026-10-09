import { migrate } from './db.js';
import { importSites, loadTrancoCsv } from './sites.js';

// Crée les tables et importe le classement Tranco (ajout seulement, jamais de renumérotation).
// SITES_LIMIT limite la taille du catalogue (utile sur une petite base gratuite).
export async function setupDatabase(db, { force = false } = {}) {
  await migrate(db);
  const limit = Number(process.env.SITES_LIMIT) || Infinity;
  const { n } = await db.one('SELECT COUNT(*) n FROM sites');
  const tiers = await db.one("SELECT 1 FROM meta WHERE key = 'tiers'");
  if (n > 0 && tiers && !force && n >= Math.min(limit, 900_000)) return `Base prête : ${n} sites.`;
  const t = Date.now();
  const { added, total } = await importSites(db, await loadTrancoCsv(process.env.TRANCO_FILE), { limit });
  return `${added} sites ajoutés (${total} au total) en ${((Date.now() - t) / 1000).toFixed(1)} s.`;
}
