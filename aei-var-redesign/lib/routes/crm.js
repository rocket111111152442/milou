// Routes admin du CRM et du contenu éditable (communes, avis, audience). Session obligatoire.
import { json, readBody, HttpError } from '../http.js';
import { requireUser, readUsers } from '../auth.js';
import { readBiens } from '../biens.js';
import { listLeads } from '../leads.js';
import { readCommunes, writeCommunes, sanitizeCommunes } from '../communes.js';
import { readAvis, writeAvis, sanitizeAvis } from '../avis.js';
import { audience } from '../stats.js';
import {
  CONTACT_TYPES, MANDAT_TYPES, MANDAT_STATUTS, listContacts, saveContact, addContactNote, mergeContacts, deleteContact,
  contactsCSV, importContacts, readTasks, saveTask, deleteTask, readMandats, saveMandat, mandatsToExpire,
  contactsForBien, biensForContact, readModeles, writeModeles, renderModele, buildReport,
} from '../crm.js';
import { sendEmail, emailEnabled, layout } from '../email.js';
import agence from '../../config/agence.js';

const ADMINS = ['owner', 'admin'];

const equipe = async ({ request }) => {
  await requireUser(request);
  return json({ equipe: (await readUsers()).filter(u => !u.disabled).map(u => ({ id: u.id, name: u.name, role: u.role })) });
};

