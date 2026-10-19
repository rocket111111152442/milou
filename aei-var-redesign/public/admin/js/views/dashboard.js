// Tableau de bord : chiffres clés, demandes par semaine, répartitions, dernières demandes
import { api } from '../api.js';
import { $, esc, fmtDate, fmtNum } from '../ui.js';

const tile = (label, value, sub = '', href = '') => `
  <${href ? `a href="${href}"` : 'div'} class="tile">
    <span class="tile__label">${esc(label)}</span>
    <strong class="tile__value">${esc(value)}</strong>
    ${sub ? `<span class="tile__sub">${esc(sub)}</span>` : ''}
  </${href ? 'a' : 'div'}>`;

// Barres verticales, une seule série : pas de légende, le titre la nomme ; info-bulle au survol ; vue tableau
function weeklyChart(weeks) {
  const max = Math.max(1, ...weeks.map(w => w.count));
  const empty = weeks.every(w => !w.count);
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max];
  const label = (w) => `Semaine du ${new Date(w.start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  return `
    <div class="chart" role="img" aria-label="Demandes reçues par semaine sur les 12 dernières semaines">
      ${empty ? '<p class="chart__empty">Aucune demande reçue sur cette période.</p>' : ''}
      <div class="chart__grid">${ticks.map(t => `<span style="bottom:${(t / max) * 100}%"><em>${t}</em></span>`).join('')}</div>
      <div class="chart__bars">
        ${weeks.map((w, i) => `<div class="chart__col" tabindex="0" aria-label="${esc(label(w))} : ${w.count} demande${w.count > 1 ? 's' : ''}">
          <div class="chart__bar" style="height:${(w.count / max) * 100}%"></div>
          <span class="chart__tip">${esc(label(w))}<b>${w.count} demande${w.count > 1 ? 's' : ''}</b></span>
          ${i % 2 === 1 || weeks.length < 8 ? `<span class="chart__x">${new Date(w.start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>` : ''}
        </div>`).join('')}
      </div>
    </div>
    <details class="chart__table"><summary>Voir les données en tableau</summary>
      <table class="table table--compact"><thead><tr><th>Semaine</th><th>Demandes</th></tr></thead>
      <tbody>${weeks.map(w => `<tr><td>${esc(label(w))}</td><td>${w.count}</td></tr>`).join('')}</tbody></table>
    </details>`;
}

// Répartition : barres horizontales à une seule teinte (c'est une grandeur, pas une identité)
function breakdown(counts, labels) {
  const entries = Object.entries(labels).map(([k, v]) => [v, counts[k] || 0]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '<p class="muted">Aucune donnée pour le moment.</p>';
  const max = Math.max(...entries.map(e => e[1]));
  return `<ul class="hbars">${entries.map(([l, n]) => `<li><span class="hbars__label">${esc(l)}</span><span class="hbars__track"><span style="width:${(n / max) * 100}%"></span></span><b>${n}</b></li>`).join('')}</ul>`;
}

export default {
  async render(el, _rest, session) {
    const s = await api('/admin/stats');
    const hour = new Date().getHours();
    const hello = hour < 18 ? 'Bonjour' : 'Bonsoir';
    el.innerHTML = `
      <div class="head"><div><h1>${hello} ${esc(session.user.name.split(' ')[0])}</h1><p class="muted">Activité de l’agence au ${esc(fmtDate(new Date().toISOString(), false))}</p></div></div>

      <section class="tiles" aria-label="Chiffres clés">
        ${tile('Biens publiés', fmtNum(s.biens.publies), `${s.biens.total} au total · ${s.biens.masques} masqué${s.biens.masques > 1 ? 's' : ''}`, '#biens')}
        ${tile('Demandes à traiter', fmtNum(s.demandes.nouvelles), 'statut « Nouveau »', '#demandes')}
        ${tile('Demandes sur 30 jours', fmtNum(s.demandes.trenteJours), `${s.demandes.total} depuis le début`, '#demandes')}
        ${tile('Estimations demandées', fmtNum(s.demandes.estimations), `dont ${s.demandes.estimationsTrenteJours} sur 30 jours`, '#demandes')}
      </section>

      <div class="dash-grid">
        <section class="card card--wide">
          <h2>Demandes reçues par semaine</h2>
          <p class="muted small">12 dernières semaines, tous types confondus</p>
          ${weeklyChart(s.demandes.parSemaine)}
        </section>
        <section class="card">
          <h2>Demandes par type</h2>
          ${breakdown(s.demandes.parType, s.labels.types)}
        </section>
        <section class="card">
          <h2>Biens par statut</h2>
          ${breakdown(s.biens.parStatut, s.labels.statuts)}
          ${s.biens.valeurEnVente ? `<p class="muted small">Valeur des biens disponibles à la vente : <strong>${fmtNum(s.biens.valeurEnVente)} €</strong></p>` : ''}
        </section>
        <section class="card card--wide">
          <h2>Dernières demandes</h2>
          ${s.demandes.recentes.length ? `<ul class="recent">${s.demandes.recentes.map(l => `<li><a href="#demandes/${esc(l.id)}"><strong>${esc(l.nom || '—')}</strong><span>${esc(l.type)}</span><span class="pill ${l.status === 'nouveau' ? 'pill--new' : ''}">${esc(l.statusLabel)}</span><time>${esc(fmtDate(l.createdAt))}</time></a></li>`).join('')}</ul>` : '<p class="muted">Aucune demande pour le moment.</p>'}
        </section>
      </div>`;
  },
};
