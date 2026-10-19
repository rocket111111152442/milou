// Agenda des visites : à venir, passées, compte rendu après visite
import { api } from '../api.js';
import { $, $$, esc, toast, formDialog } from '../ui.js';

let visites = [], statuts = {}, biens = [], contacts = [], team = [], session, scope = 'mine';
const today = () => new Date().toISOString().slice(0, 10);
const fr = (d) => new Date(d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

function renderList() {
  const t0 = today();
  const rows = visites.filter(v => scope === 'all' || v.assigneId === session.user.id).sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
  const up = rows.filter(v => v.date >= t0 && v.statut === 'prevue'), past = rows.filter(v => !(v.date >= t0 && v.statut === 'prevue')).reverse();
  const card = (v) => {
    const b = biens.find(x => x.id === v.bienId), c = contacts.find(x => x.id === v.contactId);
    return `<div class="task"><div style="flex:1"><strong>${esc(v.heure || '—')} · ${esc(b ? b.titre : v.lieu)}</strong><br>
      <small class="muted">${esc(fr(v.date))}${c ? ` · <a href="#contacts/${esc(c.id)}">${esc(c.nom)}</a>` : ''} · ${esc(team.find(u => u.id === v.assigneId)?.name || '')} · ${esc(statuts[v.statut])}${v.retour ? ' · ' + esc(v.retour) : ''}</small></div>
      <button class="btn btn--ghost btn--sm" data-edit="${esc(v.id)}">Modifier</button></div>`;
  };
  $('#vList').innerHTML = `<div class="card"><h2>À venir (${up.length})</h2>${up.map(card).join('') || '<p class="muted">Aucune visite prévue.</p>'}</div>
    <div class="card"><h2>Passées ou annulées</h2>${past.slice(0, 30).map(card).join('') || '<p class="muted">Aucune.</p>'}</div>`;
}

const fields = (v = {}) => [
  { name: 'bienId', label: 'Bien', type: 'select', value: v.bienId, options: [['', '— (autre lieu)'], ...biens.map(b => [b.id, `${b.titre} (${b.ville})`])] },
  { name: 'lieu', label: 'Autre lieu (si pas de bien)', value: v.lieu },
  { name: 'contactId', label: 'Contact', type: 'select', value: v.contactId, options: [['', '—'], ...contacts.map(c => [c.id, c.nom])] },
  { name: 'date', label: 'Date', type: 'date', value: v.date || today(), required: true },
  { name: 'heure', label: 'Heure', type: 'time', value: v.heure },
  { name: 'assigneId', label: 'Négociateur', type: 'select', value: v.assigneId || session.user.id, options: team.map(u => [u.id, u.name]) },
  { name: 'statut', label: 'Statut', type: 'select', value: v.statut || 'prevue', options: Object.entries(statuts) },
  { name: 'retour', label: 'Compte rendu / retour du visiteur', type: 'textarea', value: v.retour },
];

async function edit(v) {
  const r = await formDialog({ title: v ? 'Modifier la visite' : 'Nouvelle visite', fields: fields(v || {}) });
  if (!r) return;
  try {
    const { visite } = await api(v ? `/admin/visites/${v.id}` : '/admin/visites', { method: v ? 'PUT' : 'POST', body: r });
    visites = v ? visites.map(x => (x.id === v.id ? visite : x)) : [...visites, visite];
    renderList(); toast('Visite enregistrée'); window.dispatchEvent(new CustomEvent('leads:changed'));
  } catch (e) { toast(e.message, true); }
}

export default {
  async render(el, _r, s) {
    session = s;
    const [v, b, c, t] = await Promise.all([api('/admin/visites'), api('/admin/biens'), api('/admin/contacts'), api('/admin/equipe')]);
    visites = v.visites; statuts = v.statuts; biens = b.biens; contacts = c.contacts; team = t.equipe;
    el.innerHTML = `<div class="head"><div><h1>Agenda des visites</h1><p class="muted">Planifiez les visites et notez le retour des visiteurs.</p></div><button class="btn btn--red" id="vNew">+ Nouvelle visite</button></div>
      <div class="tabs-bar"><div class="seg"><button data-s="mine" class="is-active">Les miennes</button><button data-s="all">Toute l’équipe</button></div></div><div id="vList"></div>`;
    $('#vNew').addEventListener('click', () => edit(null));
    $$('[data-s]').forEach(b2 => b2.addEventListener('click', () => { scope = b2.dataset.s; $$('[data-s]').forEach(x => x.classList.toggle('is-active', x === b2)); renderList(); }));
    $('#vList').addEventListener('click', e => { const id = e.target.closest('[data-edit]')?.dataset.edit; if (id) edit(visites.find(x => x.id === id)); });
    renderList();
  },
};