// ---------- Contacts ----------
const listContactsRoute = async ({ request }) => {
  await requireUser(request);
  return json({ contacts: await listContacts(), types: CONTACT_TYPES });
};
const getContact = async ({ request, params }) => {
  await requireUser(request);
  const [contacts, leads, tasks, mandats, biens] = await Promise.all([listContacts(), listLeads(), readTasks(), readMandats(), readBiens()]);
  const c = contacts.find(x => x.id === params.id);
  if (!c) throw new HttpError(404, 'Contact introuvable');
  return json({
    contact: c,
    demandes: leads.filter(l => c.leadIds.includes(l.id)).map(l => ({ id: l.id, type: l.type, status: l.status, bienTitre: l.bienTitre, createdAt: l.createdAt, issue: l.issue || '' })),
    taches: tasks.filter(t => t.contactId === c.id),
    mandats: mandats.filter(m => m.contactId === c.id),
    biensCorrespondants: c.criteres ? biensForContact(c, biens).slice(0, 12).map(b => ({ id: b.id, titre: b.titre, ville: b.ville, prix: b.prix })) : [],
  });
};
const createContact = async ({ request }) => { await requireUser(request); return json({ contact: await saveContact(await readBody(request, 20_000)) }, 201); };
const updateContact = async ({ request, params }) => { await requireUser(request); return json({ contact: await saveContact(await readBody(request, 20_000), params.id) }); };
const noteContact = async ({ request, params }) => { const u = await requireUser(request); const { text } = await readBody(request, 5000); return json({ contact: await addContactNote(params.id, u.name, text) }); };
const mergeRoute = async ({ request }) => { await requireUser(request, ADMINS); const { keepId, dropId } = await readBody(request, 1000); return json({ contact: await mergeContacts(keepId, dropId) }); };
const removeContact = async ({ request, params }) => { await requireUser(request, ADMINS); await deleteContact(params.id); return json({ ok: true }); };
const exportContacts = async ({ request }) => {
  await requireUser(request, ADMINS);
  return new Response(contactsCSV(await listContacts()), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="contacts-${new Date().toISOString().slice(0, 10)}.csv"`, 'cache-control': 'no-store' } });
};
const importRoute = async ({ request }) => { const u = await requireUser(request, ADMINS); const { csv } = await readBody(request, 1_500_000); return json(await importContacts(csv, u.email)); };

// ---------- Tâches ----------
const listTasks = async ({ request }) => { await requireUser(request); return json({ taches: await readTasks() }); };
const createTask = async ({ request }) => { const u = await requireUser(request); const b = await readBody(request, 5000); return json({ tache: await saveTask({ ...b, createdBy: u.name, assigneId: b.assigneId || u.id }) }, 201); };
const updateTask = async ({ request, params }) => { await requireUser(request); return json({ tache: await saveTask(await readBody(request, 5000), params.id) }); };
const removeTask = async ({ request, params }) => { await requireUser(request); await deleteTask(params.id); return json({ ok: true }); };

// ---------- Mandats ----------
const listMandats = async ({ request }) => {
  await requireUser(request);
  const m = await readMandats();
  return json({ mandats: m, aEcheance: mandatsToExpire(m).map(x => x.id), types: MANDAT_TYPES, statuts: MANDAT_STATUTS });
};
const createMandat = async ({ request }) => { const u = await requireUser(request, ADMINS); return json({ mandat: await saveMandat(await readBody(request, 5000), u.email) }, 201); };
const updateMandat = async ({ request, params }) => { const u = await requireUser(request, ADMINS); return json({ mandat: await saveMandat(await readBody(request, 5000), u.email, params.id) }); };

// ---------- Rapprochement bien → acquéreurs ----------
const matchBien = async ({ request, params }) => {
  await requireUser(request);
  const b = (await readBiens()).find(x => x.id === params.id);
  if (!b) throw new HttpError(404, 'Bien introuvable');
  const list = contactsForBien(b, await listContacts());
  return json({ contacts: list.map(c => ({ id: c.id, nom: c.nom, email: c.email, tel: c.tel, alertes: c.alertes })) });
};

// ---------- Modèles et envoi d'e-mails ----------
const getModeles = async ({ request }) => { await requireUser(request); return json({ modeles: await readModeles(), emailEnabled: emailEnabled() }); };
const putModeles = async ({ request }) => { await requireUser(request, ADMINS); const { modeles } = await readBody(request, 60_000); await writeModeles(modeles); return json({ modeles: await readModeles() }); };
const sendModele = async ({ request }) => {
  const u = await requireUser(request);
  const { modeleId, contactId, bienId } = await readBody(request, 2000);
  const [modeles, contacts, biens] = await Promise.all([readModeles(), listContacts(), readBiens()]);
  const m = modeles.find(x => x.id === modeleId), c = contacts.find(x => x.id === contactId);
  if (!m || !c) throw new HttpError(404, 'Modèle ou contact introuvable');
  const bien = biens.find(b => b.id === bienId);
  const mail = renderModele(m, { nom: c.nom, bien: bien ? `${bien.titre} (${bien.ville})` : 'votre projet', agence: agence.nomCourt, signature: `${u.name}\n${agence.nom}\n${agence.telephone}` });
  // Sans service d'e-mail configuré, l'interface ouvre le client de messagerie (mailto) avec ce texte pré-rempli
  if (!emailEnabled()) return json({ sent: false, mailto: `mailto:${c.email}?subject=${encodeURIComponent(mail.objet)}&body=${encodeURIComponent(mail.corps)}`, ...mail });
  if (!c.email) throw new HttpError(400, 'Ce contact n’a pas d’adresse e-mail');
  const r = await sendEmail({ to: c.email, replyTo: u.email, subject: mail.objet, text: mail.corps, html: layout(mail.objet, mail.corps) });
  if (!r.sent) throw new HttpError(502, 'L’envoi a échoué');
  await addContactNote(c.id, u.name, `E-mail envoyé : ${mail.objet}`);
  return json({ sent: true, ...mail });
};

// ---------- Rapports et audience ----------
const rapports = async ({ request, query }) => {
  await requireUser(request, ADMINS);
  const days = Math.min(365, Math.max(7, Number(query.get('jours')) || 90));
  const [leads, biens, users, aud] = await Promise.all([listLeads(), readBiens(), readUsers(), audience(Math.min(days, 90))]);
  return json(buildReport({ leads, biens, users, audience: aud, days }));
};

// ---------- Communes, avis ----------
const getCommunes = async ({ request }) => { await requireUser(request); return json(await readCommunes()); };
const putCommunes = async ({ request }) => { await requireUser(request, ADMINS); await writeCommunes(sanitizeCommunes(await readBody(request, 200_000))); return json(await readCommunes()); };
const getAvis = async ({ request }) => { await requireUser(request); return json(await readAvis()); };
const putAvis = async ({ request }) => { await requireUser(request, ADMINS); await writeAvis(sanitizeAvis(await readBody(request, 200_000))); return json(await readAvis()); };

// ---------- Alertes du tableau de bord ----------
const alertes = async ({ request }) => {
  const u = await requireUser(request);
  const [tasks, mandats] = await Promise.all([readTasks(), readMandats()]);
  const today = new Date().toISOString().slice(0, 10);
  const mine = tasks.filter(t => !t.fait && t.echeance && t.echeance <= today && (u.role !== 'agent' || t.assigneId === u.id));
  return json({ tachesEnRetard: mine.length, mandatsAEcheance: mandatsToExpire(mandats).length });
};

export default [
  ['GET', '/admin/equipe', equipe],
  ['GET', '/admin/contacts', listContactsRoute],
  ['POST', '/admin/contacts', createContact],
  ['POST', '/admin/contacts/fusion', mergeRoute],
  ['POST', '/admin/contacts/import', importRoute],
  ['GET', '/admin/contacts.csv', exportContacts],
  ['GET', '/admin/contacts/:id', getContact],
  ['PUT', '/admin/contacts/:id', updateContact],
  ['POST', '/admin/contacts/:id/notes', noteContact],
  ['DELETE', '/admin/contacts/:id', removeContact],
  ['GET', '/admin/taches', listTasks],
  ['POST', '/admin/taches', createTask],
  ['PUT', '/admin/taches/:id', updateTask],
  ['DELETE', '/admin/taches/:id', removeTask],
  ['GET', '/admin/mandats', listMandats],
  ['POST', '/admin/mandats', createMandat],
  ['PUT', '/admin/mandats/:id', updateMandat],
  ['GET', '/admin/biens/:id/acquereurs', matchBien],
  ['GET', '/admin/modeles', getModeles],
  ['PUT', '/admin/modeles', putModeles],
  ['POST', '/admin/modeles/envoyer', sendModele],
  ['GET', '/admin/rapports', rapports],
  ['GET', '/admin/communes', getCommunes],
  ['PUT', '/admin/communes', putCommunes],
  ['GET', '/admin/avis', getAvis],
  ['PUT', '/admin/avis', putAvis],
  ['GET', '/admin/alertes', alertes],
];
