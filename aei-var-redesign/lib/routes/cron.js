// Tâche quotidienne (Vercel Cron, voir vercel.json) : sauvegarde, nettoyage, alertes e-mail.
// Vercel envoie « Authorization: Bearer <CRON_SECRET> » quand la variable CRON_SECRET est définie.
import { timingSafeEqual, createHash } from 'node:crypto';
import { json, HttpError } from '../http.js';
import { writeJSON, listKeys, removeKeys, readJSON } from '../storage.js';
import { readBiens, toNumber } from '../biens.js';
import { listLeads, updateLead, deleteLead } from '../leads.js';
import { readUsers, publicUser } from '../auth.js';
import { sendEmail, emailEnabled, layout } from '../email.js';
import agence from '../../config/agence.js';
import { purgeOldContacts, readContacts, readTasks, readMandats } from '../crm.js';
import { purgeOld as purgeStats } from '../stats.js';

function requireCron(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, 'CRON_SECRET non configuré');
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = createHash('sha256').update(given).digest(), b = createHash('sha256').update(secret).digest();
  if (!timingSafeEqual(a, b)) throw new HttpError(401, 'Non autorisé');
}

const daysAgo = (d) => Date.now() - d * 864e5;

async function backup(biens, leads) {
  const users = (await readUsers()).map(publicUser);
  const date = new Date().toISOString().slice(0, 10);
  const crm = { contacts: await readContacts(), taches: await readTasks(), mandats: await readMandats() };
  await writeJSON(`backups/${date}.json`, { createdAt: new Date().toISOString(), biens, leads, users, crm });
  const old = (await listKeys('backups/')).filter(b => b.uploadedAt < daysAgo(agence.conservation.sauvegardesJours)).map(b => b.key);
  if (old.length) await removeKeys(old);
  return date;
}

async function cleanup() {
  // Photos d'estimation envoyées mais jamais rattachées à une demande, compteurs anti-spam expirés, liens de réinitialisation
  const stale = [
    ...(await listKeys('uploads/tmp/')).filter(k => k.uploadedAt < daysAgo(1)),
    ...(await listKeys('ratelimit/')).filter(k => k.uploadedAt < daysAgo(2)),
  ].map(k => k.key);
  const resets = await listKeys('auth/resets/');
  for (const r of resets) {
    const e = await readJSON(r.key);
    if (!e || e.exp < Date.now()) stale.push(r.key);
  }
  if (stale.length) await removeKeys(stale);
  return stale.length;
}

// Alerte : biens publiés depuis le dernier envoi et correspondant aux critères
const matches = (b, d) =>
  b.publie && b.statut === 'disponible' &&
  (b.transaction || 'vente') === (d.transaction || 'vente') &&
  (!d.ville || b.ville.toLowerCase().includes(d.ville.toLowerCase())) &&
  (!d.typeBien || d.typeBien === 'Tous' || b.type === d.typeBien) &&
  (!d.budgetMax || toNumber(b.prix) <= Number(d.budgetMax)) &&
  (!d.surfaceMin || toNumber(b.surface) >= Number(d.surfaceMin));

async function sendAlerts(biens, leads, origin) {
  if (!emailEnabled()) return { sent: 0, note: 'e-mail non configuré' };
  let sent = 0;
  for (const l of leads.filter(x => x.type === 'alerte' && x.alert?.active && x.email)) {
    const since = new Date(l.alert.lastSentAt || l.createdAt);
    const found = biens.filter(b => b.publishedAt && new Date(b.publishedAt) > since && matches(b, l.details || {}));
    if (!found.length) continue;
    const lines = found.slice(0, 10).map(b => `• ${b.titre} – ${b.ville}${b.prix ? ` – ${b.prix} €${b.transaction === 'location' ? '/mois' : ''}` : ''}\n  ${origin}/bien/${b.id}`).join('\n');
    const unsub = `${origin}/api/alertes/desinscription?id=${l.id}&token=${l.alert.token}`;
    const text = `${found.length} nouveau${found.length > 1 ? 'x' : ''} bien${found.length > 1 ? 's' : ''} correspond${found.length > 1 ? 'ent' : ''} à votre recherche :\n\n${lines}\n\nPour ne plus recevoir ces alertes : ${unsub}`;
    const r = await sendEmail({ to: l.email, subject: `Nouveaux biens pour votre recherche – ${agence.nomCourt}`, text, html: layout('De nouveaux biens pour vous', text) });
    if (r.sent) {
      sent++;
      await updateLead(l.id, x => ({ ...x, alert: { ...x.alert, lastSentAt: new Date().toISOString() } }));
    }
  }
  return { sent };
}

// Durée de conservation annoncée dans la politique de confidentialité
async function purgeOldLeads(leads) {
  const limit = new Date(); limit.setMonth(limit.getMonth() - agence.conservation.demandesMois);
  const old = leads.filter(l => new Date(l.updatedAt || l.createdAt) < limit);
  for (const l of old) await deleteLead(l.id);
  return old.length;
}

// Résumé quotidien des tâches en retard, envoyé à chaque personne concernée (si l'e-mail est configuré)
async function taskDigest() {
  if (!emailEnabled()) return { sent: 0, note: 'e-mail non configuré' };
  const today = new Date().toISOString().slice(0, 10);
  const [tasks, users] = await Promise.all([readTasks(), readUsers()]);
  let sent = 0;
  for (const u of users.filter(x => !x.disabled)) {
    const due = tasks.filter(t => !t.fait && t.assigneId === u.id && t.echeance && t.echeance <= today);
    if (!due.length) continue;
    const text = `Vous avez ${due.length} tâche${due.length > 1 ? 's' : ''} à traiter :\n\n${due.map(t => `• ${t.titre} (échéance ${t.echeance})`).join('\n')}`;
    if ((await sendEmail({ to: u.email, subject: `${due.length} tâche(s) à traiter – ${agence.nomCourt}`, text, html: layout('Vos tâches du jour', text) })).sent) sent++;
  }
  return { sent };
}

async function daily({ request }) {
  requireCron(request);
  const [biens, allLeads] = await Promise.all([readBiens(), listLeads()]);
  const purged = await purgeOldLeads(allLeads);
  const leads = purged ? await listLeads() : allLeads;
  const origin = process.env.SITE_URL || new URL(request.url).origin;
  const report = {
    sauvegarde: await backup(biens, leads),
    nettoyes: await cleanup(),
    demandesPurgees: purged,
    alertes: await sendAlerts(biens, leads, origin),
    contactsPurges: await purgeOldContacts(agence.conservation.demandesMois),
    statsPurgees: await purgeStats(agence.conservation.audienceMois),
    taches: await taskDigest(),
  };
  console.log('Tâche quotidienne', report);
  return json(report);
}

export default [['GET', '/cron/daily', daily, { skipOrigin: true }]];
