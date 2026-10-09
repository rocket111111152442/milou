// Lancé au build (Vercel) ou à la main : crée les tables et importe le classement Tranco si besoin.
import { createDb } from '../lib/db.js';
import { setupDatabase } from '../lib/setup.js';

const db = createDb();
if (!db) {
  console.warn('⚠ DATABASE_URL absent : base non initialisée. Ajoute une base Postgres (Neon) au projet puis redéploie.');
  process.exit(0);
}
try {
  console.log(await setupDatabase(db, { force: process.env.REIMPORT_SITES === '1' }));
} catch (e) {
  // On ne bloque pas le déploiement : /api/admin/setup permet de relancer et affiche l'erreur.
  console.error('⚠ Initialisation de la base échouée :', e);
  process.exitCode = process.env.STRICT_MIGRATE === '1' ? 1 : 0;
} finally {
  await db.close();
}
