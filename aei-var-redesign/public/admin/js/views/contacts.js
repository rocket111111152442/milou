// Contacts (CRM) : liste, fiche, notes, rapprochement avec les biens, e-mails types, fusion, import/export, effacement RGPD
import { api } from '../api.js';
import { $, $$, esc, toast, fmtDate, confirmDialog, formDialog, modal } from '../ui.js';

let contacts = [], types = {}, session, q = '', typeF = '';
const isAdmin = () => ['owner', 'admin'].includes(session.user.role);

function renderList() {
  const s = q.toLowerCase();
  const rows = contacts.filter(c => (!typeF || c.types.includes(typeF)) && (!s || `${c.nom} ${c.email} ${c.tel}`.toLowerCase().includes(s)));
  $('#cSummary').textContent = `${contacts.length} contact${contacts.length > 1 ? 's' : ''}${rows.length !== contacts.length ? ` · ${rows.length} affichés` : ''}`;
  $('#cList').innerHTML = rows.length ? `<table class="table"><thead><tr><th>Nom</th><th>Coordonnées</th><th>Profil</th><th>Dernier contact</th></tr></thead><tbody>${rows.map(c => `
    <tr data-id="${esc(c.id)}" tabindex="0"><td data-label="Nom"><strong>${esc(c.nom)}</strong>${c.alertes ? '<span class="pill pill--ok">Alertes</span>' : ''}</td>
    <td data-label="Coordonnées">${esc([c.tel, c.email].filter(Boolean).join(' · '))}</td>
    <td data-label="Profil">${c.types.map(t => `<span class="pill">${esc(types[t])}</span>`).join('') || '<span class="muted">—</span>'}</td>
    <td data-label="Dernier contact">${esc(fmtDate(c.derniereInteraction, false))}</td></tr>`).join('')}</tbody></table>`
    : '<div class="empty">Aucun contact. Les personnes qui remplissent un formulaire du site sont ajoutées automatiquement ; vous pouvez aussi en créer ou importer un fichier.</div>';
}

const contactFields = (c = {}) => [
  { name: 'nom', label: 'Nom et prénom', value: c.nom, required: true },
  { name: 'tel', label: 'Téléphone', value: c.tel },
  { name: 'email', label: 'E-mail', type: 'email', value: c.email },
  { name: 'type', label: 'Profil principal', type: 'select', value: c.types?.[0] || '', options: [['', '—'], ...Object.entries(types)] },
  { name: 'c_transaction', label: 'Recherche : achat ou location', type: 'select', value: c.criteres?.transaction || 'vente', options: [['vente', 'Achat'], ['location', 'Location']] },
  { name: 'c_types', label: 'Recherche : types de bien (séparés par des virgules)', value: (c.criteres?.types || []).join(', '), placeholder: 'Maison, Villa' },
  { name: 'c_villes', label: 'Recherche : villes (séparées par des virgules)', value: (c.criteres?.villes || []).join(', '), placeholder: 'Six-Fours-les-Plages, Sanary-sur-Mer' },
  { name: 'c_budgetMax', label: 'Recherche : budget maximum (€)', value: c.criteres?.budgetMax },
  { name: 'c_surfaceMin', label: 'Recherche : surface minimum (m²)', value: c.criteres?.surfaceMin },
  { name: 'c_chambresMin', label: 'Recherche : chambres minimum', value: c.criteres?.chambresMin },
];

// Les critères servent uniquement au rapprochement interne : les saisir ne déclenche AUCUN envoi d'e-mail au contact
const withCriteres = (v) => {
  const list = (x) => String(x || '').split(',').map(t => t.trim()).filter(Boolean);
  const any = v.c_types || v.c_villes || v.c_budgetMax || v.c_surfaceMin || v.c_chambresMin;
  return { ...v, criteres: any ? { transaction: v.c_transaction, types: list(v.c_types), villes: list(v.c_villes), budgetMax: v.c_budgetMax, surfaceMin: v.c_surfaceMin, chambresMin: v.c_chambresMin } : null };
};

