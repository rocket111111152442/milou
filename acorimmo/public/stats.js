// Mesure d'audience sans cookie : une page vue anonyme est comptée (pas d'identifiant, pas d'adresse IP conservée).
// Désactivable à tout moment depuis la page Cookies, et ignorée si le navigateur envoie « Do Not Track ».
(() => {
  try {
    if (localStorage.getItem('site-nostats') === '1' || navigator.doNotTrack === '1') return;
  } catch { /* stockage indisponible : on mesure quand même, sans rien stocker */ }
  const send = () => fetch('/api/stats/hit', {
    method: 'POST', keepalive: true,
    headers: { 'content-type': 'application/json', 'x-requested-with': 'site' },
    body: JSON.stringify({ path: location.pathname, referrer: document.referrer, lang: globalThis.SITE_LANG || document.documentElement.lang || 'fr' }),
  }).catch(() => {});
  if (document.readyState === 'complete') send(); else addEventListener('load', send, { once: true });
})();

// Page Cookies : bouton d'opposition à la mesure d'audience
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('statsOptOut');
  if (!btn) return;
  const state = document.getElementById('statsOptOutState');
  const show = () => { let off = false; try { off = localStorage.getItem('site-nostats') === '1'; } catch {} btn.textContent = off ? 'Réactiver la mesure d’audience' : 'Désactiver la mesure d’audience sur cet appareil'; state.textContent = off ? '— Mesure désactivée sur cet appareil.' : ''; };
  btn.addEventListener('click', () => { try { localStorage.setItem('site-nostats', localStorage.getItem('site-nostats') === '1' ? '0' : '1'); } catch {} show(); });
  show();
});
