// Routes de l'espace administrateur (session obligatoire)
import { randomBytes } from 'node:crypto';
import { json, readBody, readBinary, HttpError, sniffImage } from '../http.js';
import {
  requireUser, readUsers, updateUsers, publicUser, hashPassword, checkPasswordStrength, newUserId, ROLES,
} from '../auth.js';
import { readBiens, readBiensWithEtag, writeBiens, sanitizeBien, STATUTS, TRANSACTIONS, TYPES as BIEN_TYPES, BADGES, toNumber } from '../biens.js';
import { listLeads, readLead, updateLead, deleteLead, toCSV, TYPES, STATUSES } from '../leads.js';
import { readBuffer, writeBuffer, storageMode, listKeys, readJSON } from '../storage.js';
import { emailEnabled } from '../email.js';
import { validEmail } from '../leads.js';

const ADMINS = ['owner', 'admin'];

// ---------- Biens ----------
async function listBiens({ request }) {
  await requireUser(request);
  return json({ biens: await readBiens(), statuts: STATUTS, transactions: TRANSACTIONS, types: BIEN_TYPES, badges: BADGES });
}

// Lecture → modification → écriture protégée (si deux personnes enregistrent en même temps, aucune ne perd ses changements)
async function mutateBiens(fn) {
  for (let i = 0; i < 4; i++) {
    const { data, etag } = await readBiensWithEtag();
    const list = (data || []).map(b => ({ ...b }));
    const result = await fn(list);
    try {
      await writeBiens(list, etag);
      return result;
    } catch (e) {
      if (e.status !== 409 || i === 3) throw e;
    }
  }
}

async function createBien({ request }) {
  const user = await requireUser(request);
  const body = await readBody(request, 100_000);
  const bien = sanitizeBien({ ...body, id: '' });
  bien.createdBy = user.email;
  await mutateBiens(list => { list.unshift(bien); });
  return json({ bien }, 201);
}

async function updateBien({ request, params }) {
  const user = await requireUser(request);
  const body = await readBody(request, 100_000);
  const bien = await mutateBiens(list => {
    const i = list.findIndex(b => b.id === params.id);
    if (i < 0) throw new HttpError(404, 'Bien introuvable');
    const next = sanitizeBien({ ...body, id: params.id }, list[i]);
    next.updatedBy = user.email;
    list[i] = next;
    return next;
  });
  return json({ bien });
}

async function deleteBien({ request, params }) {
  await requireUser(request, ADMINS);
  await mutateBiens(list => {
    const i = list.findIndex(b => b.id === params.id);
    if (i < 0) throw new HttpError(404, 'Bien introuvable');
    list.splice(i, 1);
  });
  return json({ ok: true });
}

async function reorderBiens({ request }) {
  await requireUser(request);
  const { ids } = await readBody(request, 50_000);
  if (!Array.isArray(ids)) throw new HttpError(400, 'Ordre invalide');
  await mutateBiens(list => {
    const pos = new Map(ids.map((id, i) => [id, i]));
    list.sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
  });
  return json({ ok: true });
}

async function uploadPhoto({ request }) {
  await requireUser(request);
  const buf = await readBinary(request, 4 * 1024 * 1024);
  const img = sniffImage(buf);
  if (!img) throw new HttpError(415, 'Format accepté : JPEG, PNG ou WebP');
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString('base64url')}.${img.ext}`;
  await writeBuffer(`photos/${name}`, buf, img.type);
  return json({ url: `/api/media/photos/${name}` });
}

// ---------- Demandes ----------
async function listLeadsRoute({ request }) {
  await requireUser(request);
  const leads = await listLeads();
  return json({ leads: leads.map(l => ({ ...l, typeLabel: TYPES[l.type], statusLabel: STATUSES[l.status] })), types: TYPES, statuses: STATUSES });
}

async function patchLead({ request, params }) {
  const user = await requireUser(request);
  const { status, note, assigneId, issue, motifPerte } = await readBody(request, 10_000);
  const now = new Date().toISOString();
  const lead = await updateLead(params.id, (l) => {
    if (status !== undefined) {
      if (!STATUSES[status]) throw new HttpError(400, 'Statut invalide');
      if (status !== l.status) l.history.push({ at: now, by: user.name, action: `Statut : ${STATUSES[status]}` });
      l.status = status;
    }
    if (note !== undefined) {
      const text = String(note).trim().slice(0, 2000);
      if (!text) throw new HttpError(400, 'Note vide');
      l.notes.push({ at: now, by: user.name, text });
    }
    if (assigneId !== undefined) {
      const a = String(assigneId).slice(0, 60);
      if (a !== (l.assigneId || '')) l.history.push({ at: now, by: user.name, action: a ? 'Demande assignée' : 'Assignation retirée' });
      l.assigneId = a;
    }
    if (issue !== undefined) {
      if (!['', 'gagne', 'perdu'].includes(issue)) throw new HttpError(400, 'Issue invalide');
      if (issue !== (l.issue || '')) l.history.push({ at: now, by: user.name, action: issue === 'gagne' ? 'Issue : gagnée' : issue === 'perdu' ? 'Issue : perdue' : 'Issue retirée' });
      l.issue = issue;
      if (issue && l.status !== 'termine') { l.history.push({ at: now, by: user.name, action: `Statut : ${STATUSES.termine}` }); l.status = 'termine'; }
    }
    if (motifPerte !== undefined) l.motifPerte = String(motifPerte).trim().slice(0, 200);
    l.updatedAt = now;
    return l;
  });
  return json({ lead: { ...lead, typeLabel: TYPES[lead.type], statusLabel: STATUSES[lead.status] } });
}

async function removeLead({ request, params }) {
  await requireUser(request, ADMINS);
  await deleteLead(params.id);
  return json({ ok: true });
}

async function leadPhoto({ request, params }) {
  await requireUser(request);
  const lead = await readLead(params.id);
  const p = lead?.photos?.[Number(params.n)];
  if (!p) throw new HttpError(404, 'Photo introuvable');
  const buf = await readBuffer(p.key);
  if (!buf) throw new HttpError(404, 'Photo introuvable');
  return new Response(buf, { headers: { 'content-type': sniffImage(buf)?.type || 'application/octet-stream', 'cache-control': 'private, no-store' } });
}

async function exportCSV({ request, query }) {
  await requireUser(request, ADMINS);
  let leads = await listLeads();
  if (query.get('type')) leads = leads.filter(l => l.type === query.get('type'));
  if (query.get('status')) leads = leads.filter(l => l.status === query.get('status'));
  const date = new Date().toISOString().slice(0, 10);
  return new Response(toCSV(leads), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="demandes-${date}.csv"`, 'cache-control': 'no-store' },
  });
}

