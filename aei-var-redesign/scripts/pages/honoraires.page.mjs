// Page « Honoraires » générée depuis config/agence.js (barèmes relevés sur le site actuel de l'agence)
export const title = 'Nos honoraires';
export const description = 'Barème des honoraires de transaction, location et gestion de l’agence, affiché conformément à la réglementation.';

export const body = (agence, esc) => {
  const h = agence.honoraires;
  const list = (items) => items.length ? `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '';
  const bareme = (b) => `
  <section class="bareme">
    <h2>${esc(b.agence)}</h2>
    <h3>Vente</h3>
    <table class="bareme__table"><thead><tr><th>Prix de vente</th><th>Honoraires TTC</th></tr></thead>
      <tbody>${b.vente.tranches.map(([a, b2]) => `<tr><td>${esc(a)}</td><td>${esc(b2)}</td></tr>`).join('')}</tbody></table>
    <p class="specs__note">${esc(b.vente.note)}</p>
    ${b.location.length ? `<h3>Location</h3>${list(b.location)}` : ''}
    ${b.gestion.length ? `<h3>Gestion locative</h3>${list(b.gestion)}` : ''}
  </section>`;
  return `<article class="container legal">
  <nav class="crumbs" aria-label="Fil d'Ariane"><a href="/">Accueil</a><span>›</span><span>Honoraires</span></nav>
  <h1 class="h2">Barème des honoraires</h1>
  <p class="legal__lead">Barème affiché conformément à l’arrêté du 10 janvier 2017 relatif à l’information des consommateurs par les professionnels intervenant dans une transaction immobilière. Montants exprimés toutes taxes comprises (TTC). Barèmes relevés le ${esc(h.releveLe)}.</p>
  ${h.baremes.map(bareme).join('')}
  <p>Dans chaque annonce, le prix affiché et la mention de la prise en charge des honoraires sont précisés dans la rubrique « Informations financières ».</p>
  <p class="specs__note">Barèmes à faire confirmer par l’agence avant la mise en ligne définitive.</p>
</article>`;
};
