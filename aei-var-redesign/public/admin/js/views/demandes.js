// Demandes clients : liste, statut, notes internes, export CSV, suppression (droit à l'effacement)
import { api } from '../api.js';
import { $, $$, esc, toast, fmtDate, confirmDialog, setBusy, openDrawer, closeDrawer } from '../ui.js';

let leads = [];
let meta = { types: {}, statuses: {} };
let filters = { q: '', type: '', status: '' };
let session;
let team = [];
let mode = 'liste';
const nameOf = (id) => team.find(u => u.id === id)?.name || '';
const STATUS_CLASS = { nouveau: 'pill--new', contacte: 'pill--warn', rendezvous: 'pill--ok', termine: 'pill--muted' };
const ISSUE = { gagne: 'Gagnée', perdu: 'Perdue' };

const filtered = () => {
  const q = filters.q.toLowerCase();
  return leads.filter(l =>
    (!filters.type || l.type === filters.type) &&
    (!filters.status || l.status === filters.status) &&
    (!q || `${l.nom} ${l.email} ${l.tel} ${l.bienTitre} ${l.details?.ville || ''} ${l.message}`.toLowerCase().includes(q)));
};

function renderList() {
  const rows = filtered();
  const news = leads.filter(l => l.status === 'nouveau').length;
  $('#dSummary').textContent = `${leads.length} demandes · ${news} nouvelle${news > 1 ? 's' : ''}${rows.length !== leads.length ? ` · ${rows.length} affichées` : ''}`;
  const qs = new URLSearchParams(Object.entries({ type: filters.type, status: filters.status }).filter(([, v]) => v));
  $('#csvLink').href = `/api/admin/demandes.csv${qs.toString() ? '?' + qs : ''}`;
  if (mode === 'kanban') return renderKanban(rows);
  $('#dList').innerHTML = rows.length ? `
    <table class="table">
      <thead><tr><th>Date</th><th>Contact</th><th>Type</th><th>Objet</th><th>Assignée à</th><th>Statut</th></tr></thead>
      <tbody>${rows.map(l => `
        <tr data-id="${esc(l.id)}" tabindex="0" class="${l.status === 'nouveau' ? 'is-new' : ''}">
          <td data-label="Date">${esc(fmtDate(l.createdAt))}</td>
          <td data-label="Contact"><strong>${esc(l.nom || '—')}</strong><small>${esc([l.tel, l.email].filter(Boolean).join(' · '))}</small></td>
          <td data-label="Type">${esc(l.typeLabel)}</td>
          <td data-label="Objet">${esc(l.bienTitre || l.details?.ville || l.projet || (l.message || '').slice(0, 60) || '—')}</td>
          <td data-label="Assignée à">${esc(nameOf(l.assigneId)) || '<span class="muted">—</span>'}</td>
          <td data-label="Statut"><span class="pill ${STATUS_CLASS[l.status] || ''}">${esc(l.statusLabel)}</span>${l.issue ? `<span class="pill ${l.issue === 'gagne' ? 'pill--ok' : 'pill--sold'}">${ISSUE[l.issue]}</span>` : ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : `<div class="empty">${leads.length ? 'Aucune demande ne correspond à ces filtres.' : 'Aucune demande reçue pour le moment. Les demandes envoyées depuis le site (contact, estimation, visite, rendez-vous, alertes) apparaîtront ici.'}</div>`;
}

// Vue pipeline : une colonne par statut, glisser-déposer pour changer de statut
function renderKanban(rows) {
  $('#dList').innerHTML = `<div class="kanban">${Object.entries(meta.statuses).map(([k, label]) => {
    const col = rows.filter(l => l.status === k);
    return `<section class="kanban__col" data-col="${k}" aria-label="${esc(label)}"><h2>${esc(label)} <small>${col.length}</small></h2>${col.map(l => `
      <article class="kanban__card" draggable="true" data-id="${esc(l.id)}" tabindex="0">
        <strong>${esc(l.nom || l.email || '—')}</strong>
        <span>${esc(l.typeLabel)}${l.bienTitre ? ' · ' + esc(l.bienTitre.slice(0, 40)) : ''}</span>
        <small>${esc(fmtDate(l.createdAt, false))}${nameOf(l.assigneId) ? ' · ' + esc(nameOf(l.assigneId)) : ''}${l.issue ? ' · ' + ISSUE[l.issue] : ''}</small>
      </article>`).join('') || '<p class="muted">—</p>'}</section>`;
  }).join('')}</div>`;
}

const detailRow = (label, v) => (v ? `<div><dt>${label}</dt><dd>${esc(v)}</dd></div>` : '');

function renderDetail(l) {
  const d = l.details || {};
  const canDelete = ['owner', 'admin'].includes(session.user.role);
  $('#leadPanel').innerHTML = `
    <div class="drawer__head">
      <div><h2>${esc(l.nom || l.email)}</h2><p class="muted">${esc(l.typeLabel)} · reçue le ${esc(fmtDate(l.createdAt))}</p></div>
      <button type="button" class="icon-btn" data-close aria-label="Fermer">✕</button>
    </div>
    <div class="drawer__body">
      <div class="status-pick" role="group" aria-label="Statut de la demande">
        ${Object.entries(meta.statuses).map(([k, v]) => `<button type="button" data-status="${k}" class="${l.status === k ? 'is-active' : ''}" aria-pressed="${l.status === k}">${esc(v)}</button>`).join('')}
      </div>
      <div class="inline-form assign">
        <label class="field"><span>Assignée à</span><select id="assignSel"><option value="">Non assignée</option>${team.map(u => `<option value="${esc(u.id)}"${u.id === l.assigneId ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Issue</span><select id="issueSel"><option value="">En cours</option><option value="gagne"${l.issue === 'gagne' ? ' selected' : ''}>Gagnée (mandat / vente / location)</option><option value="perdu"${l.issue === 'perdu' ? ' selected' : ''}>Perdue</option></select></label>
        <label class="field" id="motifBox"${l.issue === 'perdu' ? '' : ' hidden'}><span>Motif</span><input id="motifIn" maxlength="200" value="${esc(l.motifPerte || '')}" placeholder="Prix, concurrent, projet abandonné…"></label>
      </div>
      <div class="contact-actions">
        ${l.contactId ? `<a class="btn btn--ghost btn--sm" href="#contacts/${esc(l.contactId)}">Fiche contact</a>` : ''}
        <button type="button" class="btn btn--ghost btn--sm" id="taskFromLead">+ Créer un rappel</button>
        ${l.tel ? `<a class="btn btn--ghost btn--sm" href="tel:${esc(l.tel)}">Appeler ${esc(l.tel)}</a>` : ''}
        ${l.email ? `<a class="btn btn--ghost btn--sm" href="mailto:${esc(l.email)}">Écrire à ${esc(l.email)}</a>` : ''}
      </div>
      <dl class="dl">
        ${detailRow('Projet', l.projet)}
        ${detailRow('Bien concerné', l.bienTitre)}
        ${detailRow('Type de bien', d.typeBien)}
        ${detailRow('Ville', d.ville)}
        ${detailRow('Adresse', d.adresse)}
        ${detailRow('Surface', d.surface && `${d.surface} m²`)}
        ${detailRow('Pièces', d.pieces)}
        ${detailRow('État', d.etat)}
        ${detailRow('Atouts', (d.atouts || []).join(', '))}
        ${detailRow('Date souhaitée', d.date && new Date(d.date).toLocaleDateString('fr-FR', { dateStyle: 'full' }))}
        ${detailRow('Créneau', d.creneau)}
        ${detailRow('Motif', d.motif)}
        ${l.type === 'alerte' ? detailRow('Critères', [d.transaction === 'location' ? 'Location' : 'Achat', d.typeBien, d.ville, d.budgetMax && `≤ ${Number(d.budgetMax).toLocaleString('fr-FR')} €`, d.surfaceMin && `≥ ${d.surfaceMin} m²`].filter(Boolean).join(' · ')) + detailRow('Alerte', l.alert?.active ? 'Active' : 'Désinscrit') : ''}
        ${detailRow('Code de suivi client', l.code)}
        ${detailRow('Page d’origine', l.source)}
      </dl>
      ${l.message ? `<div class="msg"><h3>Message</h3><p>${esc(l.message).replace(/\n/g, '<br>')}</p></div>` : ''}
      ${l.photos?.length ? `<div class="msg"><h3>Photos jointes (${l.photos.length})</h3><div class="lead-photos">${l.photos.map((_, i) => `<a href="/api/admin/demandes/${esc(l.id)}/photos/${i}" target="_blank" rel="noopener"><img src="/api/admin/demandes/${esc(l.id)}/photos/${i}" alt="Photo ${i + 1} jointe par le client" loading="lazy"></a>`).join('')}</div></div>` : ''}

      <div class="msg">
        <h3>Notes internes</h3>
        <ul class="notes">${(l.notes || []).map(n => `<li><p>${esc(n.text).replace(/\n/g, '<br>')}</p><small>${esc(n.by)} · ${esc(fmtDate(n.at))}</small></li>`).join('') || '<li class="muted">Aucune note.</li>'}</ul>
        <form id="noteForm" class="note-form">
          <label class="field"><span>Ajouter une note (visible uniquement par l’équipe)</span><textarea name="note" rows="3" maxlength="2000" required></textarea></label>
          <button class="btn btn--ghost btn--sm" type="submit">Ajouter la note</button>
        </form>
      </div>

      <details class="sect"><summary>Historique</summary><div class="sect__body"><ul class="history">${(l.history || []).map(h => `<li><b>${esc(fmtDate(h.at))}</b> · ${esc(h.by)} · ${esc(h.action)}</li>`).join('')}</ul>
        <p class="muted small">Consentement enregistré le ${esc(fmtDate(l.consent?.at))} : « ${esc(l.consent?.text)} »</p></div></details>
    </div>
    <div class="drawer__foot">
      ${canDelete ? '<button type="button" class="btn btn--danger" id="leadDelete">Supprimer (RGPD)</button>' : ''}
      <span class="spacer"></span>
      <button type="button" class="btn btn--ghost" data-close>Fermer</button>
    </div>`;

  const drawer = $('#leadDrawer');
  $$('[data-close]', drawer).forEach(b => b.addEventListener('click', () => closeLead()));
  $$('[data-status]', drawer).forEach(b => b.addEventListener('click', () => patch(l.id, { status: b.dataset.status }, 'Statut mis à jour')));
  $('#assignSel').addEventListener('change', e => patch(l.id, { assigneId: e.target.value }, 'Assignation enregistrée'));
  $('#issueSel').addEventListener('change', e => patch(l.id, { issue: e.target.value }, 'Issue enregistrée'));
  $('#motifIn')?.addEventListener('change', e => patch(l.id, { motifPerte: e.target.value }, 'Motif enregistré'));
  $('#taskFromLead').addEventListener('click', async () => {
    const d = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    try { await api('/admin/taches', { method: 'POST', body: { titre: `Relancer ${l.nom || l.email} (${l.typeLabel})`, echeance: d, leadId: l.id, contactId: l.contactId || '', assigneId: l.assigneId || session.user.id } }); toast(`Rappel créé pour le ${d.split('-').reverse().join('/')}`); } catch (err) { toast(err.message, true); }
  });
  $('#noteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button', e.target);
    setBusy(btn, true);
    await patch(l.id, { note: e.target.note.value }, 'Note ajoutée');
    setBusy(btn, false);
  });
  $('#leadDelete')?.addEventListener('click', async () => {
    if (!(await confirmDialog('Supprimer cette demande ?', 'La demande, ses notes et ses photos seront définitivement effacées. À utiliser notamment lorsqu’une personne demande la suppression de ses données.', 'Supprimer définitivement'))) return;
    try {
      await api(`/admin/demandes/${l.id}`, { method: 'DELETE' });
      leads = leads.filter(x => x.id !== l.id);
      closeLead();
      renderList();
      toast('Demande supprimée');
      window.dispatchEvent(new CustomEvent('leads:changed'));
    } catch (err) { toast(err.message, true); }
  });
}

async function patch(id, body, msg) {
  try {
    const { lead } = await api(`/admin/demandes/${id}`, { method: 'PATCH', body });
    leads = leads.map(x => (x.id === id ? lead : x));
    renderDetail(lead);
    renderList();
    toast(msg);
    window.dispatchEvent(new CustomEvent('leads:changed'));
  } catch (err) { toast(err.message, true); }
}

function openLead(id) {
  const l = leads.find(x => x.id === id);
  if (!l) return;
  renderDetail(l);
  openDrawer($('#leadDrawer'));
  if (location.hash !== `#demandes/${id}`) history.replaceState(null, '', `#demandes/${id}`);
}
function closeLead() {
  closeDrawer($('#leadDrawer'));
  history.replaceState(null, '', '#demandes');
}

export default {
  async render(el, rest, s) {
    session = s;
    const r = await api('/admin/demandes');
    leads = r.leads;
    meta = r;
    team = (await api('/admin/equipe').catch(() => ({ equipe: [] }))).equipe;
    const canExport = ['owner', 'admin'].includes(session.user.role);
    el.innerHTML = `
      <div class="head">
        <div><h1>Demandes</h1><p class="muted" id="dSummary"></p></div>
        <div class="seg" role="group" aria-label="Affichage"><button type="button" data-mode="liste" class="${mode === 'liste' ? 'is-active' : ''}">Liste</button><button type="button" data-mode="kanban" class="${mode === 'kanban' ? 'is-active' : ''}">Pipeline</button></div>
        ${canExport ? '<a class="btn btn--ghost" id="csvLink" href="/api/admin/demandes.csv" download>Exporter en CSV</a>' : '<a id="csvLink" hidden></a>'}
      </div>
      <form class="filters-bar" id="dFilters" role="search">
        <input type="search" name="q" placeholder="Nom, e-mail, téléphone, ville…" aria-label="Rechercher" value="${esc(filters.q)}">
        <select name="type" aria-label="Type"><option value="">Tous les types</option>${Object.entries(meta.types).map(([k, v]) => `<option value="${k}"${k === filters.type ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>
        <select name="status" aria-label="Statut"><option value="">Tous les statuts</option>${Object.entries(meta.statuses).map(([k, v]) => `<option value="${k}"${k === filters.status ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>
      </form>
      <div id="dList"></div>`;
    const f = $('#dFilters');
    f.addEventListener('input', () => { filters = Object.fromEntries(new FormData(f)); renderList(); });
    f.addEventListener('submit', e => e.preventDefault());
    $$('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; $$('[data-mode]').forEach(x => x.classList.toggle('is-active', x === b)); renderList(); }));
    const list = $('#dList');
    list.addEventListener('click', e => { const c = e.target.closest('.kanban__card'); if (c) openLead(c.dataset.id); });
    list.addEventListener('dragstart', e => { const c = e.target.closest('.kanban__card'); if (c) e.dataTransfer.setData('text/plain', c.dataset.id); });
    list.addEventListener('dragover', e => { if (e.target.closest('.kanban__col')) e.preventDefault(); });
    list.addEventListener('drop', async e => {
      const col = e.target.closest('.kanban__col'); if (!col) return;
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain'), l = leads.find(x => x.id === id);
      if (l && l.status !== col.dataset.col) await patch(id, { status: col.dataset.col }, 'Statut mis à jour');
    });
    list.addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) openLead(tr.dataset.id); });
    list.addEventListener('keydown', e => { if (e.key === 'Enter') { const tr = e.target.closest('tr[data-id]'); if (tr) openLead(tr.dataset.id); } });
    renderList();
    if (rest[0]) openLead(rest[0]);
  },
  leave() { closeDrawer($('#leadDrawer')); },
};
