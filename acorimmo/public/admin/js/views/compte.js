// Mon compte : informations et changement de mot de passe
import { api } from '../api.js';
import { $, esc, toast, showFieldErrors, setBusy } from '../ui.js';

export default {
  async render(el, _rest, session) {
    const u = session.user;
    el.innerHTML = `
      <div class="head"><div><h1>Mon compte</h1><p class="muted">${esc(u.name)} · ${esc(u.roleLabel)} · ${esc(u.email)}</p></div></div>
      <section class="card card--narrow">
        <h2>Changer mon mot de passe</h2>
        <form id="pwForm" class="stack-form" novalidate>
          <label class="field"><span>Mot de passe actuel</span><input type="password" name="current" autocomplete="current-password" required></label>
          <label class="field"><span>Nouveau mot de passe</span><input type="password" name="next" autocomplete="new-password" required minlength="10"></label>
          <label class="field"><span>Confirmation</span><input type="password" name="confirm" autocomplete="new-password" required></label>
          <p class="muted small">Au moins 10 caractères, avec des lettres et des chiffres. Vos autres sessions ouvertes seront déconnectées.</p>
          <button class="btn btn--red" type="submit">Enregistrer</button>
        </form>
      </section>`;
    $('#pwForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, btn = $('button', f);
      const errors = {};
      if (!f.current.value) errors.current = 'Obligatoire';
      if (f.next.value.length < 10) errors.next = '10 caractères minimum';
      if (f.next.value !== f.confirm.value) errors.confirm = 'Les mots de passe ne correspondent pas';
      showFieldErrors(f, errors);
      if (Object.keys(errors).length) return;
      setBusy(btn, true);
      try {
        const r = await api('/auth/password', { method: 'POST', body: { current: f.current.value, next: f.next.value } });
        session.user = r.user;
        f.reset();
        toast('Mot de passe modifié');
      } catch (err) { toast(err.message, true); } finally { setBusy(btn, false); }
    });
  },
};
