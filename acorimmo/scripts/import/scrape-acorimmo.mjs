// Relève les annonces publiées sur le site actuel de l'agence (acorimmo.fr, plateforme Bexter/Lesty)
// et produit un fichier JSON au format des biens du site (voir lib/biens.js), photos encore distantes.
// Rien n'est inventé : un champ absent de l'annonce d'origine reste vide.
//
// Usage : node scripts/import/scrape-acorimmo.mjs [--cache=dossier] [--out=fichier.json]
//   --cache : dossier où conserver les pages téléchargées (évite de les retélécharger)
// Étape suivante : node scripts/import/import-annonces.mjs (photos redimensionnées + écriture dans le stockage)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = 'https://www.acorimmo.fr';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const CACHE = args.cache || '';
const OUT = args.out || new URL('./annonces-acorimmo.json', import.meta.url).pathname;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Le site est servi en Windows-1252 (TextDecoder de Node le traite comme du Latin-1 : on corrige 0x80–0x9F)
const CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
const decodePage = (buf) => [...buf].map(b => (b >= 0x80 && b <= 0x9f ? CP1252[b - 0x80] : String.fromCharCode(b))).join('');
async function fetchPage(url, cacheName) {
  const file = CACHE && cacheName ? join(CACHE, cacheName) : '';
  if (file) { try { return decodePage(await readFile(file)); } catch {} }
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (import annonces)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (file) { await mkdir(CACHE, { recursive: true }); await writeFile(file, buf); }
      await sleep(300);
      return decodePage(buf);
    } catch (e) {
      if (i === 3) throw new Error(`${url} : ${e.message}`);
      await sleep(2000 * (i + 1));
    }
  }
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê', sup2: '²', euro: '€', rsquo: '’', hellip: '…', ocirc: 'ô', ucirc: 'û', icirc: 'î', acirc: 'â' };
const decode = (s) => String(s).replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENT[e] ?? m));
const text = (html) => decode(String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').trim();
// Premier nombre du texte ("195.2 m2" → 195.2, "1 300 000 €" → 1300000), sans l'unité
const firstNum = (s) => Number((String(s ?? '').match(/\d[\d \u00a0\u202f]*(?:[.,]\d+)?/)?.[0] || '').replace(/[ \u00a0\u202f]/g, '').replace(',', '.')) || 0;
const digits = (s) => String(firstNum(s) || '');
// 1300000 → "1 300 000" ; 49.9 → "49,9" (format des saisies de l'admin)
const frNum = (s) => {
  const n = firstNum(s);
  if (!n) return '';
  return Number.isInteger(n) ? n.toLocaleString('fr-FR').replace(/ /g, ' ') : String(n).replace('.', ',');
};

// 1. Liste des annonces (vente puis location à l'année ; les locations saisonnières, au prix par nuit, ne sont pas reprises)
async function collectUrls(listPath, kind) {
  const urls = new Map();
  for (let p = 0; p < 40; p++) {
    const html = await fetchPage(`${BASE}${listPath}?page=${p}`, `${kind}-list-${p}.html`);
    const found = [...html.matchAll(new RegExp(`https://www\\.acorimmo\\.fr/${kind}/[^"]*/([^"/]+)\\.htm`, 'g'))];
    let added = 0;
    for (const [url, id] of found) if (!urls.has(id) && !/\/\//.test(url.slice(8))) { urls.set(id, url); added++; }
    const total = Number(html.match(/(\d+) annonces/)?.[1] || 0);
    if (!added || (total && urls.size >= total)) break;
  }
  return [...urls.entries()];
}

const TYPE_URL = { appartement: 'Appartement', terrain: 'Terrain', immeuble: 'Immeuble', 'local-commercial': 'Local commercial', bureau: 'Local commercial', garage: 'Parking', 'fonds-de-commerce': 'Autre' };

function parseListing(html, url, id, transaction) {
  const h1 = text(html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] || '');
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(m => { try { return [].concat(JSON.parse(m[1])); } catch { return []; } });
  const listing = ld.find(x => x['@type'] === 'RealEstateListing') || {};
  const addr = listing.offers?.itemOffered?.address || listing.address || {};
  const spec = Object.fromEntries([...html.matchAll(/champsSPEC-element">([^<]*)<\/div><div class="champsSPEC-value">([^<]*)</g)].map(m => [decode(m[1]).trim(), decode(m[2]).trim()]));
  const fin = Object.fromEntries([...html.matchAll(/financierGrasStd'>([^<]*?)\s*:\s*<\/span>\s*([^<]*)</g)].map(m => [decode(m[1]).trim(), decode(m[2]).trim()]));

  // Description : texte publié, sans le bloc financier (repris dans les champs dédiés) ni les lignes parasites ("2.16.1.2")
  const rawDesc = html.match(/<div id="texte-detail">([\s\S]*?)<\/div>\s*<div id="prix-immobilier-detail">/)?.[1] || '';
  const description = text(rawDesc.split('<span class="financierStd">')[0]).split('\n').filter(l => !/^[\d.]+$/.test(l.trim())).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const prixBloc = html.match(/<div id="prix-immobilier-detail">([\s\S]*?)<\/div>\s*<\/div>/)?.[1] || '';
  const prix = frNum(text(prixBloc.split('<div')[0]));
  const fraisAgence = text(prixBloc.match(/class="fraisagence"><small>([\s\S]*?)<\/small>/)?.[1] || '');

  const catKey = Object.keys(TYPE_URL).find(k => url.split('/')[4]?.startsWith(k)) || (url.split('/')[4]?.startsWith('maison-villa') ? 'maison-villa' : '');
  let type = TYPE_URL[catKey] || (catKey === 'maison-villa' ? (/villa/i.test(h1) ? 'Villa' : 'Maison') : 'Autre');
  // Places de parking classées « maison » sur le site d'origine
  const logement = /\b([TF]\d|studio|appartement|maison|villa|duplex)\b/i.test(h1);
  if (/^\s*(parking|garage|box)\b/i.test(h1) || (!logement && /(place|emplacement) de (parking|stationnement)/i.test(h1))) type = 'Parking';

  const flags = [...html.matchAll(/images-fr\/flag-([a-z-]+)\.png/g)].map(m => m[1]);
  let statut = 'disponible', etapeVente = '';
  if (flags.includes('vendu')) statut = transaction === 'location' ? 'loue' : 'vendu';
  else if (flags.includes('loue')) statut = 'loue';
  else if (flags.includes('compromis')) { statut = 'sous-compromis'; etapeVente = 'compromis'; }
  else if (flags.includes('offre-recue')) etapeVente = 'offre';

  const yes = (k) => /^oui$/i.test(spec[k] || '');
  const count = (k) => Number(digits(spec[k])) || 0;
  const equipements = [
    yes('Ascenseur') && 'Ascenseur', yes('Terrasse') && 'Terrasse', yes('Piscine') && 'Piscine', yes('Meublé') && 'Meublé',
    count('Nombre de balcons') && (count('Nombre de balcons') > 1 ? `${count('Nombre de balcons')} balcons` : 'Balcon'),
    count('Nombre de garage') && 'Garage',
    count('Nombre de parking intérieurs') && 'Parking intérieur', count('Nombre de parking extérieurs') && 'Parking extérieur',
  ].filter(Boolean); // l'étage et le secteur ne sont pas des équipements (ils pollueraient le filtre « Équipements »)

  const dpe = html.match(/dpe\/images-fr\/dpe-([A-G])\.jpg/)?.[1] || '';
  const ges = html.match(/dpe\/images-fr\/ges-([A-G])\.jpg/)?.[1] || '';
  const val = (re) => frNum(html.match(re)?.[1]);

  const photos = [...new Set([...html.matchAll(/https:\/\/www\.acorimmo\.fr\/photos\/biens\/[\w-]+-(\d+)\/[\w.-]+\.(?:jpe?g|png|webp)/gi)].map(m => m[0]))]
    .sort((a, b) => Number(a.match(/-(\d+)\//)[1]) - Number(b.match(/-(\d+)\//)[1]));
  const visite = html.match(/https:\/\/player\.previsite\.net\/video\/[\w-]+/)?.[0] || '';

  // Honoraires : seulement ce que l'annonce affiche
  let honoraires = '';
  if (/honoraires charge vendeur/i.test(fraisAgence)) honoraires = 'Honoraires à la charge du vendeur.';
  else if (fraisAgence) honoraires = fraisAgence;
  const honoLoc = description.match(/Honoraires[^\n]{0,160}/i)?.[0];
  if (transaction === 'location' && honoLoc) honoraires = honoLoc.trim();

  const chauffage = [spec['Type de chauffage'], spec['Mode de chauffage'], spec['Nature de chauffage']].filter(Boolean).map(s => (s.charAt(0) + s.slice(1).toLowerCase()).replace(/_/g, ' ')).join(', ');
  const [lieuVille, lieuCp] = text(html.match(/<div id="lieu-detail">([\s\S]*?)<\/div>/)?.[1] || '').split(/\s+-\s*/);
  let ville = addr.addressLocality || (lieuVille || '').replace(/^-$/, '');
  const cp = addr.postalCode || (/^\d{5}$/.test(lieuCp || '') ? lieuCp : '');
  // Une annonce sans commune renseignée : on reprend celle de son titre et on la signale
  let note = '';
  if (!ville && /la seyne/i.test(h1)) { ville = 'La Seyne-sur-Mer'; note = 'Commune absente de l’annonce d’origine, reprise du titre.'; }
  const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return {
    id: `${slug(ville)}-${slug(id)}`.slice(0, 60),
    titre: h1.slice(0, 120),
    ville, cp,
    region: /^83/.test(cp) ? 'var' : 'autre',
    transaction, statut, publie: true, type,
    ref: id,
    prix,
    // Un terrain n'a pas de surface habitable (le site d'origine recopie la surface du terrain)
    surface: type === 'Terrain' && spec['Surface habitable'] === spec['Surface terrain'] ? '' : frNum(spec['Surface habitable'] || fin['Surface habitable']),
    terrain: frNum(spec['Surface terrain']),
    pieces: frNum(spec['Nombre de pièces']),
    chambres: frNum(spec['Nombre de chambres']),
    sdb: frNum(spec['Nombre de salles de bains']),
    sde: frNum(spec["Nombre de salles d'eau"]),
    annee: digits(spec['Année de construction']),
    cuisine: (spec['Type de cuisine'] || '').replace(/\s*-\s*/g, ', ').toLowerCase().replace(/^./, c => c.toUpperCase()),
    chauffage,
    extra: yes('Piscine') ? 'Piscine' : yes('Terrasse') ? 'Terrasse' : '',
    badge: flags.includes('exclu') ? 'Exclusivité' : '',
    description,
    equipements,
    dpe, dpeKwh: val(/id="valeur-dpe"[^>]*>\s*([\d.,]+)/), ges, gesCo2: val(/id="valeur-ges"[^>]*>\s*([\d.,]+)/),
    visiteVirtuelle: visite,
    honoraires,
    taxeFonciere: frNum(fin['Taxe foncière']),
    // Le site d'origine affiche des charges MENSUELLES ; le site les attend par an (×12)
    chargesCopro: firstNum(fin['Charges mensuelles']) ? frNum(String(Math.round(firstNum(fin['Charges mensuelles']) * 12))) : '',
    etapeVente,
    externalRef: `acorimmo-${id}`,
    source: 'api',
    // Champs d'import (non enregistrés tels quels) : photos d'origine et adresse de l'annonce
    _photosSource: photos,
    _url: url,
    _note: note,
  };
}

const vente = await collectUrls('/fr/acheter-biens-immobiliers.htm', 'vente-achat');
const location = await collectUrls('/fr/locations-biens-immobiliers.htm', 'location');
console.log(`Annonces trouvées : ${vente.length} en vente, ${location.length} en location`);
const out = [];
for (const [list, transaction, kind] of [[vente, 'vente', 'vente-achat'], [location, 'location', 'location']]) {
  for (const [id, url] of list) {
    const html = await fetchPage(url, `${kind}-${id}.html`);
    out.push(parseListing(html, url, id, transaction));
  }
}
await writeFile(OUT, JSON.stringify({ source: BASE, releveLe: new Date().toISOString().slice(0, 10), biens: out }, null, 1));
console.log(`${out.length} annonces écrites dans ${OUT}`);
