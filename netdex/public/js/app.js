import { api, state, setMe, refreshMe, $, $$, h, esc, fmt, duration, now, cardHtml, toastErr, busy, prefs, ICONS } from './core.js';
import * as V from './views.js';
import * as F from './fun.js';

// ---------- Thème ----------
window.ndApplyTheme = () => {
  const t = prefs.get('theme', 'dark');
  const light = t === 'light' || (t === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  $('meta[name=theme-color]').content = light ? '#f3f2ed' : '#111110';
};
window.ndApplyTheme();
F.applyStyle();

// ---------- Installation PWA ----------
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });
window.ndInstall = {
  available: () => !!installEvent,
  prompt: async () => { if (!installEvent) return; installEvent.prompt(); await installEvent.userChoice; installEvent = null; },
};
if ('serviceWorker' in navigator) {
  // Une nouvelle version vient de s'installer : on recharge une fois pour l'afficher tout de suite.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('/sw.js').then((r) => r.update()).catch(() => {});
}

const app = $('#app');

// ---------- Connexion / inscription ----------
const DEMO = [
  { id: 6, domain: 'youtube.com', rarity: 5, family: 'Commerce' },
  { id: 120, domain: 'twitch.tv', rarity: 4, family: 'Média' },
  { id: 17, domain: 'wikipedia.org', rarity: 5, family: 'Organisation' },
  { id: 900, domain: 'lemonde.fr', rarity: 3, family: 'Pays FR' },
  { id: 9000, domain: 'chess.com', rarity: 2, family: 'Commerce' },
];

function showAuth(mode = 'login') {
  stopShell();
  app.innerHTML = `<div class="auth"><div class="auth-box">
    <div class="auth-hero"><h1>netdex</h1>
      <p>Chaque carte est un vrai site web. Plus il est visité dans le monde, plus elle est rare.</p></div>
    <div class="fan">${DEMO.map((s) => cardHtml(s)).join('')}</div>
    <div class="panel">
      <div class="tabs"><button data-mode="login">Connexion</button><button data-mode="register">Créer un compte</button></div>
      <form data-form>
        <label class="field"><span>Pseudo</span><input type="text" name="username" autocomplete="username" required minlength="3" maxlength="20" autocapitalize="off" spellcheck="false"></label>
        <label class="field"><span>Mot de passe</span><input type="password" name="password" required minlength="${mode === 'register' ? 8 : 1}"></label>
        <button class="btn primary big" style="width:100%"></button>
        <p class="muted small center" style="margin:12px 0 0" data-hint></p>
      </form>
    </div></div></div>`;
  const form = $('[data-form]');
  const setMode = (m) => {
    mode = m;
    $$('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    $('button', form).textContent = m === 'login' ? 'Se connecter' : 'Créer mon compte';
    form.password.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    form.password.minLength = m === 'register' ? 8 : 1;
    $('[data-hint]').textContent = m === 'register' ? '3 boosters offerts à l\'inscription · aucun e-mail demandé' : '';
  };
  setMode(mode);
  $$('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    busy($('button', form), async () => {
      const me = await api('/' + mode, { username: form.username.value.trim(), password: form.password.value });
      setMe(me);
      if (!location.hash || /^#\/(login|register)$/.test(location.hash)) history.replaceState(null, '', '#/');
      startShell();
    });
  });
}

// ---------- Coquille de l'app ----------
const TABS = [
  { href: '#/', label: 'Boosters', icon: ICONS.pack, match: /^$|^\/$/ },
  { href: '#/collection', label: 'Collection', icon: ICONS.cards, match: /^\/(collection|dex|cards|forge|albums)/ },
  { href: '#/play', label: 'Jeux', icon: ICONS.play, match: /^\/(play|progress)/, badge: (c, me) => (me.user.levelUp ? 1 : 0) },
  { href: '#/market', label: 'Marché', icon: ICONS.market, match: /^\/(market|wishlist|history)/ },
  { href: '#/social', label: 'Social', icon: ICONS.social, match: /^\/(social|trade|messages|compare)/, badge: (c) => c.trades + c.friendRequests + c.messages },
  { href: '#/more', label: 'Plus', icon: ICONS.more, match: /^\/(more|top|search|settings|rules|admin|wallet|u\/)/ },
];

const ROUTES = [
  [/^\/?$/, V.viewHome],
  [/^\/collection$/, V.viewCollection],
  [/^\/dex$/, V.viewDex],
  [/^\/cards$/, V.viewCatalog],
  [/^\/admin$/, V.viewAdmin],
  [/^\/wallet$/, V.viewWallet],
  [/^\/market$/, V.viewMarket],
  [/^\/(social|trades|friends)$/, V.viewSocial],
  [/^\/trade$/, V.viewTrade],
  [/^\/u\/([^/]+)$/, V.viewProfile, ['name']],
  [/^\/top$/, V.viewTop],
  [/^\/search$/, V.viewSearch],
  [/^\/more$/, V.viewMore],
  [/^\/rules$/, V.viewRules],
  [/^\/settings$/, V.viewSettings],
  [/^\/play$/, F.viewPlay],
  [/^\/progress$/, F.viewProgress],
  [/^\/messages$/, F.viewMessages],
  [/^\/messages\/(\d+)$/, F.viewMessages, ['id']],
  [/^\/forge$/, F.viewForge],
  [/^\/wishlist$/, F.viewWishlist],
  [/^\/history$/, F.viewHistory],
  [/^\/albums$/, F.viewAlbums],
  [/^\/compare\/([^/]+)$/, F.viewCompare, ['name']],
  // Lien partagé vers une carte : accueil + fiche du site.
  [/^\/site\/(\d+)$/, async (el, ctx) => { await V.viewHome(el, ctx); V.openSite(ctx.params.id); }, ['id']],
];

