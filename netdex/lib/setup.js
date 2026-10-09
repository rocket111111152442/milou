import { migrate } from './db.js';
import { importSites, loadTrancoCsv } from './sites.js';

// Crée les tables et importe le classement Tranco si la base est vide. Renvoie un résumé lisible.
export async function setupDatabase(db, { force = false } = {}) {
  await migrate(db);
  const { n } = await db.one('SELECT COUNT(*) n FROM sites');
  const tiers = await db.one("SELECT 1 FROM meta WHERE key = 'tiers'");
  if (n > 0 && tiers && !force) return `Base prête : ${n} sites.`;
  const t = Date.now();
  const count = await importSites(db, await loadTrancoCsv(process.env.TRANCO_FILE));
  return `${count} sites importés en ${((Date.now() - t) / 1000).toFixed(1)} s.`;
}
