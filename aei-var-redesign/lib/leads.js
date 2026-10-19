// Demandes clients (contact, estimation, visite, alertes…)
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readJSON, writeJSON, listKeys, readMany, removeKeys, updateJSON } from './storage.js';
import { HttpError } from './http.js';

export const TYPES = {
  contact: 'Contact',
  estimation: 'Estimation',
  visite: 'Demande de visite',
  achat: 'Projet d’achat',
  location: 'Projet de location',
  gestion: 'Gestion locative',
  rendezvous: 'Rendez-vous',
  alerte: 'Alerte e-mail',
};
export const STATUSES = { nouveau: 'Nouveau', contacte: 'Contacté', rendezvous: 'Rendez-vous', termine: 'Terminé' };

// Texte du consentement enregistré avec chaque demande (preuve RGPD)
export const CONSENT_TEXT = 'J’accepte que mes données soient utilisées par l’agence pour traiter ma demande, conformément à la politique de confidentialité.';

const str = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const EMAIL_RE = /^[^\s@<>()[\],;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
export const normPhone = (s) => s.replace(/[\s.\-()]/g, '');
const PHONE_RE = /^(\+33|0033|0)[1-9]\d{8}$|^\+\d{8,15}$/;

export function validEmail(e) { return EMAIL_RE.test(e) && e.length <= 160; }

// Validation côté serveur : la validation du navigateur ne suffit jamais
export function sanitizeLead(input) {
  const type = TYPES[input.type] ? input.type : null;
  if (!type) throw new HttpError(400, 'Type de demande inconnu');
  const errors = {};
  const nom = str(input.nom, 100);
  const email = str(input.email, 160).toLowerCase();
  const tel = normPhone(str(input.tel, 30));

  if (type !== 'alerte' && nom.length < 2) errors.nom = 'Indiquez votre nom';
  if (email && !validEmail(email)) errors.email = 'Adresse e-mail invalide';
  if (tel && !PHONE_RE.test(tel)) errors.tel = 'Numéro de téléphone invalide';
  if (type === 'alerte' && !email) errors.email = 'L’e-mail est obligatoire pour recevoir des alertes';
  if (type !== 'alerte' && !email && !tel) errors.tel = 'Indiquez au moins un téléphone ou un e-mail';
  if (input.consent !== true) errors.consent = 'Votre accord est nécessaire pour traiter la demande';

  const d = input.details && typeof input.details === 'object' ? input.details : {};
  const details = {};
  if (type === 'estimation') {
    details.typeBien = str(d.typeBien, 40);
    details.ville = str(d.ville, 80);
    details.adresse = str(d.adresse, 160);
    details.surface = str(d.surface, 12);
    details.pieces = str(d.pieces, 10);
    details.etat = str(d.etat, 40);
    details.atouts = (Array.isArray(d.atouts) ? d.atouts : []).map(a => str(a, 40)).filter(Boolean).slice(0, 12);
    if (!details.typeBien) errors.typeBien = 'Indiquez le type de bien';
    if (!details.ville) errors.ville = 'Indiquez la ville';
    if (!/^\d{1,5}([.,]\d+)?$/.test(details.surface)) errors.surface = 'Indiquez la surface en m²';
    if (!tel) errors.tel = 'Le téléphone est nécessaire pour organiser la visite d’estimation';
  }
  if (type === 'rendezvous') {
    details.date = str(d.date, 10);
    details.creneau = str(d.creneau, 30);
    details.motif = str(d.motif, 60);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(details.date) || new Date(details.date) < new Date(new Date().toDateString())) errors.date = 'Choisissez une date à venir';
  }
  if (type === 'alerte') {
    details.transaction = ['vente', 'location'].includes(d.transaction) ? d.transaction : 'vente';
    details.ville = str(d.ville, 80);
    details.typeBien = str(d.typeBien, 40);
    details.budgetMax = str(d.budgetMax, 15).replace(/\D/g, '');
    details.surfaceMin = str(d.surfaceMin, 6).replace(/\D/g, '');
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Certains champs sont à corriger', { errors });

  return {
    type,
    nom, email, tel,
    projet: str(input.projet, 60),
    message: str(input.message, 3000),
    bienId: str(input.bienId, 60),
    bienTitre: str(input.bienTitre, 120),
    details,
    source: str(input.source, 80),
    origine: str(input.origine, 60).replace(/[^\w.-]/g, ''),
  };
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = (n) => Array.from(randomBytes(n), b => CODE_CHARS[b % CODE_CHARS.length]).join('');

export function newLeadId(date = new Date()) {
  const d = date.toISOString().replace(/\D/g, '').slice(0, 14);
  return `L${d}${code(4)}`; // triable par date
}

export async function createLead(clean, extra = {}) {
  const now = new Date();
  const lead = {
    id: newLeadId(now),
    code: code(8), // code de suivi communiqué au client
    ...clean,
    status: 'nouveau',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    consent: { at: now.toISOString(), text: CONSENT_TEXT },
    notes: [],
    history: [{ at: now.toISOString(), by: 'client', action: 'Demande reçue' }],
    ...extra,
  };
  if (lead.type === 'alerte') lead.alert = { active: true, token: randomBytes(18).toString('base64url'), lastSentAt: now.toISOString() };
  await writeJSON(`leads/${lead.id}.json`, lead, { ifMatch: null });
  await writeJSON(`tracking/${lead.code}.json`, { id: lead.id }); // index code de suivi → demande
  return lead;
}

export const leadKey = (id) => {
  if (!/^L\d{14}[A-Z2-9]{4}$/.test(id)) throw new HttpError(404, 'Demande introuvable');
  return `leads/${id}.json`;
};

export const readLead = (id) => readJSON(leadKey(id));
export const updateLead = (id, fn) => updateJSON(leadKey(id), null, async (l) => { if (!l) throw new HttpError(404, 'Demande introuvable'); return fn(l); });

export async function listLeads() {
  const keys = (await listKeys('leads/')).map(k => k.key).filter(k => /^leads\/L\d+[A-Z2-9]{4}\.json$/.test(k));
  const leads = await readMany(keys);
  return leads.sort((a, b) => b.id.localeCompare(a.id));
}

export async function deleteLead(id) {
  const lead = await readLead(id);
  if (!lead) throw new HttpError(404, 'Demande introuvable');
  await removeKeys([leadKey(id), `tracking/${lead.code}.json`, ...(lead.photos || []).map(p => p.key)]);
}

export async function findByCode(codeIn) {
  const c = String(codeIn || '').toUpperCase().trim();
  if (!/^[A-Z2-9]{8}$/.test(c)) return null;
  const idx = await readJSON(`tracking/${c}.json`);
  return idx ? readLead(idx.id).catch(() => null) : null;
}

// Suivi client : le code ET l'e-mail ou le téléphone doivent correspondre
export function matchesTracking(lead, codeIn, contact) {
  if (!lead || !codeIn) return false;
  const a = Buffer.from(String(lead.code)), b = Buffer.from(String(codeIn).toUpperCase().trim());
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const c = String(contact || '').toLowerCase().trim();
  return Boolean(c) && (c === lead.email || normPhone(c) === lead.tel);
}

// Export CSV compatible Excel (séparateur ;, BOM UTF-8) avec protection contre l'injection de formules
export function toCSV(leads) {
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ['Date', 'Type', 'Statut', 'Nom', 'Téléphone', 'E-mail', 'Projet', 'Bien', 'Ville', 'Adresse', 'Surface', 'Pièces', 'État', 'Message', 'Notes internes', 'Code de suivi'];
  const rows = leads.map(l => [
    new Date(l.createdAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
    TYPES[l.type], STATUSES[l.status], l.nom, l.tel, l.email, l.projet, l.bienTitre,
    l.details?.ville, l.details?.adresse, l.details?.surface, l.details?.pieces, l.details?.etat,
    l.message, (l.notes || []).map(n => `${n.at.slice(0, 10)} ${n.by} : ${n.text}`).join(' | '), l.code,
  ]);
  return '﻿' + [head, ...rows].map(r => r.map(cell).join(';')).join('\r\n');
}
