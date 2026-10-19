// Gestion des comptes de l'équipe (propriétaire et administrateurs)
import { api } from '../api.js';
import { $, esc, toast, fmtDate, modal, confirmDialog, showFieldErrors, setBusy } from '../ui.js';

let users = [];
let me;

// Le mot de passe provisoire n'est montré qu'une fois : l'administrateur le transmet à la personne
const showTemp = (email, pw) => modal({
  title: 'Mot de passe provisoire',
  html: `<p>Transmettez ce mot de passe à <strong>${esc(email)}</strong> par un moyen sûr (de vive voix, SMS). Il ne sera plus affiché ensuite. La personne devra le changer à sa première connexion.</p>
    <p class="temp-pw"><code>${esc(pw)}</code></p>`,
  actions: [{ label: 'Copier', value: 'copy' }, { label: 'J’ai noté le mot de passe', value: true, primary: true }],
}).then(async (v) => {
  if (v === 'copy') {
    try { await navigator.clipboard.writeText(pw); toast('Mot de passe copié'); } catch { toast('Copie impossible, notez-le manuellement', true); }
    return showTemp(email, pw);
  }
});

function render() {
  $('#uList').innerHTML = `<table class="table">
    <thead><tr><th>Nom</th><th>Rôle</th><th>Dernière connexion</th><th>État</th><th><span class="sr-only">Actions</span></th></tr></thead>
    <tbody>${users.map(u => {
      const editable = u.id !== me.id && u.role !== 'owner' && (me.role === 'owner' || u.role === 'agent');
      return `<tr>
        <td data-label="Nom"><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small></td>
        <td data-label="Rôle">${editable && me.role === 'owner'
          ? `<select data-role="${esc(u.id)}" aria-label="Rôle de ${esc(u.name)}"><option value="agent"${u.role === 'agent' ? ' selected' : ''}>Négociateur</option><option value="admin"${u.role === 'admin' ? ' selected' : ''}>Administrateur</option></select>`
          : esc(u.roleLabel)}</td>
        <td data-label="Dernière connexion">${u.lastLogin ? esc(fmtDate(u.lastLogin)) : '<span class="muted">Jamais</span>'}</td>
        <td data-label="État">${u.disabled ? '<span class="pill pill--muted">Désactivé</span>' : u.mustChange ? '<span class="pill pill--warn">Mot de passe provisoire</span>' : '<span class="pill pill--ok">Actif</span>'}${u.id === me.id ? ' <span class="pill">Vous</span>' : ''}</td>
        <td class="actions-cell">${editable ? `
          <button class="btn btn--ghost btn--sm" data-reset="${esc(u.id)}">Réinitialiser le mot de passe</button>
          <button class="btn btn--ghost btn--sm" data-disable="${esc(u.id)}">${u.disabled ? 'Réactiver' : 'Désactiver'}</button>
          ${me.role === 'owner' ? `<button class="btn btn--danger btn--sm" data-delete="${esc(u.id)}">Supprimer</button>` : ''}` : ''}
        </td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

async function load() {
  users = (await api('/admin/utilisateurs')).users;
  render();
}

export default {
  async render(el, _rest, session) {
    me = session.user;
    if (!['owner', 'admin'].includes(me.role)) {
      el.innerHTML = '<div class="empty">Cette page est réservée aux administrateurs.</div>';
      return;
    }
    el.innerHTML = `
      <div class="head"><div><h1>Utilisateurs</h1><p class="muted">Les comptes qui peuvent accéder à cet espace.</p></div></div>
      <div class="card">
        <h2>Ajouter un membre de l’équipe</h2>
        <form class="inline-form" id="uForm" novalidate>
          <label class="field"><span>Nom</span><input name="name" required maxlength="80" autocomplete="off"></label>
          <label class="field"><span>E-mail</span><input name="email" type="email" required maxlength="160" autocomplete="off"></label>
          <label class="field"><span>Rôle</span><select name="role"><option value="agent">Négociateur</option>${me.role === 'owner' ? '<option value="admin">Administrateur</option>' : ''}</select></label>
          <button class="btn btn--red" type="submit">Créer le compte</button>
        </form>
        <ul class="roles-help">
          <li><b>Négociateur</b> : biens et demandes (sans suppression ni export).</li>
          <li><b>Administrateur</b> : tout, y compris suppressions, export CSV, sauvegardes et comptes des négociateurs.</li>
          <li><b>Propriétaire</b> : tout, y compris les administrateurs et la restauration des biens.</li>
        </ul>
      </div>
      <div id="uList"></div>`;

    $('#uForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, btn = $('button[type=submit]', f);
      const errors = {};
      if (!f.name.value.trim()) errors.name = 'Nom obligatoire';
      if (!/^\S+@\S+\.\S+$/.test(f.email.value)) errors.email = 'E-mail invalide';
      showFieldErrors(f, errors);
      if (Object.keys(errors).length) return;
      setBusy(btn, true);
      try {
        const r = await api('/admin/utilisateurs', { method: 'POST', body: { name: f.name.value, email: f.email.value, role: f.role.value } });
        f.reset();
        await load();
        await showTemp(r.user.email, r.tempPassword);
      } catch (err) { toast(err.message, true); } finally { setBusy(btn, false); }
    });

    $('#uList').addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const u = users.find(x => x.id === (b.dataset.reset || b.dataset.disable || b.dataset.delete));
      try {
        if (b.dataset.reset) {
          if (!(await confirmDialog('Réinitialiser le mot de passe ?', `${u.name} sera déconnecté(e) et devra utiliser un nouveau mot de passe provisoire.`, 'Réinitialiser', false))) return;
          const r = await api(`/admin/utilisateurs/${u.id}`, { method: 'PATCH', body: { resetPassword: true } });
          await load();
          await showTemp(u.email, r.tempPassword);
        }
        if (b.dataset.disable) {
          await api(`/admin/utilisateurs/${u.id}`, { method: 'PATCH', body: { disabled: !u.disabled } });
          toast(u.disabled ? 'Compte réactivé' : 'Compte désactivé, la personne est déconnectée');
          await load();
        }
        if (b.dataset.delete) {
          if (!(await confirmDialog('Supprimer ce compte ?', `Le compte de ${u.name} sera supprimé définitivement.`, 'Supprimer'))) return;
          await api(`/admin/utilisateurs/${u.id}`, { method: 'DELETE' });
          toast('Compte supprimé');
          await load();
        }
      } catch (err) { toast(err.message, true); }
    });
    $('#uList').addEventListener('change', async (e) => {
      const s = e.target.closest('select[data-role]');
      if (!s) return;
      try { await api(`/admin/utilisateurs/${s.dataset.role}`, { method: 'PATCH', body: { role: s.value } }); toast('Rôle mis à jour'); await load(); }
      catch (err) { toast(err.message, true); await load(); }
    });

    await load();
  },
};
