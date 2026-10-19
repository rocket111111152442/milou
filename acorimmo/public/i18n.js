// Multilingue FR / EN / DE. Le français est la langue d'origine du HTML ; les textes sont traduits dans le navigateur
// d'après le dictionnaire public/i18n-dict.js (clé = texte français exact). Les pages légales restent en français :
// seule leur version française fait foi. Les titres/descriptions des biens sont ceux saisis par l'agence (champs EN/DE).
(() => {
  const LANGS = { fr: 'Français', en: 'English', de: 'Deutsch' };
  const q = new URLSearchParams(location.search).get('lang');
  let lang = 'fr';
  try {
    const saved = localStorage.getItem('site-lang');
    const nav = (navigator.language || 'fr').slice(0, 2);
    lang = LANGS[q] ? q : LANGS[saved] ? saved : LANGS[nav] ? nav : 'fr';
    if (LANGS[q]) localStorage.setItem('site-lang', q);
  } catch { lang = LANGS[q] ? q : 'fr'; }
  globalThis.SITE_LANG = lang;
  document.documentElement.lang = lang;

  const build = () => {
    const slot = document.querySelector('[data-lang-switch]');
    if (!slot) return;
    slot.innerHTML = `<label class="lang__label"><span class="sr-only">Langue</span><select class="lang__select" aria-label="Langue / Language / Sprache">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}"${k === lang ? ' selected' : ''}>${v}</option>`).join('')}</select></label>`;
    slot.querySelector('select').addEventListener('change', (e) => {
      try { localStorage.setItem('site-lang', e.target.value); } catch {}
      const u = new URL(location.href); u.searchParams.delete('lang'); location.href = u.href;
    });
  };

  const dict = () => (globalThis.SITE_DICT || {})[lang] || {};
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE']);
  const T = new WeakMap(); // texte français d'origine, pour pouvoir re-traduire

  const tr = (s, d) => {
    const t = s.trim();
    if (!t) return s;
    const hit = d[t] ?? d[t.replace(/\s+/g, ' ')];
    return hit === undefined ? s : s.replace(t, hit);
  };

  const walk = (root) => {
    if (lang === 'fr') return;
    const d = dict();
    if (root.closest?.('[data-no-i18n], .legal')) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => (n.nodeType === 1 && (SKIP.has(n.tagName) || n.hasAttribute('data-no-i18n') || n.classList.contains('legal')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = w.currentNode; n; n = w.nextNode()) {
      if (n.nodeType === 3) {
        const out = tr(n.nodeValue, d);
        if (out !== n.nodeValue) n.nodeValue = out;
      } else if (n.nodeType === 1) {
        for (const a of ATTRS) {
          const v = n.getAttribute(a);
          if (v) { const out = tr(v, d); if (out !== v) n.setAttribute(a, out); }
        }
      }
    }
    if (document.title) { const out = tr(document.title.split(' | ')[0], d); if (out !== document.title.split(' | ')[0]) document.title = document.title.replace(document.title.split(' | ')[0], out); }
  };

  const run = () => {
    build();
    if (lang === 'fr') return;
    walk(document.body);
    let busy = false;
    new MutationObserver((muts) => {
      if (busy) return;
      busy = true;
      for (const m of muts) m.addedNodes.forEach(n => { if (n.nodeType === 1) walk(n); else if (n.nodeType === 3 && n.parentElement) walk(n.parentElement); });
      busy = false;
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
