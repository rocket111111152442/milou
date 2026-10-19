// Modèle « bien immobilier » : validation, lecture/écriture, version publique
import { readJSONWithEtag, writeJSON, readJSON } from './storage.js';
import { HttpError } from './http.js';

const KEY = 'data/biens.json';

export const STATUTS = { disponible: 'Disponible', 'sous-compromis': 'Sous compromis', vendu: 'Vendu', loue: 'Loué' };
export const TRANSACTIONS = { vente: 'Vente', location: 'Location' };
export const TYPES = ['Maison', 'Villa', 'Appartement', 'Terrain', 'Immeuble', 'Local commercial', 'Parking', 'Autre'];
export const BADGES = ['', 'Nouveauté', 'Exclusivité', 'Coup de cœur', 'Prix en baisse'];
const REGIONS = ['var', 'loiret', 'autre'];
export const ETAPES = { '': 'Aucune', mandat: 'Mandat signé', offre: 'Offre reçue', compromis: 'Compromis signé', acte: 'Acte signé' };
const LETTRES = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
const MAX_PHOTOS = 30;

const str = (v, max = 120) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
// Nombres saisis librement ("1 300 000", "93,7") : on garde le texte mais on refuse le non-numérique
const numStr = (v, max = 20) => {
  const s = str(v, max);
  if (s && !/^[\d\s.,]+$/.test(s)) throw new HttpError(400, `Valeur numérique invalide : « ${s} »`);
  return s;
};
const strList = (v, maxItems, maxLen) => (Array.isArray(v) ? v : []).map(x => str(x, maxLen)).filter(Boolean).slice(0, maxItems);
export const toNumber = (s) => Number(String(s ?? '').replace(/\s/g, '').replace(',', '.')) || 0;

// Photos acceptées : images du site (img/…) ou fichiers envoyés via l'admin (/api/media/…)
function cleanPhoto(v) {
  const s = str(v, 300);
  if (/^img\/(?:[\w-]+\/)*[\w.-]+\.(webp|jpe?g|png)$/i.test(s) && !s.includes('..')) return s;
  if (/^\/api\/media\/photos\/[\w-]+\.(webp|jpe?g|png)$/i.test(s)) return s;
  return '';
}

// Lien externe (visite virtuelle, vidéo) : https uniquement, sans identifiants intégrés
function cleanUrl(v) {
  const s = str(v, 300);
  if (!s) return '';
  let u;
  try { u = new URL(s); } catch { throw new HttpError(400, `Lien invalide : « ${s} »`); }
  if (u.protocol !== 'https:' || u.username || u.password) throw new HttpError(400, 'Le lien doit commencer par https://');
  return u.href;
}

function cleanQuartier(v) {
  return (Array.isArray(v) ? v : [])
    .map(r => ({ label: str(r?.label, 50), distance: str(r?.distance, 20) }))
    .filter(r => r.label)
    .slice(0, 14);
}

function cleanComposition(v) {
  return (Array.isArray(v) ? v : [])
    .map(r => ({ niveau: str(r?.niveau, 40), piece: str(r?.piece, 60), surface: str(r?.surface, 12) }))
    .filter(r => r.piece)
    .slice(0, 60);
}

// Anciennes données : `vendu: true` devient le statut « vendu »
function legacyStatut(b) {
  if (b.statut && STATUTS[b.statut]) return b.statut;
  return b.vendu ? 'vendu' : 'disponible';
}

