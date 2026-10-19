// CRM : contacts, tâches, mandats, rapprochement acquéreurs/biens, modèles d'e-mails, rapports.
// Stockage : un fichier JSON par ensemble (suffisant pour une agence ; au-delà de quelques milliers de contacts, passer à une base).
import { randomBytes } from 'node:crypto';
import { readJSON, updateJSON } from './storage.js';
import { HttpError } from './http.js';
import { validEmail, normPhone, TYPES as LEAD_TYPES, STATUSES } from './leads.js';
import { toNumber } from './biens.js';
import agence from '../config/agence.js';

const CK = 'crm/contacts.json', TK = 'crm/tasks.json', MK = 'crm/mandats.json', EK = 'crm/modeles.json';
const str = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const id = (p) => `${p}${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
const now = () => new Date().toISOString();
const PHONE_RE = /^(\+33|0033|0)[1-9]\d{8}$|^\+\d{8,15}$/;

export const CONTACT_TYPES = { acquereur: 'Acquéreur', vendeur: 'Vendeur', locataire: 'Locataire', proprietaire: 'Propriétaire bailleur', autre: 'Autre' };
const LEAD_TO_TYPE = { achat: 'acquereur', visite: 'acquereur', alerte: 'acquereur', location: 'locataire', estimation: 'vendeur', gestion: 'proprietaire' };

// ---------- Contacts ----------
export const readContacts = () => readJSON(CK, []);

function cleanCriteres(c = {}) {
  const n = (v) => str(v, 12).replace(/[^\d]/g, '');
  return {
    transaction: c.transaction === 'location' ? 'location' : 'vente',
    types: (Array.isArray(c.types) ? c.types : []).map(t => str(t, 40)).filter(Boolean).slice(0, 8),
    villes: (Array.isArray(c.villes) ? c.villes : []).map(t => str(t, 60)).filter(Boolean).slice(0, 12),
    budgetMax: n(c.budgetMax), surfaceMin: n(c.surfaceMin), chambresMin: n(c.chambresMin),
  };
}

export function sanitizeContact(input, prev = null) {
  const nom = str(input.nom, 100);
  const email = str(input.email, 160).toLowerCase();
  const tel = normPhone(str(input.tel, 30));
  if (nom.length < 2) throw new HttpError(400, 'Le nom est obligatoire');
  if (email && !validEmail(email)) throw new HttpError(400, 'Adresse e-mail invalide');
  if (tel && !PHONE_RE.test(tel)) throw new HttpError(400, 'Numéro de téléphone invalide');
  if (!email && !tel) throw new HttpError(400, 'Indiquez au moins un e-mail ou un téléphone');
  const types = (Array.isArray(input.types) ? input.types : []).filter(t => CONTACT_TYPES[t]);
  return {
    id: prev?.id || id('C'),
    nom, email, tel,
    types,
    negociateurId: str(input.negociateurId, 60),
    origine: str(input.origine ?? prev?.origine, 60),
    criteres: input.criteres ? cleanCriteres(input.criteres) : prev?.criteres || null,
    alertes: Boolean(input.alertes ?? prev?.alertes),
    // Preuve du consentement : date + provenance. Un contact importé n'a PAS donné son accord pour les alertes.
    consentement: prev?.consentement || input.consentement || null,
    leadIds: prev?.leadIds || [],
    notes: prev?.notes || [],
    createdAt: prev?.createdAt || now(),
    updatedAt: now(),
    derniereInteraction: prev?.derniereInteraction || now(),
  };
}

export async function listContacts() { return (await readContacts()).sort((a, b) => b.derniereInteraction.localeCompare(a.derniereInteraction)); }

// Une demande du site crée ou enrichit la fiche contact (rapprochement par e-mail, sinon téléphone)
export async function upsertFromLead(lead) {
  let contactId = null;
  await updateJSON(CK, [], (list) => {
    let c = list.find(x => (lead.email && x.email === lead.email) || (lead.tel && x.tel === lead.tel));
    const t = LEAD_TO_TYPE[lead.type];
    if (!c) {
      c = { id: id('C'), nom: lead.nom || lead.email || 'Contact', email: lead.email || '', tel: lead.tel || '', types: [], negociateurId: '', origine: lead.origine || 'site', criteres: null, alertes: false, consentement: null, leadIds: [], notes: [], createdAt: now(), updatedAt: now(), derniereInteraction: now() };
      list.push(c);
    }
    if (lead.nom && (!c.nom || c.nom === c.email)) c.nom = lead.nom;
    if (!c.email && lead.email) c.email = lead.email;
    if (!c.tel && lead.tel) c.tel = lead.tel;
    if (t && !c.types.includes(t)) c.types.push(t);
    c.leadIds = [...new Set([...c.leadIds, lead.id])];
    c.consentement = lead.consent || c.consentement;
    if (lead.type === 'alerte') {
      c.alertes = true;
      c.criteres = cleanCriteres({ transaction: lead.details?.transaction, types: lead.details?.typeBien && lead.details.typeBien !== 'Tous' ? [lead.details.typeBien] : [], villes: lead.details?.ville ? [lead.details.ville] : [], budgetMax: lead.details?.budgetMax, surfaceMin: lead.details?.surfaceMin });
    }
    c.derniereInteraction = now();
    c.updatedAt = now();
    contactId = c.id;
    return list;
  });
  return contactId;
}

export async function saveContact(input, existingId = null) {
  let out;
  await updateJSON(CK, [], (list) => {
    const i = existingId ? list.findIndex(c => c.id === existingId) : -1;
    if (existingId && i < 0) throw new HttpError(404, 'Contact introuvable');
    const c = sanitizeContact(input, i >= 0 ? list[i] : null);
    const dup = list.find(x => x.id !== c.id && ((c.email && x.email === c.email) || (c.tel && x.tel === c.tel)));
    if (dup) throw new HttpError(409, `Ce contact existe déjà : ${dup.nom}. Utilisez « Fusionner » si ce sont deux fiches de la même personne.`);
    if (i >= 0) list[i] = c; else list.push(c);
    out = c;
    return list;
  });
  return out;
}

export async function addContactNote(cid, by, text) {
  const t = str(text, 2000);
  if (!t) throw new HttpError(400, 'Note vide');
  let out;
  await updateJSON(CK, [], (list) => {
    const c = list.find(x => x.id === cid);
    if (!c) throw new HttpError(404, 'Contact introuvable');
    c.notes.push({ at: now(), by, text: t });
    c.derniereInteraction = now();
    out = c;
    return list;
  });
  return out;
}

export async function mergeContacts(keepId, dropId) {
  if (keepId === dropId) throw new HttpError(400, 'Choisissez deux fiches différentes');
  let out;
  await updateJSON(CK, [], (list) => {
    const a = list.find(c => c.id === keepId), b = list.find(c => c.id === dropId);
    if (!a || !b) throw new HttpError(404, 'Contact introuvable');
    a.email ||= b.email; a.tel ||= b.tel;
    a.types = [...new Set([...a.types, ...b.types])];
    a.leadIds = [...new Set([...a.leadIds, ...b.leadIds])];
    a.notes = [...a.notes, ...b.notes].sort((x, y) => x.at.localeCompare(y.at));
    a.criteres ||= b.criteres; a.alertes = a.alertes || b.alertes; a.consentement ||= b.consentement;
    a.derniereInteraction = [a.derniereInteraction, b.derniereInteraction].sort().pop();
    out = a;
    return list.filter(c => c.id !== dropId);
  });
  // Les tâches et mandats du doublon sont rattachés à la fiche conservée
  await updateJSON(TK, [], (t) => t.map(x => (x.contactId === dropId ? { ...x, contactId: keepId } : x)));
  await updateJSON(MK, [], (m) => m.map(x => (x.contactId === dropId ? { ...x, contactId: keepId } : x)));
  return out;
}

// Droit à l'effacement : la fiche et ses tâches sont supprimées (les mandats signés sont conservés : obligation légale, le contact y est anonymisé)
export async function deleteContact(cid) {
  let removed;
  await updateJSON(CK, [], (list) => { removed = list.find(c => c.id === cid); if (!removed) throw new HttpError(404, 'Contact introuvable'); return list.filter(c => c.id !== cid); });
  await updateJSON(TK, [], (t) => t.filter(x => x.contactId !== cid));
  await updateJSON(MK, [], (m) => m.map(x => (x.contactId === cid ? { ...x, contactId: '', mandantNom: x.mandantNom ? 'Contact supprimé (RGPD)' : '' } : x)));
  return removed;
}

export async function purgeOldContacts(months) {
  const limit = new Date(); limit.setMonth(limit.getMonth() - months);
  const mandats = await readJSON(MK, []);
  const keep = new Set(mandats.filter(m => m.statut === 'actif').map(m => m.contactId));
  let removed = [];
  await updateJSON(CK, [], (list) => { removed = list.filter(c => new Date(c.derniereInteraction) < limit && !keep.has(c.id)); return list.filter(c => !removed.includes(c)); });
  return removed.length;
}

// ---------- Import / export CSV ----------
const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
export function contactsCSV(list) {
  const head = ['Nom', 'E-mail', 'Téléphone', 'Types', 'Origine', 'Alertes e-mail', 'Dernière interaction'];
  const rows = list.map(c => [c.nom, c.email, c.tel, c.types.map(t => CONTACT_TYPES[t]).join(' / '), c.origine, c.alertes ? 'oui' : 'non', c.derniereInteraction.slice(0, 10)]);
  return '﻿' + [head, ...rows].map(r => r.map(cell).join(';')).join('\r\n');
}

export function parseCSV(text) {
  const t = String(text).replace(/^﻿/, '');
  const sep = (t.split('\n')[0].match(/;/g) || []).length >= (t.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

export async function importContacts(text, by) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new HttpError(400, 'Fichier vide : la première ligne doit contenir les en-têtes (nom;email;telephone;type)');
  if (rows.length > 2001) throw new HttpError(400, '2 000 contacts maximum par import');
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  const h = rows[0].map(norm);
  const col = (...names) => h.findIndex(x => names.includes(x));
  const ci = { nom: col('nom', 'name', 'nomprenom'), email: col('email', 'mail', 'courriel'), tel: col('telephone', 'tel', 'mobile', 'phone'), type: col('type', 'types') };
  if (ci.nom < 0 || (ci.email < 0 && ci.tel < 0)) throw new HttpError(400, 'Colonnes attendues : nom, email et/ou telephone (type facultatif)');
  const byLabel = Object.fromEntries(Object.entries(CONTACT_TYPES).flatMap(([k, v]) => [[norm(k), k], [norm(v), k]]));
  const report = { crees: 0, ignores: [] };
  await updateJSON(CK, [], (list) => {
    rows.slice(1).forEach((r, n) => {
      try {
        const types = (r[ci.type] || '').split(/[/|,]/).map(x => byLabel[norm(x)]).filter(Boolean);
        const c = sanitizeContact({ nom: r[ci.nom], email: ci.email >= 0 ? r[ci.email] : '', tel: ci.tel >= 0 ? r[ci.tel] : '', types, origine: 'import' });
        if (list.some(x => (c.email && x.email === c.email) || (c.tel && x.tel === c.tel))) { report.ignores.push(`Ligne ${n + 2} : déjà présent`); return; }
        c.consentement = { at: now(), text: `Importé par ${by} : consentement non vérifié` };
        list.push(c); report.crees++;
      } catch (e) { report.ignores.push(`Ligne ${n + 2} : ${e.message}`); }
    });
    return list;
  });
  return report;
}

// ---------- Tâches et rappels ----------
export const readTasks = () => readJSON(TK, []);

export function sanitizeTask(input, prev = null) {
  const titre = str(input.titre, 160);
  if (!titre) throw new HttpError(400, 'Le titre est obligatoire');
  const echeance = str(input.echeance, 10);
  if (echeance && !/^\d{4}-\d{2}-\d{2}$/.test(echeance)) throw new HttpError(400, 'Date au format AAAA-MM-JJ');
  return {
    id: prev?.id || id('T'), titre, echeance,
    contactId: str(input.contactId ?? prev?.contactId, 60), leadId: str(input.leadId ?? prev?.leadId, 40), bienId: str(input.bienId ?? prev?.bienId, 60),
    assigneId: str(input.assigneId, 60), note: str(input.note, 1000),
    fait: Boolean(input.fait ?? prev?.fait), faitLe: prev?.faitLe || null,
    createdAt: prev?.createdAt || now(), createdBy: prev?.createdBy || str(input.createdBy, 80),
  };
}

export async function saveTask(input, existingId = null) {
  let out;
  await updateJSON(TK, [], (list) => {
    const i = existingId ? list.findIndex(t => t.id === existingId) : -1;
    if (existingId && i < 0) throw new HttpError(404, 'Tâche introuvable');
    const prev = i >= 0 ? list[i] : null;
    const t = sanitizeTask(input, prev);
    if (t.fait && !prev?.fait) t.faitLe = now();
    if (!t.fait) t.faitLe = null;
    if (i >= 0) list[i] = t; else list.push(t);
    out = t;
    return list;
  });
  return out;
}
export const deleteTask = (tid) => updateJSON(TK, [], (l) => l.filter(t => t.id !== tid));

// ---------- Mandats ----------
// Registre interne d'aide au suivi (numérotation continue, aucune suppression : un mandat annulé reste dans la liste).
// Il ne remplace pas le registre des mandats réglementaire tenu par l'agence : à valider avec son conseil / sa CCI.
export const MANDAT_TYPES = { simple: 'Simple', exclusif: 'Exclusif', 'semi-exclusif': 'Semi-exclusif', recherche: 'De recherche (acquéreur)' };
export const MANDAT_STATUTS = { actif: 'En cours', vendu: 'Réalisé (vendu / loué)', expire: 'Expiré', annule: 'Annulé' };
export const readMandats = () => readJSON(MK, []);

function cleanDate(v, label, required = false) {
  const s = str(v, 10);
  if (!s && !required) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, `${label} : date au format AAAA-MM-JJ`);
  return s;
}

export async function saveMandat(input, by, existingId = null) {
  let out;
  await updateJSON(MK, [], (list) => {
    const i = existingId ? list.findIndex(m => m.id === existingId) : -1;
    if (existingId && i < 0) throw new HttpError(404, 'Mandat introuvable');
    const prev = i >= 0 ? list[i] : null;
    if (!MANDAT_TYPES[input.type]) throw new HttpError(400, 'Type de mandat invalide');
    const statut = MANDAT_STATUTS[input.statut] ? input.statut : prev?.statut || 'actif';
    const debut = cleanDate(input.dateSignature, 'Date de signature', true);
    const fin = cleanDate(input.dateFin, 'Date de fin');
    if (fin && fin < debut) throw new HttpError(400, 'La date de fin précède la date de signature');
    const year = debut.slice(0, 4);
    const seq = prev?.numero || `M-${year}-${String(Math.max(0, ...list.filter(m => m.numero.startsWith(`M-${year}-`)).map(m => Number(m.numero.slice(-4)))) + 1).padStart(4, '0')}`;
    const m = {
      id: prev?.id || id('M'), numero: seq, type: input.type, statut,
      bienId: str(input.bienId, 60), contactId: str(input.contactId, 60), mandantNom: str(input.mandantNom ?? prev?.mandantNom, 100),
      dateSignature: debut, dateFin: fin,
      prix: str(input.prix, 20).replace(/[^\d\s,.]/g, ''), honoraires: str(input.honoraires, 120), note: str(input.note, 1000),
      createdAt: prev?.createdAt || now(), createdBy: prev?.createdBy || by, updatedAt: now(), updatedBy: by,
    };
    if (i >= 0) list[i] = m; else list.push(m);
    out = m;
    return list;
  });
  return out;
}

export const mandatsToExpire = (mandats, days = 30) => {
  const limit = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10), today = now().slice(0, 10);
  return mandats.filter(m => m.statut === 'actif' && m.dateFin && m.dateFin <= limit).map(m => ({ ...m, expire: m.dateFin < today }));
};

// ---------- Rapprochement acquéreurs ↔ biens ----------
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function bienMatchesCriteres(b, c) {
  if (!c || b.publie === false || b.statut !== 'disponible') return false;
  if ((b.transaction || 'vente') !== (c.transaction || 'vente')) return false;
  if (c.types?.length && !c.types.some(t => t.split('|').includes(b.type))) return false;
  if (c.villes?.length && !c.villes.some(v => norm(b.ville).includes(norm(v)))) return false;
  if (c.budgetMax && toNumber(b.prix) && toNumber(b.prix) > Number(c.budgetMax)) return false;
  if (c.surfaceMin && toNumber(b.surface) < Number(c.surfaceMin)) return false;
  if (c.chambresMin && toNumber(b.chambres) < Number(c.chambresMin)) return false;
  return true;
}
export const contactsForBien = (b, contacts) => contacts.filter(c => c.criteres && bienMatchesCriteres(b, c.criteres));
export const biensForContact = (c, biens) => biens.filter(b => bienMatchesCriteres(b, c.criteres));

// ---------- Modèles d'e-mails ----------
export const DEFAULT_MODELES = [
  { id: 'accuse', nom: 'Accusé de réception', objet: 'Votre demande – {{agence}}', corps: 'Bonjour {{nom}},\n\nNous avons bien reçu votre demande et nous revenons vers vous très rapidement.\n\nCordialement,\n{{signature}}' },
  { id: 'visite', nom: 'Confirmation de visite', objet: 'Votre visite – {{bien}}', corps: 'Bonjour {{nom}},\n\nNous vous confirmons la visite de « {{bien}} ».\nN’hésitez pas à nous appeler en cas d’empêchement.\n\nCordialement,\n{{signature}}' },
  { id: 'relance', nom: 'Relance après visite', objet: '{{bien}} – votre avis', corps: 'Bonjour {{nom}},\n\nSuite à votre visite de « {{bien}} », souhaitez-vous que nous en reparlions ? Je reste disponible pour répondre à vos questions.\n\nCordialement,\n{{signature}}' },
  { id: 'estimation', nom: 'Suite à une estimation', objet: 'Votre projet de vente – {{agence}}', corps: 'Bonjour {{nom}},\n\nMerci de nous avoir confié votre demande d’estimation. Je vous propose de convenir d’un rendez-vous sur place pour établir un avis de valeur précis.\n\nCordialement,\n{{signature}}' },
];
export const readModeles = async () => { const saved = await readJSON(EK, null); return saved || DEFAULT_MODELES; };
export const writeModeles = (list) => {
  if (!Array.isArray(list) || list.length > 30) throw new HttpError(400, 'Liste de modèles invalide');
  const clean = list.map((m, i) => ({ id: str(m.id, 30) || `m${i}`, nom: str(m.nom, 60), objet: str(m.objet, 160), corps: str(m.corps, 4000) })).filter(m => m.nom && m.objet && m.corps);
  return updateJSON(EK, [], () => clean);
};
export const renderModele = (m, vars) => {
  const f = (s) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '');
  return { objet: f(m.objet), corps: f(m.corps) };
};

// ---------- Rapports ----------
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function buildReport({ leads, biens, users, audience, days = 90 }) {
  const since = Date.now() - days * 864e5;
  const L = leads.filter(l => new Date(l.createdAt) >= since);
  const gagne = L.filter(l => l.issue === 'gagne'), perdu = L.filter(l => l.issue === 'perdu');
  const funnel = [
    ['Demandes reçues', L.length],
    ['Contactées', L.filter(l => l.status !== 'nouveau').length],
    ['Rendez-vous', L.filter(l => l.status === 'rendezvous' || l.issue || l.history.some(h => h.action === `Statut : ${STATUSES.rendezvous}`)).length],
    ['Gagnées', gagne.length],
    ['Perdues', perdu.length],
  ];
  // Délai de première réponse = premier changement de statut après la réception
  const delays = L.map(l => { const h = l.history.find(x => /^Statut/.test(x.action || '')); return h ? (new Date(h.at) - new Date(l.createdAt)) / 36e5 : null; }).filter(x => x !== null);
  const bySource = {};
  for (const l of L) { const k = l.origine || 'Accès direct / inconnu'; bySource[k] = bySource[k] || { total: 0, gagne: 0 }; bySource[k].total++; if (l.issue === 'gagne') bySource[k].gagne++; }
  const byType = {};
  for (const l of L) byType[LEAD_TYPES[l.type]] = (byType[LEAD_TYPES[l.type]] || 0) + 1;
  const uname = Object.fromEntries(users.map(u => [u.id, u.name]));
  const byNego = {};
  for (const l of L) { const k = uname[l.assigneId] || 'Non assigné'; byNego[k] = byNego[k] || { total: 0, gagne: 0, nouveau: 0 }; byNego[k].total++; if (l.issue === 'gagne') byNego[k].gagne++; if (l.status === 'nouveau') byNego[k].nouveau++; }
  // Pages vues par bien (mesure d'audience) face aux demandes reçues pour ce bien
  const demandesParBien = {};
  for (const l of L) if (l.bienId) demandesParBien[l.bienId] = (demandesParBien[l.bienId] || 0) + 1;
  const vues = audience?.biens || {};
  const biensStats = biens.filter(b => b.publie).map(b => ({ id: b.id, titre: b.titre, ville: b.ville, vues: vues[b.id] || 0, demandes: demandesParBien[b.id] || 0 })).sort((a, b) => b.vues - a.vues).slice(0, 15);
  return {
    jours: days, funnel, delaiMedianHeures: median(delays) === null ? null : Math.round(median(delays) * 10) / 10,
    sources: Object.entries(bySource).sort((a, b) => b[1].total - a[1].total).map(([source, v]) => ({ source, ...v })),
    types: byType, negociateurs: Object.entries(byNego).map(([nom, v]) => ({ nom, ...v })),
    biens: biensStats, audience: audience ? { total: audience.total, langs: audience.langs, refs: audience.refs } : null,
  };
}
