// Avis clients saisis par l'agence (aucun avis n'est généré ni modifié par le site).
import { readJSON, updateJSON } from './storage.js';
import { HttpError } from './http.js';
import { avis as INITIAL } from '../config/contenu-initial.js';

const KEY = 'data/avis.json';
const EMPTY = { agregat: null, avis: [] };
const str = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);

function cleanUrl(v) {
  const s = str(v, 300);
  if (!s) return '';
  try { const u = new URL(s); if (u.protocol !== 'https:') throw 0; return u.href; } catch { throw new HttpError(400, `Lien invalide : « ${s} »`); }
}

export function sanitizeAvis(input) {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'Données invalides');
  const ag = input.agregat;
  let agregat = null;
  if (ag && (ag.note || ag.nombre)) {
    const note = Number(String(ag.note).replace(',', '.'));
    const nombre = Math.floor(Number(ag.nombre));
    if (!(note >= 1 && note <= 5)) throw new HttpError(400, 'La note globale doit être comprise entre 1 et 5');
    if (!(nombre >= 1 && nombre <= 100000)) throw new HttpError(400, 'Le nombre d’avis doit être un entier positif');
    agregat = { note: Math.round(note * 10) / 10, nombre, source: str(ag.source, 60), url: cleanUrl(ag.url), releveLe: str(ag.releveLe, 10) };
    if (!agregat.source) throw new HttpError(400, 'Indiquez la source de la note globale (Google, PagesJaunes…)');
  }
  const avis = (Array.isArray(input.avis) ? input.avis : []).slice(0, 200).map((a, i) => {
    const note = Math.floor(Number(a.note));
    if (!(note >= 1 && note <= 5)) throw new HttpError(400, `Avis n° ${i + 1} : note de 1 à 5 obligatoire`);
    const texte = str(a.texte, 1200);
    if (!texte) throw new HttpError(400, `Avis n° ${i + 1} : texte obligatoire`);
    const date = str(a.date, 10);
    if (date && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(date)) throw new HttpError(400, `Avis n° ${i + 1} : date au format AAAA ou AAAA-MM-JJ`);
    return { id: str(a.id, 40) || `a${Date.now().toString(36)}${i}`, auteur: str(a.auteur, 60) || 'Client', note, texte, date, source: str(a.source, 60) || 'Recueilli par l’agence', url: cleanUrl(a.url), publie: a.publie !== false };
  });
  return { agregat, avis };
}

export const readAvis = async ({ tolerant = false } = {}) => {
  let saved = null;
  try { saved = await readJSON(KEY, null); } catch (e) { if (!tolerant) throw e; }
  return { ...EMPTY, ...(saved || INITIAL) };
};
export const writeAvis = (data) => updateJSON(KEY, EMPTY, () => data);

// Vue publique : avis publiés + note globale (saisie ou calculée à partir des avis publiés)
export async function publicAvis({ tolerant = false } = {}) {
  const { agregat, avis } = await readAvis({ tolerant });
  const pub = avis.filter(a => a.publie);
  const calc = pub.length ? { note: Math.round((pub.reduce((s, a) => s + a.note, 0) / pub.length) * 10) / 10, nombre: pub.length, source: 'Avis publiés sur ce site', url: '', releveLe: '' } : null;
  return { global: agregat || calc, avis: pub.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12) };
}