let shellOn = false, timers = [], leave = [];

function startShell() {
  if (!shellOn) {
    shellOn = true;
    app.innerHTML = `
      <header class="topbar">
        <a class="logo" href="#/"><img src="/icons/icon-192.png" alt=""><span>netdex</span></a>
        <div class="top-actions">
          <a class="pill" href="#/market" title="Bits"><i class="coin"></i><span data-bits></span></a>
          <button class="icon-btn" data-bell aria-label="Notifications">${ICONS.bell}<span data-bell-dot></span></button>
        </div>
      </header>
      <nav class="tabbar">${TABS.map((t, i) => `<a href="${t.href}" data-tab="${i}">${t.icon}<span>${t.label}</span><span data-badge></span></a>`).join('')}</nav>
      <main></main>`;
    $('[data-bell]').addEventListener('click', V.openNotifications);
    timers.push(setInterval(tick, 1000));
    timers.push(setInterval(() => { if (document.visibilityState === 'visible') refreshMe().catch(() => {}); }, 30000));
  }
  renderShell();
  route();
}

function stopShell() {
  shellOn = false;
  timers.forEach(clearInterval);
  timers = [];
}

function renderShell() {
  const me = state.me;
  if (!me || !shellOn) return;
  $('[data-bits]').textContent = fmt(me.user.bits);
  $('[data-bell-dot]').innerHTML = me.counts.notifications ? `<span class="dot">${me.counts.notifications}</span>` : '';
  $$('.tabbar a').forEach((a) => {
    const t = TABS[a.dataset.tab];
    let n = t.badge ? t.badge(me.counts, me) : 0;
    if (t.href === '#/') n = me.packs.available;
    $('[data-badge]', a).innerHTML = n ? `<span class="dot">${n}</span>` : '';
  });
  // Pastille sur l'icône de l'app installée (Android/desktop compatibles).
  navigator.setAppBadge?.(me.packs.available || 0).catch?.(() => {});
  document.title = me.packs.available ? `(${me.packs.available}) Netdex` : 'Netdex';
}
document.addEventListener('nd:me', renderShell);
document.addEventListener('nd:me', () => { if (state.me) F.checkAchievements(); });

// Raccourcis clavier (et code secret).
F.initKeys({
  o: () => { if (state.me?.packs.available) V.openPackFlow('free'); },
  a: () => { if (state.me?.packs.available) V.openAllFlow(); },
  b: () => { location.hash = '#/'; }, c: () => { location.hash = '#/collection'; }, j: () => { location.hash = '#/play'; },
  m: () => { location.hash = '#/market'; }, s: () => { location.hash = '#/social'; }, t: () => { location.hash = '#/top'; },
  '/': () => { location.hash = '#/search'; }, '?': F.shortcutsHelp,
});

// Comptes à rebours partagés : tout élément [data-until] est mis à jour chaque seconde.
let refreshing = false;
function tick() {
  for (const el of $$('[data-until]')) {
    const left = Number(el.dataset.until) - now();
    el.textContent = duration(left);
    if (left <= 0 && el.hasAttribute('data-refresh') && !refreshing) {
      refreshing = true;
      el.removeAttribute('data-refresh');
      refreshMe().catch(() => {}).finally(() => { refreshing = false; });
    }
  }
}

async function route() {
  if (!shellOn) return;
  const raw = location.hash.replace(/^#/, '');
  const [path, qs = ''] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs));
  leave.forEach((fn) => fn());
  leave = [];
  $$('.tabbar a').forEach((a) => a.classList.toggle('active', TABS[a.dataset.tab].match.test(path)));
  const main = $('main');
  const el = h('<div></div>');
  main.replaceChildren(el);
  window.scrollTo(0, 0);
  const found = ROUTES.find(([re]) => re.test(path));
  if (!found) { el.innerHTML = '<div class="empty"><b>Page introuvable</b><a href="#/">Retour</a></div>'; return; }
  const [re, view, keys = []] = found;
  const m = re.exec(path);
  const params = Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
  const on = (evt, fn) => { document.addEventListener(evt, fn); leave.push(() => document.removeEventListener(evt, fn)); };
  leave.push(() => document.dispatchEvent(new CustomEvent('nd:leave')));
  if (path.startsWith('/trades')) query.tab = 'trades';
  el.innerHTML = '<div class="spinner"></div>';
  try {
    await view(el, { on, query, params, logout });
  } catch (e) {
    el.innerHTML = `<div class="empty"><b>Oups</b>${esc(e.message)}</div>`;
    toastErr(e);
  }
}
window.addEventListener('hashchange', route);

async function logout() {
  await api('/logout', {}).catch(() => {});
  state.me = null;
  navigator.clearAppBadge?.().catch?.(() => {});
  showAuth('login');
}
document.addEventListener('nd:logout', () => { if (state.me) { state.me = null; showAuth('login'); } });

// Retour sur l'app (onglet réactivé / app rouverte) : resynchroniser le chrono.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.me) refreshMe().catch(() => {}); });

// ---------- Démarrage ----------
(async () => {
  try {
    setMe(await api('/me'));
    startShell();
  } catch {
    showAuth(location.hash === '#/register' ? 'register' : 'login');
  }
})();
