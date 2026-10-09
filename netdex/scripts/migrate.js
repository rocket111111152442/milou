// Lancé au build (Vercel) ou à la main : crée les tables et importe le classement Tranco si besoin.
import { createDb, migrate } from '../lib/db.js';
import { importSites, loadTrancoCsv } from '../lib/sites.js';

const db = createDb();
if (!db) {
  console.warn('⚠ DATABASE_URL absent : base non initialisée. Ajoute une base Postgres (Neon) au projet puis redéploie.');
  process.exit(0);
}
try {
  await migrate(db);
  const { n } = await db.one('SELECT COUNT(*) n FROM sites');
  const tiers = await db.one("SELECT 1 FROM meta WHERE key = 'tiers'");
  if (n === 0 || !tiers || process.env.REIMPORT_SITES === '1') {
    console.log('Import du classement Tranco (top 1M)…');
    const t = Date.now();
    const count = await importSites(db, await loadTrancoCsv(process.env.TRANCO_FILE));
    console.log(`${count} sites importés en ${((Date.now() - t) / 1000).toFixed(1)} s.`);
  } else {
    console.log(`Base prête : ${n} sites.`);
  }
} finally {
  await db.close();
}
