// Rapports : entonnoir des demandes, délai de réponse, sources, équipe, biens les plus vus, audience (sans cookie)
import { api } from '../api.js';
import { $, esc } from '../ui.js';

const bars = (rows, label, value, max) => `<div class="bars">${rows.map(r => `<div><span>${esc(label(r))}</span><i style="width:${Math.max(2, (value(r) / (max || 1)) * 100)}%"></i><b>${value(r)}</b></div>`).join('')}</div>`;

async function load(days) {
  const r = await api(`/admin/rapports?jours=${days}`);
  const f = r.funnel, max = f[0][1];
  $('#rBody').innerHTML = `<div class="dash-grid">
    <div class="card"><h2>Parcours des demandes (${r.jours} jours)</h2>${bars(f, x => x[0], x => x[1], max)}
      <p class="muted">Délai médian avant la première action : <strong>${r.delaiMedianHeures === null ? 'pas encore de donnée' : r.delaiMedianHeures + ' h'}</strong></p></div>
    <div class="card"><h2>Origine des demandes</h2>${r.sources.length ? bars(r.sources, x => x.source, x => x.total, r.sources[0].total) + '<p class="muted small">Site d’où venait le visiteur (information du navigateur, souvent absente).</p>' : '<p class="muted">Aucune donnée.</p>'}</div>
    <div class="card"><h2>Par négociateur</h2>${r.negociateurs.length ? `<table class="table"><thead><tr><th>Nom</th><th>Demandes</th><th>Gagnées</th><th>Non traitées</th></tr></thead><tbody>${r.negociateurs.map(n => `<tr><td>${esc(n.nom)}</td><td>${n.total}</td><td>${n.gagne}</td><td>${n.nouveau}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Aucune donnée.</p>'}</div>
    <div class="card"><h2>Biens : consultations et demandes</h2>${r.biens.length ? `<table class="table"><thead><tr><th>Bien</th><th>Pages vues</th><th>Demandes</th></tr></thead><tbody>${r.biens.map(b => `<tr><td>${esc(b.titre)}<small>${esc(b.ville)}</small></td><td>${b.vues}</td><td>${b.demandes}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Aucune donnée.</p>'}</div>
    <div class="card card--wide"><h2>Audience du site (pages vues, sans cookie)</h2>${r.audience ? `<p><strong>${r.audience.total}</strong> pages vues sur la période (90 jours maximum). Ce sont des pages vues, pas des visiteurs uniques : le dispositif ne reconnaît pas une personne d’une page à l’autre. Les robots connus sont exclus ; les visiteurs qui refusent la mesure ne sont pas comptés.</p>
      <p>Langues : ${Object.entries(r.audience.langs).map(([k, v]) => `${esc(k.toUpperCase())} ${v}`).join(' · ') || '—'}</p>
      <p>Sites d’origine : ${Object.entries(r.audience.refs).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${esc(k)} (${v})`).join(', ') || '—'}</p>` : '<p class="muted">Aucune donnée.</p>'}</div>
  </div>`;
}

export default {
  async render(el) {
    el.innerHTML = `<div class="head"><div><h1>Rapports &amp; audience</h1></div><select id="rDays" aria-label="Période"><option value="30">30 jours</option><option value="90" selected>90 jours</option><option value="365">12 mois</option></select></div><div id="rBody"><div class="loading">Chargement…</div></div>`;
    $('#rDays').addEventListener('change', e => load(e.target.value));
    await load(90);
  },
};