async function newContact() {
  const v = await formDialog({ title: 'Nouveau contact', fields: contactFields() });
  if (!v) return;
  try { const { contact } = await api('/admin/contacts', { method: 'POST', body: { ...withCriteres(v), types: v.type ? [v.type] : [] } }); toast('Contact créé'); location.hash = `#contacts/${contact.id}`; } catch (e) { toast(e.message, true); }
}

async function importCsv() {
  const v = await formDialog({
    title: 'Importer des contacts', submit: 'Importer',
    intro: 'Collez le contenu d’un fichier CSV (colonnes : nom;email;telephone;type). Les contacts importés n’ont PAS donné leur accord pour les alertes e-mail : n’importez que des personnes avec lesquelles vous avez déjà une relation.',
    fields: [{ name: 'csv', label: 'Contenu CSV', type: 'textarea' }],
  });
  if (!v?.csv?.trim()) return;
  try {
    const r = await api('/admin/contacts/import', { method: 'POST', body: { csv: v.csv } });
    await modal({ title: 'Import terminé', html: `<p><strong>${r.crees}</strong> contact(s) créé(s).</p>${r.ignores.length ? `<p>${r.ignores.length} ligne(s) ignorée(s) :</p><ul>${r.ignores.slice(0, 15).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}` });
    contacts = (await api('/admin/contacts')).contacts; renderList();
  } catch (e) { toast(e.message, true); }
}

async function detail(el, id) {
  const d = await api(`/admin/contacts/${id}`);
  const c = d.contact;
  const { modeles } = await api("/admin/modeles");
  const cr = c.criteres;
  el.innerHTML = `
    <div class="head"><div><p class="muted"><a href="#contacts">← Contacts</a></p><h1>${esc(c.nom)}</h1><p class="muted">${c.types.map(t => esc(types[t])).join(' · ') || 'Profil non précisé'} · créé le ${esc(fmtDate(c.createdAt, false))}</p></div>
      <div class="actions-cell">
        ${c.tel ? `<a class="btn btn--ghost btn--sm" href="tel:${esc(c.tel)}">Appeler ${esc(c.tel)}</a>` : ''}
        <button class="btn btn--ghost btn--sm" id="cEdit">Modifier</button>
        ${isAdmin() ? '<button class="btn btn--ghost btn--sm" id="cMerge">Fusionner…</button><button class="btn btn--danger btn--sm" id="cDel">Supprimer (RGPD)</button>' : ''}
      </div></div>
    <div class="cols">
      <div class="card"><h2>Coordonnées</h2><p>${esc(c.tel) || '—'}<br>${esc(c.email) || '—'}</p>
        <p class="muted small">Consentement : ${c.consentement ? esc(fmtDate(c.consentement.at, false)) + ' — ' + esc(c.consentement.text || '') : 'non enregistré'}</p>
        ${cr ? `<h3>Recherche</h3><p>${esc([cr.transaction === 'location' ? 'Location' : 'Achat', cr.types.join(', '), cr.villes.join(', '), cr.budgetMax && `≤ ${Number(cr.budgetMax).toLocaleString('fr-FR')} €`, cr.surfaceMin && `≥ ${cr.surfaceMin} m²`].filter(Boolean).join(' · '))}</p>` : ''}
      </div>
      <div class="card"><h2>Envoyer un e-mail type</h2>
        <form id="mailForm" class="inline-form"><label class="field"><span>Modèle</span><select name="m">${modeles.map(m => `<option value="${esc(m.id)}">${esc(m.nom)}</option>`).join('')}</select></label>
        <label class="field"><span>Bien concerné</span><select name="b"><option value="">—</option>${d.biensCorrespondants.map(b => `<option value="${esc(b.id)}">${esc(b.titre)}</option>`).join('')}</select></label>
        <button class="btn btn--red btn--sm" ${c.email ? '' : 'disabled'}>Préparer l’envoi</button></form>
        <p class="muted small">Sans service d’e-mail configuré, votre messagerie s’ouvre avec le texte prêt à envoyer.</p></div>
      <div class="card"><h2>Biens qui pourraient l’intéresser</h2>${d.biensCorrespondants.length ? `<ul>${d.biensCorrespondants.map(b => `<li><a href="#biens">${esc(b.titre)}</a> – ${esc(b.ville)} ${b.prix ? esc(b.prix) + ' €' : ''}</li>`).join('')}</ul>` : '<p class="muted">Aucun (ou critères de recherche non renseignés).</p>'}</div>
      <div class="card"><h2>Demandes (${d.demandes.length})</h2>${d.demandes.map(l => `<p><a href="#demandes/${esc(l.id)}">${esc(l.type)}${l.bienTitre ? ' – ' + esc(l.bienTitre) : ''}</a> <small class="muted">${esc(fmtDate(l.createdAt, false))}</small></p>`).join('') || '<p class="muted">Aucune.</p>'}
        <h3>Tâches</h3>${d.taches.map(t => `<p class="${t.fait ? 'muted' : ''}">${t.fait ? '✔' : '○'} ${esc(t.titre)} <small>${esc(t.echeance)}</small></p>`).join('') || '<p class="muted">Aucune.</p>'}
        <h3>Visites</h3>${(d.visites || []).map(v => `<p>${esc(v.date.split('-').reverse().join('/'))} ${esc(v.heure)} – ${esc(v.titreBien || v.lieu || '')} <small class="muted">(${esc(v.statutLabel)})</small></p>`).join('') || '<p class="muted">Aucune.</p>'}
        <button class="btn btn--ghost btn--sm" id="cVisit">+ Visite</button>
        <button class="btn btn--ghost btn--sm" id="cTask">+ Rappel</button>
        ${d.mandats.length ? `<h3>Mandats</h3>${d.mandats.map(m => `<p>${esc(m.numero)} – ${esc(m.type)}</p>`).join('')}` : ''}</div>
      <div class="card"><h2>Notes</h2><ul class="notes">${c.notes.map(n => `<li><p>${esc(n.text).replace(/\n/g, '<br>')}</p><small>${esc(n.by)} · ${esc(fmtDate(n.at))}</small></li>`).join('') || '<li class="muted">Aucune note.</li>'}</ul>
        <form id="nForm"><label class="field"><span>Ajouter une note</span><textarea name="t" rows="3" maxlength="2000" required></textarea></label><button class="btn btn--ghost btn--sm">Ajouter</button></form></div>
    </div>`;
  $('#nForm').addEventListener('submit', async e => { e.preventDefault(); try { await api(`/admin/contacts/${id}/notes`, { method: 'POST', body: { text: e.target.t.value } }); detail(el, id); } catch (er) { toast(er.message, true); } });
  $('#cEdit').addEventListener('click', async () => {
    const v = await formDialog({ title: 'Modifier le contact', fields: contactFields(c) });
    if (!v) return;
    try { await api(`/admin/contacts/${id}`, { method: 'PUT', body: { ...c, ...withCriteres(v), types: v.type ? [v.type, ...c.types.filter(t => t !== v.type)] : c.types } }); toast('Contact mis à jour'); detail(el, id); } catch (er) { toast(er.message, true); }
  });
  $('#cVisit').addEventListener('click', async () => {
    const biens = (await api('/admin/biens')).biens.filter(b => b.publie);
    const v = await formDialog({ title: 'Planifier une visite', fields: [
      { name: 'bienId', label: 'Bien', type: 'select', options: biens.map(b => [b.id, `${b.titre} (${b.ville})`]) },
      { name: 'date', label: 'Date', type: 'date', value: new Date(Date.now() + 864e5).toISOString().slice(0, 10), required: true },
      { name: 'heure', label: 'Heure', type: 'time' },
    ] });
    if (!v) return;
    try { await api('/admin/visites', { method: 'POST', body: { ...v, contactId: id } }); toast('Visite planifiée'); detail(el, id); } catch (er) { toast(er.message, true); }
  });
  $('#cTask').addEventListener('click', async () => {
    const v = await formDialog({ title: 'Nouveau rappel', fields: [{ name: 'titre', label: 'À faire', required: true }, { name: 'echeance', label: 'Échéance', type: 'date', value: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10) }] });
    if (!v) return;
    try { await api('/admin/taches', { method: 'POST', body: { ...v, contactId: id } }); detail(el, id); } catch (er) { toast(er.message, true); }
  });
  $('#mailForm').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const r = await api('/admin/modeles/envoyer', { method: 'POST', body: { modeleId: e.target.m.value, contactId: id, bienId: e.target.b.value } });
      if (r.sent) { toast('E-mail envoyé'); detail(el, id); } else window.location.href = r.mailto;
    } catch (er) { toast(er.message, true); }
  });
  $('#cDel')?.addEventListener('click', async () => {
    if (!(await confirmDialog('Supprimer ce contact ?', 'La fiche et ses tâches seront définitivement effacées (droit à l’effacement). Les demandes liées restent à supprimer depuis « Demandes ».', 'Supprimer'))) return;
    try { await api(`/admin/contacts/${id}`, { method: 'DELETE' }); toast('Contact supprimé'); location.hash = '#contacts'; } catch (er) { toast(er.message, true); }
  });
  $('#cMerge')?.addEventListener('click', async () => {
    const all = (await api('/admin/contacts')).contacts.filter(x => x.id !== id);
    const v = await formDialog({ title: 'Fusionner un doublon', submit: 'Fusionner', intro: `Le contact choisi sera absorbé dans « ${c.nom} » puis supprimé.`, fields: [{ name: 'dropId', label: 'Doublon à absorber', type: 'select', options: all.map(x => [x.id, `${x.nom} (${x.email || x.tel})`]) }] });
    if (!v) return;
    try { await api('/admin/contacts/fusion', { method: 'POST', body: { keepId: id, dropId: v.dropId } }); toast('Fiches fusionnées'); detail(el, id); } catch (er) { toast(er.message, true); }
  });
}

export default {
  async render(el, rest, s) {
    session = s;
    if (rest[0]) return detail(el, rest[0]);
    const r = await api('/admin/contacts');
    contacts = r.contacts; types = r.types;
    el.innerHTML = `<div class="head"><div><h1>Contacts</h1><p class="muted" id="cSummary"></p></div>
      <div class="actions-cell"><button class="btn btn--red" id="cNew">+ Nouveau contact</button>
      ${isAdmin() ? '<button class="btn btn--ghost" id="cImp">Importer</button><a class="btn btn--ghost" href="/api/admin/contacts.csv" download>Exporter en CSV</a>' : ''}</div></div>
      <form class="filters-bar" id="cFilters"><input type="search" name="q" placeholder="Nom, e-mail, téléphone…" aria-label="Rechercher"><select name="t" aria-label="Profil"><option value="">Tous les profils</option>${Object.entries(types).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></form>
      <div id="cList"></div>`;
    const f = $('#cFilters');
    f.addEventListener('input', () => { q = f.q.value; typeF = f.t.value; renderList(); });
    f.addEventListener('submit', e => e.preventDefault());
    $('#cNew').addEventListener('click', newContact);
    $('#cImp')?.addEventListener('click', importCsv);
    $('#cList').addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = `#contacts/${tr.dataset.id}`; });
    $('#cList').addEventListener('keydown', e => { if (e.key === 'Enter') { const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = `#contacts/${tr.dataset.id}`; } });
    renderList();
  },
};