// ---------- Tableau de bord ----------
async function stats({ request }) {
  await requireUser(request);
  const [biens, leads] = await Promise.all([readBiens(), listLeads()]);
  const now = Date.now();
  const since = (days) => leads.filter(l => now - new Date(l.createdAt) < days * 864e5);
  const count = (arr, key) => arr.reduce((acc, x) => ((acc[x[key]] = (acc[x[key]] || 0) + 1), acc), {});

  // Demandes par semaine sur 12 semaines (lundi = début de semaine)
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(monday); start.setDate(start.getDate() - (11 - i) * 7);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    return { start: start.toISOString().slice(0, 10), count: leads.filter(l => { const d = new Date(l.createdAt); return d >= start && d < end; }).length };
  });

  const published = biens.filter(b => b.publie);
  return json({
    biens: {
      total: biens.length,
      publies: published.length,
      masques: biens.length - published.length,
      parStatut: count(biens, 'statut'),
      valeurEnVente: published.filter(b => b.transaction === 'vente' && b.statut === 'disponible').reduce((s, b) => s + toNumber(b.prix), 0),
    },
    demandes: {
      total: leads.length,
      nouvelles: leads.filter(l => l.status === 'nouveau').length,
      trenteJours: since(30).length,
      estimations: leads.filter(l => l.type === 'estimation').length,
      estimationsTrenteJours: since(30).filter(l => l.type === 'estimation').length,
      parType: count(leads, 'type'),
      parStatut: count(leads, 'status'),
      parSemaine: weeks,
      recentes: leads.slice(0, 6).map(l => ({ id: l.id, nom: l.nom || l.email, type: TYPES[l.type], status: l.status, statusLabel: STATUSES[l.status], createdAt: l.createdAt })),
    },
    labels: { statuts: STATUTS, types: TYPES, statuses: STATUSES },
  });
}

// ---------- Utilisateurs ----------
async function listUsers({ request }) {
  await requireUser(request, ADMINS);
  return json({ users: (await readUsers()).map(publicUser) });
}

const tempPassword = () => `${randomBytes(9).toString('base64url')}7a`;

async function createUser({ request }) {
  const me = await requireUser(request, ADMINS);
  const { email, name, role } = await readBody(request, 5000);
  const e = String(email || '').trim().toLowerCase();
  if (!validEmail(e)) throw new HttpError(400, 'Adresse e-mail invalide');
  if (!String(name || '').trim()) throw new HttpError(400, 'Le nom est obligatoire');
  if (!['admin', 'agent'].includes(role)) throw new HttpError(400, 'Rôle invalide');
  if (role === 'admin' && me.role !== 'owner') throw new HttpError(403, 'Seul le propriétaire peut créer un administrateur');
  const temp = tempPassword();
  const user = { id: newUserId(), email: e, name: String(name).trim().slice(0, 80), role, hash: await hashPassword(temp), mustChange: true, sessionVersion: 0, createdAt: new Date().toISOString(), createdBy: me.email };
  await updateUsers(list => {
    if (list.some(u => u.email === e)) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail');
    return [...list, user];
  });
  // Le mot de passe provisoire n'est affiché qu'une fois et n'est jamais stocké en clair
  return json({ user: publicUser(user), tempPassword: temp }, 201);
}

