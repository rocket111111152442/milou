// Communes : texte de présentation (pages SEO /immobilier/:commune) et prix au m² saisis par l'agence
// (base de l'estimation indicative). Aucune donnée de marché n'est fournie par défaut : tout vient de l'agence.
import { readJSON, updateJSON } from './storage.js';
import { HttpError } from './http.js';
import { slug } from './biens.js';

const KEY = 'data/communes.json';
const EMPTY = { marge: 10, communes: [] };
const str = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const price = (v) => {
  const s = str(v, 10).replace(/\s/g, '').replace(',', '.');
  if (!s) return '';
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 100000) throw new HttpError(400, `Prix au m² invalide : « ${s} »`);
  return String(Math.round(n));
};

export function sanitizeCommunes(input) {
  const list = Array.isArray(input?.communes) ? input.communes : null;
  if (!list) throw new HttpError(400, 'Liste de communes attendue');
  if (list.length > 100) throw new HttpError(400, 'Trop de communes');
  const marge = Number(input.marge ?? 10);
  if (!Number.isFinite(marge) || marge < 0 || marge > 50) throw new HttpError(400, 'La marge doit être comprise entre 0 et 50 %');
  const seen = new Set();
  return {
    marge,
    communes: list.map(c => {
      const nom = str(c.nom, 80);
      if (!nom) throw new HttpError(400, 'Chaque commune doit avoir un nom');
      const s = slug(nom);
      if (seen.has(s)) throw new HttpError(400, `Commune en double : ${nom}`);
      seen.add(s);
      const date = str(c.date, 10);
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'Date au format AAAA-MM-JJ');
      const cp = str(c.cp, 10);
      if (cp && !/^\d{5}$/.test(cp)) throw new HttpError(400, `Code postal invalide pour ${nom}`);
      return {
        slug: s, nom, cp,
        intro: str(c.intro, 3000),
        quartiers: str(c.quartiers, 300),
        prixM2Maison: price(c.prixM2Maison),
        prixM2Appartement: price(c.prixM2Appartement),
        source: str(c.source, 150),
        date,
      };
    }),
  };
}

export const readCommunes = async () => ({ ...EMPTY, ...(await readJSON(KEY, EMPTY)) });
export const writeCommunes = (data) => updateJSON(KEY, EMPTY, () => data);

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Estimation indicative = surface × prix au m² saisi par l'agence pour la commune et le type de bien, ± marge.
// Renvoie null tant que l'agence n'a pas renseigné de prix : on n'affiche jamais de chiffre inventé.
export async function indicative({ typeBien, ville, surface }) {
  const { marge, communes } = await readCommunes();
  const n = norm(ville);
  const c = communes.find(x => norm(x.nom) === n) || communes.find(x => n && (n.includes(norm(x.nom)) || norm(x.nom).includes(n)));
  if (!c) return null;
  const apt = /appartement/i.test(typeBien);
  const house = /maison|villa/i.test(typeBien);
  const pm2 = Number(apt ? c.prixM2Appartement : house ? c.prixM2Maison : 0);
  const s = Number(String(surface).replace(',', '.'));
  if (!pm2 || !(s > 0)) return null;
  const mid = pm2 * s;
  const round = (x) => Math.round(x / 1000) * 1000;
  return { commune: c.nom, prixM2: pm2, basse: round(mid * (1 - marge / 100)), haute: round(mid * (1 + marge / 100)), marge, source: c.source, date: c.date };
}
