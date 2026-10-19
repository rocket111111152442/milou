// Démarrage de l'admin : authentification puis navigation par onglets (#biens, #demandes…)
import { api } from './api.js';
import { $, $$, esc, toast, setBusy } from './ui.js';
import dashboard from './views/dashboard.js';
import biens from './views/biens.js';
import demandes from './views/demandes.js';
import utilisateurs from './views/utilisateurs.js';
import integrations from './views/integrations.js';
import compte from './views/compte.js';
import contacts from './views/contacts.js';
import taches from './views/taches.js';
import mandats from './views/mandats.js';
import rapports from './views/rapports.js';
import contenu from './views/contenu.js';

const VIEWS = { 'tableau-de-bord': dashboard, biens, demandes, contacts, taches, mandats, rapports, contenu, utilisateurs, integrations, compte };
export const session = { user: null, emailEnabled: false };

// ---------- Écrans de connexion ----------
const AUTH_VIEWS = ['loginForm', 'forgotForm', 'resetForm', 'mustChangeForm'];
function showAuth(id) {
  $('#app').hidden = true;
  $('#auth').hidden = false;
  AUTH_VIEWS.forEach(v => { $('#' + v).hidden = v !== id; });
  const f = $('#' + id);
  $$('.error, .ok', f).forEach(e => { e.hidden = true; });
  setTimeout(() => f.querySelector('input')?.focus(), 50);
}
const formError = (form, msg) => { const e = $('.error', form); e.textContent = msg; e.hidden = !msg; };

$$('[data-auth]').forEach(b => b.addEventListener('click', () => showAuth(b.dataset.auth === 'forgot' ? 'forgotForm' : 'loginForm')));

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, btn = $('button[type=submit]', f);
  if (!f.email.value || !f.password.value) return formError(f, 'Saisissez votre e-mail et votre mot de passe.');
  setBusy(btn, true, 'Connexion…');
  try {
    const { user } = await api('/auth/login', { method: 'POST', body: { email: f.email.value, password: f.password.value } });
    f.password.value = '';
    await enter(user);
  } catch (err) { formError(f, err.message); } finally { setBusy(btn, false); }
});

$('#forgotForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, btn = $('button[type=submit]', f);
  setBusy(btn, true);
  try {
    const r = await api('/auth/forgot', { method: 'POST', body: { email: f.email.value } });
    const ok = $('.ok', f);
    ok.textContent = r.message;
    ok.hidden = false;
    formError(f, '');
  } catch (err) { formError(f, err.message); } finally { setBusy(btn, false); }
});

$('#resetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, btn = $('button[type=submit]', f);
  if (f.password.value !== f.confirm.value) return formError(f, 'Les deux mots de passe ne correspondent pas.');
  setBusy(btn, true);
  try {
    await api('/auth/reset', { method: 'POST', body: { token: f.dataset.token, password: f.password.value } });
    history.replaceState(null, '', '/admin/');
    showAuth('loginForm');
    toast('Mot de passe modifié. Vous pouvez vous connecter.');
  } catch (err) { formError(f, err.message); } finally { setBusy(btn, false); }
});

$('#mustChangeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, btn = $('button[type=submit]', f);
  if (f.next.value !== f.confirm.value) return formError(f, 'Les deux mots de passe ne correspondent pas.');
  setBusy(btn, true);
  try {
    const { user } = await api('/auth/password', { method: 'POST', body: { current: f.current.value, next: f.next.value } });
    f.reset();
    await enter(user);
    toast('Mot de passe enregistré.');
  } catch (err) { formError(f, err.message); } finally { setBusy(btn, false); }
});

$('#logout').addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  session.user = null;
  showAuth('loginForm');
});

window.addEventListener('auth:expired', () => {
  if (!session.user) return;
  session.user = null;
  showAuth('loginForm');
  formError($('#loginForm'), 'Votre session a expiré, reconnectez-vous.');
});

// ---------- Application ----------
async function enter(user) {
  session.user = user;
  if (user.mustChange) return showAuth('mustChangeForm');
  $('#auth').hidden = true;
  $('#app').hidden = false;
  $('#whoami').innerHTML = `${esc(user.name)}<small>${esc(user.roleLabel)} · ${esc(user.email)}</small>`;
  $$('[data-roles]').forEach(a => { a.hidden = !a.dataset.roles.split(',').includes(user.role); });
  if (!location.hash || location.hash.startsWith('#reset=')) location.hash = '#tableau-de-bord';
  else route();
  refreshNewCount();
}

let current = null;
async function route() {
  if (!session.user || session.user.mustChange) return;
  const [name, ...rest] = location.hash.slice(1).split('/');
  const key = VIEWS[name] ? name : 'tableau-de-bord';
  $$('.side__nav a').forEach(a => a.classList.toggle('is-current', a.dataset.nav === key));
  document.body.classList.remove('side-open');
  const el = $('#view');
  current?.leave?.();
  current = VIEWS[key];
  el.innerHTML = '<div class="loading">Chargement…</div>';
  try {
    await current.render(el, rest, session);
  } catch (err) {
    if (err.status !== 401) el.innerHTML = `<div class="empty">Impossible d'afficher cette page : ${esc(err.message)}</div>`;
  }
  el.focus({ preventScroll: true });
}
addEventListener('hashchange', route);

export async function refreshNewCount() {
  try {
    const { demandes } = await api('/admin/stats');
    const b = $('#newCount');
    b.textContent = demandes.nouvelles;
    b.hidden = !demandes.nouvelles;
    const a = await api('/admin/alertes');
    const t = $('#taskCount');
    t.textContent = a.tachesEnRetard;
    t.hidden = !a.tachesEnRetard;
  } catch {}
}
setInterval(() => { if (session.user && !document.hidden) refreshNewCount(); }, 60000);
window.addEventListener('leads:changed', refreshNewCount);

$('#menuBtn').addEventListener('click', () => document.body.classList.toggle('side-open'));
$('#sideBackdrop').addEventListener('click', () => document.body.classList.remove('side-open'));

// ---------- Démarrage ----------
(async () => {
  if (location.hash.startsWith('#reset=')) {
    $('#resetForm').dataset.token = location.hash.slice(7);
    return showAuth('resetForm');
  }
  try {
    const me = await api('/auth/me');
    session.emailEnabled = me.emailEnabled;
    await enter(me.user);
  } catch {
    showAuth('loginForm');
  }
})();
