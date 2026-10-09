import { migrate } from './db.js';
import { importSites, loadTrancoCsv, importTail, getTail } from './sites.js';

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

// Liste Tranco complète (~4,5 millions de domaines classés), rangée en blocs compressés à la suite des sites existants.
export async function setupTail(db) {
  if (await getTail(db)) return 'Longue traîne déjà importée.';
  const t = Date.now();
  let csv;
  if (process.env.TRANCO_FULL_FILE) csv = (await import('node:fs')).readFileSync(process.env.TRANCO_FULL_FILE, 'utf8');
  else {
    const id = (await (await fetch('https://tranco-list.eu/top-1m-id')).text()).trim();
    const res = await fetch(`https://tranco-list.eu/download/${id}/full`);
    if (!res.ok) throw new Error('Téléchargement de la liste complète impossible : HTTP ' + res.status);
    csv = await res.text();
  }
  const { added } = await importTail(db, csv);
  return `${added} sites ajoutés en longue traîne en ${((Date.now() - t) / 1000).toFixed(1)} s.`;
}