async function patchUser({ request, params }) {
  const me = await requireUser(request, ADMINS);
  const body = await readBody(request, 5000);
  let temp = null;
  const users = await updateUsers(async (list) => {
    const u = list.find(x => x.id === params.id);
    if (!u) throw new HttpError(404, 'Utilisateur introuvable');
    if (u.role === 'owner' && me.id !== u.id) throw new HttpError(403, 'Le compte propriétaire ne peut être modifié que par lui-même');
    if (me.role !== 'owner' && u.role === 'admin' && me.id !== u.id) throw new HttpError(403, 'Seul le propriétaire peut modifier un administrateur');
    if (body.name !== undefined) u.name = String(body.name).trim().slice(0, 80) || u.name;
    if (body.role !== undefined && u.role !== 'owner') {
      if (!['admin', 'agent'].includes(body.role)) throw new HttpError(400, 'Rôle invalide');
      if (body.role === 'admin' && me.role !== 'owner') throw new HttpError(403, 'Seul le propriétaire peut nommer un administrateur');
      u.role = body.role;
    }
    if (body.disabled !== undefined) {
      if (u.id === me.id) throw new HttpError(400, 'Vous ne pouvez pas désactiver votre propre compte');
      u.disabled = Boolean(body.disabled);
      u.sessionVersion = (u.sessionVersion || 0) + 1; // déconnexion immédiate
    }
    if (body.resetPassword) {
      if (u.id === me.id) throw new HttpError(400, 'Utilisez « Mon compte » pour changer votre propre mot de passe');
      temp = tempPassword();
      u.hash = await hashPassword(temp);
      u.mustChange = true;
      u.sessionVersion = (u.sessionVersion || 0) + 1;
    }
    return list;
  });
  return json({ user: publicUser(users.find(u => u.id === params.id)), tempPassword: temp });
}

async function deleteUser({ request, params }) {
  const me = await requireUser(request, ['owner']);
  if (params.id === me.id) throw new HttpError(400, 'Vous ne pouvez pas supprimer votre propre compte');
  await updateUsers(list => list.filter(u => u.id !== params.id || u.role === 'owner'));
  return json({ ok: true });
}

// ---------- Intégrations & sauvegardes ----------
async function integrations({ request }) {
  await requireUser(request);
  const backups = (await listKeys('backups/')).sort((a, b) => b.key.localeCompare(a.key));
  return json({
    stockage: storageMode,
    email: { configured: emailEnabled(), provider: 'Resend', variables: ['RESEND_API_KEY', 'EMAIL_FROM', 'NOTIFY_EMAIL (facultatif)'] },
    syncApi: { configured: Boolean(process.env.SYNC_API_KEY), endpoint: '/api/v1/biens', doc: 'docs/API.md' },
    cron: { configured: Boolean(process.env.CRON_SECRET) },
    logiciel: { status: 'à connecter', note: 'Aucun connecteur n’est activé : il dépend du logiciel de transaction de l’agence et de sa documentation officielle.' },
    sauvegardes: backups.slice(0, 10).map(b => ({ date: b.key.replace(/^backups\/|\.json$/g, ''), size: b.size })),
  });
}

async function downloadBackup({ request }) {
  await requireUser(request, ADMINS);
  const [biens, leads, users] = await Promise.all([readBiens(), listLeads(), readUsers()]);
  const data = { exportedAt: new Date().toISOString(), biens, leads, users: users.map(publicUser) };
  return new Response(JSON.stringify(data, null, 1), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="sauvegarde-${new Date().toISOString().slice(0, 10)}.json"`, 'cache-control': 'no-store' },
  });
}

async function restoreBiens({ request }) {
  await requireUser(request, ['owner']);
  const body = await readBody(request, 3_000_000);
  const list = Array.isArray(body) ? body : body?.biens;
  if (!Array.isArray(list)) throw new HttpError(400, 'Fichier de sauvegarde invalide (liste de biens attendue)');
  const clean = list.map(b => sanitizeBien(b, b));
  await mutateBiens(cur => { cur.splice(0, cur.length, ...clean); });
  return json({ ok: true, count: clean.length });
}

export default [
  ['GET', '/admin/biens', listBiens],
  ['POST', '/admin/biens', createBien],
  ['POST', '/admin/biens/ordre', reorderBiens],
  ['PUT', '/admin/biens/:id', updateBien],
  ['DELETE', '/admin/biens/:id', deleteBien],
  ['POST', '/admin/photos', uploadPhoto],
  ['GET', '/admin/demandes', listLeadsRoute],
  ['GET', '/admin/demandes.csv', exportCSV],
  ['PATCH', '/admin/demandes/:id', patchLead],
  ['DELETE', '/admin/demandes/:id', removeLead],
  ['GET', '/admin/demandes/:id/photos/:n', leadPhoto],
  ['GET', '/admin/stats', stats],
  ['GET', '/admin/utilisateurs', listUsers],
  ['POST', '/admin/utilisateurs', createUser],
  ['PATCH', '/admin/utilisateurs/:id', patchUser],
  ['DELETE', '/admin/utilisateurs/:id', deleteUser],
  ['GET', '/admin/integrations', integrations],
  ['GET', '/admin/sauvegarde', downloadBackup],
  ['POST', '/admin/sauvegarde/biens', restoreBiens],
];
