// Briques partagées : API, état, rendu des cartes, modales, toasts.
export const RARITY = [
  { id: 0, name: 'Commune' }, { id: 1, name: 'Peu commune' }, { id: 2, name: 'Rare' },
  { id: 3, name: 'Épique' }, { id: 4, name: 'Légendaire' }, { id: 5, name: 'Mythique' },
];
export const VALUES = [1, 3, 10, 40, 200, 1500];

export const state = { me: null, clockOffset: 0 };
export const now = () => Date.now() + state.clockOffset;

export async function api(path, body) {
  const opts = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  let res;
  try { res = await fetch('/api' + path, opts); } catch { throw new Error('Connexion impossible. Vérifie ton réseau.'); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') { document.dispatchEvent(new CustomEvent('nd:logout')); }
  if (!res.ok) throw new Error(data.error || 'Erreur ' + res.status);
  return data;
}

export function setMe(me) {
  state.me = me;
  state.clockOffset = me.serverTime - Date.now();
  document.dispatchEvent(new CustomEvent('nd:me'));
}
export async function refreshMe() { setMe(await api('/me')); return state.me; }

// ---------- utilitaires ----------
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

export function duration(ms) {
  if (ms <= 0) return '0:00';
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d) return `${d}j ${hh}h`;
  if (hh) return `${hh}h ${String(m).padStart(2, '0')}m`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
export function ago(t) {
  const s = Math.max(0, (now() - t) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}
export const isOnline = (lastSeen) => now() - lastSeen < 5 * 60_000;

// Puissance d'une carte : 1000 pour le n°1 mondial, ~0 pour le millionième.
export const power = (rank) => Math.max(1, Math.round(1000 * (1 - Math.log10(rank) / 6)));
export const siteName = (domain) => domain.split('.')[0].replace(/-/g, ' ');
export const favicon = (domain, size = 64) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;

// ---------- rendu des cartes ----------
export function cardHtml(site, opts = {}) {
  const { count = 0, holo = false, isNew = false, locked = false, selected = false, missing = false, attrs = '' } = opts;
  const r = site.rarity;
  return `<div class="card r-${r}${holo ? ' holo' : ''}${selected ? ' selected' : ''}${missing ? ' missing' : ''}" data-site="${site.id}" ${attrs}>
    <div class="c-bar"><i></i><i></i><i></i><span class="rk">#${site.id}</span></div>
    <div class="c-url">${esc(site.domain)}</div>
    <div class="c-art"><img class="fav" src="${favicon(site.domain)}" alt="" loading="lazy" decoding="async" data-l="${esc(site.domain[0])}"></div>
    <div class="c-name">${esc(siteName(site.domain))}</div>
    <div class="c-foot"><span class="rar">${RARITY[r].name}</span><span>${power(site.id)}</span></div>
    ${count > 1 ? `<span class="count">×${count}</span>` : ''}
    ${isNew ? '<span class="badge-new">NEW</span>' : ''}
    ${locked ? '<span class="badge-lock">en vente</span>' : ''}
  </div>`;
}
export function unknownCardHtml(site) {
  return `<div class="card unknown" data-site="${site.id}">
    <div class="c-bar"><i></i><i></i><i></i><span class="rk">#${site.id}</span></div>
    <div class="c-url">???</div>
    <div class="c-art">?</div><div class="c-name">Non découvert</div><div class="c-foot"><span></span><span></span></div>
  </div>`;
}

// Icône de secours si le favicon ne charge pas (CSP interdit les onerror inline).
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName === 'IMG' && img.classList.contains('fav')) {
    img.replaceWith(h(`<div class="letter">${esc(img.dataset.l || '?')}</div>`));
  }
}, true);

// ---------- toasts & modales ----------
export function toast(msg, kind = '') {
  let box = $('.toasts');
  if (!box) { box = h('<div class="toasts"></div>'); document.body.append(box); }
  const t = h(`<div class="toast ${kind}">${esc(msg)}</div>`);
  box.append(t);
  setTimeout(() => t.remove(), kind === 'err' ? 4500 : 2800);
}
export const toastErr = (e) => toast(e.message || String(e), 'err');

export function modal(title, bodyHtml, { onMount, onClose, wide } = {}) {
  const back = h(`<div class="modal-back"><div class="modal"${wide ? ' style="max-width:900px"' : ''}>
    <div class="modal-head"><h3>${title}</h3><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    <div class="modal-body"></div></div></div>`);
  const body = $('.modal-body', back);
  body.innerHTML = bodyHtml;
  const close = () => { if (!back.isConnected) return; back.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(back);
  onMount?.(body, close);
  return close;
}

export function confirmDialog(title, text, okLabel = 'Confirmer', danger = false) {
  return new Promise((resolve) => {
    let ok = false;
    modal(esc(title), `<p>${text}</p><div class="row" style="justify-content:flex-end;margin-top:16px">
      <button class="btn" data-close>Annuler</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(okLabel)}</button></div>`, {
      onMount: (b, close) => $('[data-ok]', b).addEventListener('click', () => { ok = true; close(); }),
      onClose: () => resolve(ok),
    });
  });
}

// Bouton qui se désactive pendant l'appel et affiche les erreurs.
export async function busy(btn, fn) {
  if (btn.disabled) return;
  btn.disabled = true;
  try { return await fn(); } catch (e) { toastErr(e); } finally { btn.disabled = false; }
}

export const prefs = {
  get(k, d) { try { const v = localStorage.getItem('nd.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('nd.' + k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
};

export const ICONS = {
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  pack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6"/><path d="m12 15 1 2h-2z"/></svg>',
  cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="12" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/></svg>',
  market: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10"/><path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/></svg>',
  social: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/></svg>',
};
