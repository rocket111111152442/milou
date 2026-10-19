// Favoris : enregistrés uniquement dans le navigateur du visiteur (aucun compte, aucune donnée envoyée).
// Fonctionnalité demandée par le visiteur lui-même : pas de consentement cookies nécessaire.
window.AEIFav = (() => {
  const KEY = 'aei-favoris';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const write = (ids) => {
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch {}
    dispatchEvent(new CustomEvent('fav:change', { detail: ids }));
  };
  const has = (id) => read().includes(id);
  const toggle = (id) => {
    const ids = read();
    const i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1); else ids.unshift(id);
    write(ids.slice(0, 100));
    return i < 0;
  };
  const button = (id, titre) => `<button type="button" class="fav${has(id) ? ' is-on' : ''}" data-fav="${id}" aria-pressed="${has(id)}" aria-label="${has(id) ? 'Retirer des favoris' : 'Ajouter aux favoris'} : ${String(titre).replace(/"/g, '&quot;')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.5-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.5-9 9-9 9z"/></svg></button>`;

  // Un seul écouteur pour tous les boutons cœur de la page
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fav]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    toggle(b.dataset.fav);
  });
  addEventListener('fav:change', () => {
    document.querySelectorAll('[data-fav]').forEach(b => {
      const on = has(b.dataset.fav);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on);
      b.setAttribute('aria-label', b.getAttribute('aria-label').replace(/^(Retirer des favoris|Ajouter aux favoris)/, on ? 'Retirer des favoris' : 'Ajouter aux favoris'));
    });
    document.querySelectorAll('[data-fav-count]').forEach(el => { const n = read().length; el.textContent = n; el.hidden = !n; });
  });
  addEventListener('DOMContentLoaded', () => dispatchEvent(new CustomEvent('fav:change')));
  return { read, has, toggle, button };
})();
