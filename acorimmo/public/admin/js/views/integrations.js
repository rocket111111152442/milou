// État des services externes, API de synchronisation et sauvegardes
import { api } from '../api.js';
import { $, esc, toast, confirmDialog } from '../ui.js';

const state = (ok, okLabel = 'Configuré', koLabel = 'À connecter') =>
  `<span class="pill ${ok ? 'pill--ok' : 'pill--warn'}">${ok ? okLabel : koLabel}</span>`;

export default {
  async render(el, _rest, session) {
    const r = await api('/admin/integrations');
    const admin = ['owner', 'admin'].includes(session.user.role);
    const owner = session.user.role === 'owner';
    el.innerHTML = `
      <div class="head"><div><h1>Intégrations &amp; sauvegardes</h1><p class="muted">Ce qui est branché, ce qui reste à connecter.</p></div></div>
      <div class="dash-grid">
        <section class="card">
          <h2>Envoi d’e-mails ${state(r.email.configured)}</h2>
          <p>Accusés de réception aux clients, notification de l’agence à chaque demande, mot de passe oublié, alertes.</p>
          <p class="muted small">Service prévu : ${esc(r.email.provider)}. Variables à définir dans Vercel : ${r.email.variables.map(v => `<code>${esc(v)}</code>`).join(', ')}. L’adresse d’expédition doit appartenir à un domaine vérifié chez le prestataire.</p>
          ${r.email.configured ? '' : '<p class="note">Tant que ce n’est pas configuré, les demandes sont bien enregistrées ici, mais aucun e-mail ne part.</p>'}
        </section>
        <section class="card">
          <h2>Logiciel de transaction ${state(false)}</h2>
          <p>${esc(r.logiciel.note)}</p>
          <p class="muted small">Une API générique est prête pour recevoir les annonces : <code>${esc(r.syncApi.endpoint)}</code> ${state(r.syncApi.configured, 'Clé définie', 'Clé absente')}. Documentation : <code>${esc(r.syncApi.doc)}</code>.</p>
        </section>
        <section class="card">
          <h2>Tâche quotidienne ${state(r.cron.configured, 'Active', 'Inactive')}</h2>
          <p>Chaque nuit : sauvegarde complète, nettoyage des fichiers temporaires, envoi des alertes e-mail, suppression des demandes de plus de 3 ans.</p>
          <p class="muted small">Nécessite la variable <code>CRON_SECRET</code>.</p>
        </section>
        <section class="card">
          <h2>Stockage</h2>
          <p>${esc(r.stockage)}</p>
          <p class="muted small">Les données des clients ne sont jamais accessibles publiquement.</p>
        </section>
        <section class="card card--wide">
          <h2>Sauvegardes</h2>
          ${r.sauvegardes.length ? `<ul class="backups">${r.sauvegardes.map(b => `<li>${esc(new Date(b.date).toLocaleDateString('fr-FR', { dateStyle: 'full' }))} <span class="muted">· ${Math.round(b.size / 1024)} Ko</span></li>`).join('')}</ul>` : '<p class="muted">Aucune sauvegarde automatique pour le moment (la première a lieu la nuit suivant l’activation).</p>'}
          <div class="row-actions">
            ${admin ? '<a class="btn btn--ghost" href="/api/admin/sauvegarde" download>Télécharger une sauvegarde complète</a>' : ''}
            ${owner ? '<label class="btn btn--ghost">Restaurer les biens depuis un fichier<input type="file" id="restoreFile" accept="application/json" hidden></label>' : ''}
          </div>
          <p class="muted small">La sauvegarde contient les biens, les demandes et la liste des comptes (sans les mots de passe). Conservez-la dans un endroit sûr : elle contient des données personnelles.</p>
        </section>
      </div>`;

    $('#restoreFile')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const list = Array.isArray(data) ? data : data.biens;
        if (!Array.isArray(list)) throw new Error('Ce fichier ne contient pas de liste de biens');
        if (!(await confirmDialog('Restaurer les biens ?', `Les ${list.length} biens du fichier remplaceront TOUS les biens actuels. Les demandes et les comptes ne sont pas modifiés.`, 'Restaurer'))) return;
        const r = await api('/admin/sauvegarde/biens', { method: 'POST', body: { biens: list } });
        toast(`${r.count} biens restaurés`);
      } catch (err) { toast(err.message, true); } finally { e.target.value = ''; }
    });
  },
};