export function sanitizeBien(b, previous = null) {
  if (!b || typeof b !== 'object') throw new HttpError(400, 'Bien invalide');
  const titre = str(b.titre);
  const ville = str(b.ville, 60);
  if (!titre) throw new HttpError(400, 'Le titre est obligatoire');
  if (!ville) throw new HttpError(400, 'La ville est obligatoire');
  const cp = str(b.cp, 10);
  if (cp && !/^\d{5}$/.test(cp)) throw new HttpError(400, 'Le code postal doit contenir 5 chiffres');

  const raw = Array.isArray(b.photos) ? b.photos : b.photo ? [b.photo] : [];
  const photos = [...new Set(raw.map(cleanPhoto).filter(Boolean))].slice(0, MAX_PHOTOS);
  const statut = legacyStatut(b);
  const publie = b.publie === undefined ? true : Boolean(b.publie);
  const now = new Date().toISOString();

  return {
    id: str(b.id, 60).replace(/[^\w-]/g, '') || previous?.id,
    titre, ville, cp,
    adresse: str(b.adresse, 160), // privée : jamais renvoyée par l'API publique
    region: REGIONS.includes(b.region) ? b.region : 'autre',
    transaction: TRANSACTIONS[b.transaction] ? b.transaction : 'vente',
    statut,
    publie,
    type: TYPES.includes(b.type) ? b.type : 'Maison',
    ref: str(b.ref, 30),
    prix: numStr(b.prix, 30),
    surface: numStr(b.surface),
    terrain: numStr(b.terrain),
    pieces: numStr(b.pieces, 10),
    chambres: numStr(b.chambres, 10),
    sdb: numStr(b.sdb, 10),
    sde: numStr(b.sde, 10),
    niveaux: numStr(b.niveaux, 10),
    annee: numStr(b.annee, 10),
    cuisine: str(b.cuisine, 60),
    chauffage: str(b.chauffage, 120),
    extra: str(b.extra, 40),
    badge: BADGES.includes(b.badge) ? b.badge : '',
    description: str(b.description, 6000),
    equipements: strList(b.equipements, 30, 40),
    composition: cleanComposition(b.composition),
    photos,
    photo: photos[0] || '',
    dpe: LETTRES.includes(b.dpe) ? b.dpe : '',
    dpeKwh: numStr(b.dpeKwh, 10),
    ges: LETTRES.includes(b.ges) ? b.ges : '',
    gesCo2: numStr(b.gesCo2, 10),
    energieMin: numStr(b.energieMin),
    energieMax: numStr(b.energieMax),
    energieRef: numStr(b.energieRef, 10),
    visiteVirtuelle: cleanUrl(b.visiteVirtuelle),
    video: cleanUrl(b.video),
    quartier: cleanQuartier(b.quartier),
    // Traductions facultatives (le français sert de repli)
    titreEn: str(b.titreEn), titreDe: str(b.titreDe),
    descriptionEn: str(b.descriptionEn, 6000), descriptionDe: str(b.descriptionDe, 6000),
    negociateurId: str(b.negociateurId, 60),
    // Suivi interne de la vente (jamais publié)
    etapeVente: ETAPES[b.etapeVente] !== undefined ? b.etapeVente : '',
    dateCompromis: /^\d{4}-\d{2}-\d{2}$/.test(b.dateCompromis || '') ? b.dateCompromis : '',
    dateActe: /^\d{4}-\d{2}-\d{2}$/.test(b.dateActe || '') ? b.dateActe : '',
    acquereurId: str(b.acquereurId, 60),
    honoraires: str(b.honoraires, 200),
    taxeFonciere: numStr(b.taxeFonciere),
    chargesCopro: numStr(b.chargesCopro),
    lotsCopro: numStr(b.lotsCopro, 10),
    // Champs réservés à la synchronisation avec un logiciel externe (voir docs/API.md)
    externalRef: str(b.externalRef ?? previous?.externalRef, 80),
    source: ['manuel', 'api'].includes(b.source) ? b.source : previous?.source || 'manuel',
    createdAt: previous?.createdAt || b.createdAt || now,
    updatedAt: now,
    publishedAt: publie ? (previous?.publishedAt || b.publishedAt || now) : (previous?.publishedAt || b.publishedAt || null),
  };
}

export async function readBiens() {
  const list = await readJSON(KEY, []);
  return list.map(b => ({ ...b, statut: legacyStatut(b), publie: b.publie === undefined ? true : b.publie }));
}

export async function readBiensWithEtag() {
  return readJSONWithEtag(KEY, []);
}

export async function writeBiens(list, etag) {
  const ids = new Set();
  list.forEach(b => {
    if (!b.id || ids.has(b.id)) b.id = `${slug(b.ville)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    ids.add(b.id);
  });
  await writeJSON(KEY, list, { ifMatch: etag });
  return list;
}

export const slug = (s) => String(s || 'bien').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'bien';

// Version publique : biens publiés uniquement, sans les champs internes
const PRIVATE_FIELDS = ['adresse', 'externalRef', 'source', 'createdAt', 'updatedAt', 'negociateurId', 'etapeVente', 'dateCompromis', 'dateActe', 'acquereurId', 'createdBy', 'updatedBy', 'mandatId'];
export function publicBien(b) {
  const out = { ...b, statutLabel: STATUTS[b.statut], vendu: b.statut === 'vendu' || b.statut === 'loue' };
  PRIVATE_FIELDS.forEach(k => delete out[k]);
  return out;
}
export const publicBiens = (list) => list.filter(b => b.publie).map(publicBien);
