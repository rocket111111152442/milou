// Carte d'un bien, partagée par l'accueil, la fiche bien et l'espace client
window.AEICards = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BADGE_CLASS = { 'Exclusivité': 'tag--gold', 'Coup de cœur': 'tag--light' };
  // "vendu" ou "loué" : le bien n'est plus disponible
  const isClosed = (b) => b.statut === 'vendu' || b.statut === 'loue' || (!b.statut && b.vendu);
  const priceLabel = (b) => (b.prix ? `${esc(b.prix)} €${b.transaction === 'location' ? '<small>/mois</small>' : ''}` : 'Prix sur demande');

  const cardHTML = (b) => {
    const href = `bien.html?id=${encodeURIComponent(b.id)}`;
    const closed = isClosed(b);
    const specs = [
      b.surface && `${esc(b.surface)} m²`,
      b.chambres && `${esc(b.chambres)} ch.`,
      b.terrain && `Terrain ${esc(b.terrain)} m²`,
      b.extra && esc(b.extra),
    ].filter(Boolean).map(s => `<li>${s}</li>`).join('');
    const loc = [esc(b.ville), esc(b.cp)].filter(Boolean).join(' · ');
    const alt = esc(`${b.titre} ${b.ville ? 'à ' + b.ville : ''}`.trim());
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
    const media = `<a href="${href}" class="bien__media" aria-label="Voir le bien : ${esc(b.titre)}">${img}${badge}${rent}${count}</a>`;
    const fav = window.AEIFav && !closed ? window.AEIFav.button(b.id, b.titre) : '';
    return `<article class="bien reveal${closed ? ' bien--sold' : ''}${b.statut === 'loue' ? ' bien--rented' : ''}" data-cat="${closed ? 'vendu' : esc(b.region)}" data-id="${esc(b.id)}">
      ${media}${fav}
      <div class="bien__body">
        <p class="bien__loc">${loc}</p>
        <h3><a href="${href}">${esc(b.titre)}</a></h3>
        <ul class="bien__specs">${specs}</ul>
        <div class="bien__foot">${foot}</div>
      </div>
    </article>`;
  };

  return { esc, cardHTML, isClosed, priceLabel };
})();
