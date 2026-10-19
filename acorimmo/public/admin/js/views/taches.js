// Tâches et rappels : à faire, en retard, faites ; chacun voit les siennes par défaut
import { api } from '../api.js';
import { $, $$, esc, toast, formDialog } from '../ui.js';

let tasks = [], team = [], contacts = [], session, scope = 'mine', showDone = false;
const today = () => new Date().toISOString().slice(0, 10);
const nameOf = (id) => team.find(u => u.id === id)?.name || '—';

function renderList() {
  const t0 = today();
  const rows = tasks.filter(t => (showDone || !t.fait) && (scope === 'all' || t.assigneId === session.user.id))
    .sort((a, b) => (a.fait - b.fait) || (a.echeance || '9999').localeCompare(b.echeance || '9999'));
  $('#tList').innerHTML = rows.length ? rows.map(t => {
    const late = !t.fait && t.echeance && t.echeance < t0;
    const c = contacts.find(x => x.id === t.contactId);
    return `<div class="task${late ? ' is-late' : ''}${t.fait ? ' is-done' : ''}">
      <input type="checkbox" data-done="${esc(t.id)}" ${t.fait ? 'checked' : ''} aria-label="Marquer comme faite">
      <div style="flex:1"><strong>${esc(t.titre)}</strong><br><small class="muted">${t.echeance ? esc(t.echeance.split('-').reverse().join('/')) + (late ? ' · en retard' : '') : 'Sans échéance'} · ${esc(nameOf(t.assigneId))}${c ? ` · <a href="#contacts/${esc(c.id)}">${esc(c.nom)}</a>` : ''}${t.leadId ? ` · <a href="#demandes/${esc(t.leadId)}">demande</a>` : ''}</small></div>
      <button class="btn btn--ghost btn--sm" data-del="${esc(t.id)}" aria-label="Supprimer la tâche">✕</button></div>`;
  }).join('') : '<div class="empty">Aucune tâche à afficher.</div>';
}

async function add() {
  const v = await formDialog({ title: 'Nouvelle tâche', fields: [
    { name: 'titre', label: 'À faire', required: true },
    { name: 'echeance', label: 'Échéance', type: 'date', value: today() },
    { name: 'assigneId', label: 'Pour', type: 'select', value: session.user.id, options: team.map(u => [u.id, u.name]) },
    { name: 'contactId', label: 'Contact lié', type: 'select', options: [['', '—'], ...contacts.map(c => [c.id, c.nom])] },
  ] });
  if (!v) return;
  try { const { tache } = await api('/admin/taches', { method: 'POST', body: v }); tasks.push(tache); renderList(); window.dispatchEvent(new CustomEvent('leads:changed')); } catch (e) { toast(e.message, true); }
}

export default {
  async render(el, _r, s) {
    session = s;
    [tasks, team, contacts] = await Promise.all([api('/admin/taches').then(r => r.taches), api('/admin/equipe').then(r => r.equipe), api('/admin/contacts').then(r => r.contacts)]);
    el.innerHTML = `<div class="head"><div><h1>Tâches</h1><p class="muted">Rappels et suivis. Un résumé des tâches en retard est envoyé chaque matin par e-mail (si l’envoi d’e-mails est configuré).</p></div><button class="btn btn--red" id="tNew">+ Nouvelle tâche</button></div>
      <div class="tabs-bar"><div class="seg"><button data-s="mine" class="is-active">Les miennes</button><button data-s="all">Toute l’équipe</button></div>
      <label class="check"><input type="checkbox" id="tDone"> Afficher les tâches faites</label></div><div class="card" id="tList"></div>`;
    $('#tNew').addEventListener('click', add);
    $$('[data-s]').forEach(b => b.addEventListener('click', () => { scope = b.dataset.s; $$('[data-s]').forEach(x => x.classList.toggle('is-active', x === b)); renderList(); }));
    $('#tDone').addEventListener('change', e => { showDone = e.target.checked; renderList(); });
    $('#tList').addEventListener('change', async e => {
      const id = e.target.dataset.done; if (!id) return;
      try { const { tache } = await api(`/admin/taches/${id}`, { method: 'PUT', body: { ...tasks.find(t => t.id === id), fait: e.target.checked } }); tasks = tasks.map(t => (t.id === id ? tache : t)); renderList(); window.dispatchEvent(new CustomEvent('leads:changed')); } catch (er) { toast(er.message, true); }
    });
    $('#tList').addEventListener('click', async e => {
      const id = e.target.closest('[data-del]')?.dataset.del; if (!id) return;
      try { await api(`/admin/taches/${id}`, { method: 'DELETE' }); tasks = tasks.filter(t => t.id !== id); renderList(); window.dispatchEvent(new CustomEvent('leads:changed')); } catch (er) { toast(er.message, true); }
    });
    renderList();
  },
};
