// Page « Nos agences » générée depuis config/agence.js
export const title = 'Nos agences';
export const description = 'Les agences du réseau : Six-Fours-les-Plages, Saint-Maximin et Loiret. Adresses, téléphones et contacts.';

export const body = (agence, esc) => `<article class="container legal">
  <nav class="crumbs" aria-label="Fil d'Ariane"><a href="/">Accueil</a><span>›</span><span>Nos agences</span></nav>
  <h1 class="h2">Nos agences</h1>
  <div class="agences">
  ${agence.agences.map(a => `<section class="agence-card">
    <h2>${esc(a.nom)}${a.siege ? ' <small class="tag">Agence principale</small>' : ''}</h2>
    <p>${esc(a.description || '')}</p>
    <ul>
      ${a.adresse ? `<li>${esc(a.adresse)}, ${esc(a.codePostal)} ${esc(a.ville)}</li>` : `<li>${esc(a.codePostal)} ${esc(a.ville)}</li>`}
      ${a.responsable ? `<li>Responsable : ${esc(a.responsable)}</li>` : ''}
      ${a.telephone ? `<li><a href="tel:${esc(a.telephone.replace(/\s/g, ''))}">${esc(a.telephone)}</a></li>` : ''}
      ${a.email ? `<li><a href="mailto:${esc(a.email)}">${esc(a.email)}</a></li>` : ''}
      ${a.site ? `<li><a href="${esc(a.site)}" target="_blank" rel="noopener">${esc(a.site.replace('https://', ''))} ↗</a></li>` : ''}
    </ul>
  </section>`).join('')}
  </div>
</article>`;
