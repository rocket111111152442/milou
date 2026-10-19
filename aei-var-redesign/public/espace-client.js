// Espace client : favoris, suivi d'une demande, alertes e-mail, rendez-vous
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const F = window.AEIForms;
  const { cardHTML } = window.AEICards;
  const esc = F.esc;

  // ---------- Onglets (accessibles au clavier, mémorisés dans l'URL) ----------
  const tabs = $$('[role="tab"]');
  const select = (id, focus = false) => {
    tabs.forEach(t => {
      const on = t.getAttribute('aria-controls') === id;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
    history.replaceState(null, '', '#' + id);
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.getAttribute('aria-controls')));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) select(tabs[(i + d + tabs.length) % tabs.length].getAttribute('aria-controls'), true);
    });
  });
  const initial = location.hash.slice(1);
  select(tabs.some(t => t.getAttribute('aria-controls') === initial) ? initial : 'favoris');

  const msg = (form, text, ok = true) => {
    const el = $('.form-msg', form);
    el.innerHTML = text;
    el.className = `form-msg${form.classList.contains('client-form--grid') ? ' full' : ''} ${ok ? 'is-ok' : 'is-err'}`;
    el.hidden = false;
  };

  // ---------- Favoris ----------
  let biens = null;
  let biensReq = null;
  async function renderFavs() {
    const grid = $('#favGrid');
    const ids = window.AEIFav.read();
    if (!ids.length) {
      grid.innerHTML = '<p class="grid-empty">Vous n’avez pas encore de favori. <a href="/#biens">Découvrir nos biens</a></p>';
      return;
    }
    biensReq ||= fetch('/api/biens').then(r => (r.ok ? r.json() : Promise.reject())); // une seule requête
    try { biens = await biensReq; } catch { biensReq = null; grid.innerHTML = '<p class="grid-empty">Impossible de charger vos favoris pour le moment.</p>'; return; }
    const list = ids.map(id => biens.find(b => b.id === id)).filter(Boolean);
    const gone = ids.length - list.length;
    grid.innerHTML = list.map(cardHTML).join('') + (gone ? `<p class="grid-empty">${gone} bien${gone > 1 ? 's' : ''} de vos favoris ${gone > 1 ? 'ne sont' : 'n’est'} plus en ligne.</p>` : '');
    $$('.reveal', grid).forEach(el => el.classList.add('is-in'));
  }
  addEventListener('fav:change', renderFavs);
  renderFavs();

  // ---------- Suivi d'une demande ----------
  const STEPS = ['nouveau', 'contacte', 'rendezvous', 'termine'];
  $('#trackForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const errs = {};
    if (!/^[A-Za-z2-9]{8}$/.test(f.code.value.trim())) errs.code = 'Le code contient 8 caractères';
    if (!f.contact.value.trim()) errs.contact = 'Indiquez votre e-mail ou votre téléphone';
    if (!F.showErrors(f, errs)) return;
    const btn = $('button', f);
    btn.disabled = true;
    try {
      const res = await fetch('/api/suivi', { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'aei' }, body: JSON.stringify({ code: f.code.value.trim(), contact: f.contact.value.trim() }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      $('.form-msg', f).hidden = true;
      const at = STEPS.indexOf(d.status);
      const box = $('#trackResult');
      box.innerHTML = `
        <h2>${esc(d.type)}${d.bien ? ` · ${esc(d.bien)}` : ''}</h2>
        <p class="muted">Envoyée le ${new Date(d.createdAt).toLocaleDateString('fr-FR', { dateStyle: 'long' })} · mise à jour le ${new Date(d.updatedAt).toLocaleDateString('fr-FR', { dateStyle: 'long' })}</p>
        <ol class="steps">${['Reçue', 'Contacté(e)', 'Rendez-vous', 'Terminée'].map((s, i) => `<li class="${i <= at ? 'is-done' : ''}${i === at ? ' is-current' : ''}"><span>${i + 1}</span>${s}</li>`).join('')}</ol>
        <p>Statut actuel : <strong>${esc(d.statusLabel)}</strong>. Pour toute question, appelez l’agence.</p>`;
      box.hidden = false;
    } catch (err) {
      $('#trackResult').hidden = true;
      msg(f, esc(err.message || 'Recherche impossible'), false);
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Alertes e-mail ----------
  const params = new URLSearchParams(location.search);
  if (params.has('desinscription')) {
    const n = $('#alertNotice');
    n.textContent = params.get('desinscription') === 'ok' ? 'Vous êtes désinscrit(e) : vous ne recevrez plus cette alerte.' : 'Ce lien de désinscription n’est pas valide. Contactez l’agence si vous recevez encore des alertes.';
    n.hidden = false;
  }
  $('#alertForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (!F.showErrors(f, F.checkContact(f, { requireEmail: true, requireName: false }))) return;
    const btn = $('button[type=submit]', f);
    btn.disabled = true;
    try {
      const r = await F.submit(f, {
        type: 'alerte', email: f.email.value,
        details: { transaction: f.transaction.value, typeBien: f.typeBien.value, ville: f.ville.value, budgetMax: f.budgetMax.value, surfaceMin: f.surfaceMin.value },
      });
      msg(f, r.emailSent
        ? 'Votre alerte est créée. Un e-mail de confirmation vient de vous être envoyé.'
        : 'Votre alerte est enregistrée par l’agence. L’envoi automatique des alertes sera actif dès la mise en service de la messagerie du site.');
      f.reset();
    } catch (err) { msg(f, esc(err.message), false); } finally { btn.disabled = false; }
  });

  // ---------- Rendez-vous ----------
  const rdv = $('#rdvForm');
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  rdv.date.min = tomorrow;
  rdv.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errs = F.checkContact(rdv, { requireTel: true });
    const day = rdv.date.value ? new Date(rdv.date.value + 'T12:00') : null;
    if (!day) errs.date = 'Choisissez une date';
    else if (rdv.date.value < tomorrow) errs.date = 'Choisissez une date à partir de demain';
    else if ([0, 6].includes(day.getDay())) errs.date = 'L’agence est fermée le week-end';
    if (!F.showErrors(rdv, errs)) return;
    const btn = $('button[type=submit]', rdv);
    btn.disabled = true;
    try {
      const r = await F.submit(rdv, {
        type: 'rendezvous', nom: rdv.nom.value, tel: rdv.tel.value, email: rdv.email.value, message: rdv.message.value,
        details: { date: rdv.date.value, creneau: rdv.creneau.value, motif: rdv.motif.value },
      });
      msg(rdv, '<strong>Votre demande de rendez-vous est envoyée.</strong>' + F.confirmation(r.code, r.emailSent));
      rdv.reset();
    } catch (err) { msg(rdv, esc(err.message), false); } finally { btn.disabled = false; }
  });
})();
