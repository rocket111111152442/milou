// Mandats : registre interne de suivi (numérotation continue, jamais supprimés). Ne remplace pas le registre réglementaire.
import { api } from '../api.js';
import { $, esc, toast, fmtDate, formDialog } from '../ui.js';

let data, biens = [], contacts = [];
const fr = (d) => (d ? d.split('-').reverse().join('/') : '—');

const fields = (m = {}) => [
  { name: 'type', label: 'Type de mandat', type: 'select', value: m.type || 'simple', options: Object.entries(data.types) },
  { name: 'statut', label: 'Statut', type: 'select', value: m.statut || 'actif', options: Object.entries(data.statuts) },
  { name: 'bienId', label: 'Bien concerné', type: 'select', value: m.bienId, options: [['', '— (mandat de recherche)'], ...biens.map(b => [b.id, `${b.titre} (${b.ville})`])] },
  { name: 'contactId', label: 'Mandant (contact)', type: 'select', value: m.contactId, options: [['', '—'], ...contacts.map(c => [c.id, c.nom])] },
  { name: 'dateSignature', label: 'Date de signature', type: 'date', value: m.dateSignature || new Date().toISOString().slice(0, 10), required: true },
  { name: 'dateFin', label: 'Date de fin', type: 'date', value: m.dateFin },
  { name: 'prix', label: 'Prix du mandat (€)', value: m.prix },
  { name: 'honoraires', label: 'Honoraires', value: m.honoraires, placeholder: 'Selon barème, à la charge du vendeur' },
  { name: 'note', label: 'Note', type: 'textarea', value: m.note },
];

async function edit(m) {
  const isNew = !m || m.__new;
  const v = await formDialog({ title: isNew ? 'Nouveau mandat' : `Mandat ${m.numero}`, fields: fields(m || {}) });
  if (!v) return;
  const mandantNom = contacts.find(c => c.id === v.contactId)?.nom || m?.mandantNom || '';
  try { await api(isNew ? '/admin/mandats' : `/admin/mandats/${m.id}`, { method: isNew ? 'POST' : 'PUT', body: { ...v, mandantNom } }); toast('Mandat enregistré'); await show(); } catch (e) { toast(e.message, true); }
}

let root;
async function show() {
  data = await api('/admin/mandats');
  const late = new Set(data.aEcheance);
  const rows = [...data.mandats].sort((a, b) => b.numero.localeCompare(a.numero));
  $('#mList').innerHTML = rows.length ? `<table class="table"><thead><tr><th>N°</th><th>Type</th><th>Bien / mandant</th><th>Signé le</th><th>Fin</th><th>Statut</th></tr></thead><tbody>${rows.map(m => {
    const b = biens.find(x => x.id === m.bienId);
    return `<tr data-id="${esc(m.id)}" tabindex="0"><td data-label="N°"><strong>${esc(m.numero)}</strong></td><td data-label="Type">${esc(data.types[m.type])}</td>
    <td data-label="Bien">${esc(b ? b.titre : 'Recherche')}<small>${esc(m.mandantNom || '')}</small></td><td data-label="Signé le">${fr(m.dateSignature)}</td>
    <td data-label="Fin">${fr(m.dateFin)}${late.has(m.id) ? ' <span class="pill pill--new">À renouveler</span>' : ''}</td><td data-label="Statut"><span class="pill ${m.statut === 'actif' ? 'pill--ok' : 'pill--muted'}">${esc(data.statuts[m.statut])}</span></td></tr>`;
  }).join('')}</tbody></table>` : '<div class="empty">Aucun mandat enregistré.</div>';
  $('#mList').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) edit(data.mandats.find(m => m.id === tr.dataset.id)); };
}

export default {
  async render(el, rest) {
    root = el;
    [biens, contacts] = await Promise.all([api('/admin/biens').then(r => r.biens), api('/admin/contacts').then(r => r.contacts)]);
    el.innerHTML = `<div class="head"><div><h1>Mandats</h1><p class="muted">Suivi interne des mandats : numérotation continue, aucun mandat supprimable (annulez-le). Ce suivi ne remplace pas le registre des mandats réglementaire de l’agence ni les mandats signés.</p></div><button class="btn btn--red" id="mNew">+ Nouveau mandat</button></div><div id="mList"></div>`;
    $('#mNew').addEventListener('click', () => edit(null));
    await show();
    if (rest?.[0] === 'nouveau' && rest[1]) { history.replaceState(null, '', '#mandats'); edit({ bienId: rest[1], __new: true }); }
  },
};
