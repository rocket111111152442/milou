// Carte d'un bien, partagée par l'accueil, la fiche bien et l'espace client
globalThis.AEICards = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BADGE_CLASS = { 'Exclusivité': 'tag--gold', 'Coup de cœur': 'tag--light' };
  // "vendu" ou "loué" : le bien n'est plus disponible
  const isClosed = (b) => b.statut === 'vendu' || b.statut === 'loue' || (!b.statut && b.vendu);
  const priceLabel = (b) => (b.prix ? `${esc(b.prix)} €${b.transaction === 'location' ? '<small>/mois</small>' : ''}` : 'Prix sur demande');

  // Titre/description dans la langue du visiteur si l'agence l'a traduit, sinon en français
  const localized = (b, field) => {
    const lang = globalThis.AEI_LANG;
    const alt = lang && lang !== 'fr' ? b[field + lang[0].toUpperCase() + lang.slice(1)] : '';
    return alt || b[field] || '';
  };

  const cardHTML = (b) => {
    const href = `/bien/${encodeURIComponent(b.id)}`;
    const titre = localized(b, 'titre');
    const closed = isClosed(b);
    const specs = [
      b.surface && `${esc(b.surface)} m²`,
      b.chambres && `${esc(b.chambres)} ch.`,
      b.terrain && `Terrain ${esc(b.terrain)} m²`,
      b.extra && esc(b.extra),
    ].filter(Boolean).map(s => `<li>${s}</li>`).join('');
    const loc = [esc(b.ville), esc(b.cp)].filter(Boolean).join(' · ');
    const alt = esc(`${titre} ${b.ville ? '– ' + b.ville : ''}`.trim());
    const photos = b.photos?.length ? b.photos : b.photo ? [b.photo] : [];
    const img = photos[0] ? `<img src="${esc(photos[0])}" alt="${alt}" loading="lazy">` : '';
    const count = photos.length > 1 ? `<span class="bien__count"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="m21 16-5-5-8 8"/></svg>${photos.length}</span>` : '';
    // Le statut « sous compromis » prime sur les étiquettes commerciales
    const badge = closed ? '' : b.statut === 'sous-compromis'
      ? '<span class="tag tag--warn">Sous compromis</span>'
      : b.badge ? `<span class="tag ${BADGE_CLASS[b.badge] || ''}">${esc(b.badge)}</span>` : '';
    const rent = b.transaction === 'location' && !closed ? '<span class="tag tag--rent">À louer</span>' : '';
    const foot = closed
      ? `<span class="bien__sold">${b.statut === 'loue' ? 'Loué' : 'Vendu'} par l'agence</span>`
      : `<strong>${priceLabel(b)}</strong><a href="${href}" class="bien__cta" aria-label="Voir le bien">→</a>`;
    const vv = b.visiteVirtuelle ? '<span class="bien__vv" title="Visite virtuelle">360°</span>' : '';
    const media = `<a href="${href}" class="bien__media" aria-label="Voir le bien : ${esc(titre)}">${img}${badge}${rent}${count}${vv}</a>`;
    const fav = globalThis.AEIFav && !closed ? globalThis.AEIFav.button(b.id, titre) : '';
    return `<article class="bien reveal${closed ? ' bien--sold' : ''}${b.statut === 'loue' ? ' bien--rented' : ''}" data-cat="${closed ? 'vendu' : esc(b.region)}" data-id="${esc(b.id)}">
      ${media}${fav}
      <div class="bien__body">
        <p class="bien__loc">${loc}</p>
        <h3><a href="${href}">${esc(titre)}</a></h3>
        <ul class="bien__specs">${specs}</ul>
        <div class="bien__foot">${foot}</div>
      </div>
    </article>`;
  };

  return { esc, cardHTML, isClosed, priceLabel, localized };
})();
