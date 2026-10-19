// Contenu éditable : pages communes (SEO), prix au m² (estimation indicative), avis clients
import { api } from '../api.js';
import { $, $$, esc, toast, setBusy } from '../ui.js';

let communes, avis;

const communeRow = (c = {}) => `<details class="sect commune" ${c.nom ? '' : 'open'}><summary>${esc(c.nom || 'Nouvelle commune')}</summary><div class="sect__body">
  <div class="row-edit">
    <label class="field"><span>Nom</span><input data-k="nom" value="${esc(c.nom)}" maxlength="80"></label>
    <label class="field"><span>Code postal</span><input data-k="cp" value="${esc(c.cp)}" maxlength="5"></label>
    <label class="field"><span>Prix moyen maison/villa (€/m²)</span><input data-k="prixM2Maison" value="${esc(c.prixM2Maison)}" inputmode="numeric"></label>
    <label class="field"><span>Prix moyen appartement (€/m²)</span><input data-k="prixM2Appartement" value="${esc(c.prixM2Appartement)}" inputmode="numeric"></label>
    <label class="field"><span>Source de ces prix</span><input data-k="source" value="${esc(c.source)}" maxlength="150" placeholder="Ex. ventes réalisées par l’agence, notaires…"></label>
    <label class="field"><span>Date de relevé</span><input data-k="date" type="date" value="${esc(c.date)}"></label>
  </div>
  <label class="field"><span>Quartiers / secteurs</span><input data-k="quartiers" value="${esc(c.quartiers)}" maxlength="300"></label>
  <label class="field"><span>Texte de présentation (page « Immobilier à … »)</span><textarea data-k="intro" rows="5" maxlength="3000">${esc(c.intro)}</textarea></label>
  <button type="button" class="btn btn--danger btn--sm" data-rm-commune>Retirer cette commune</button></div></details>`;

const avisRow = (a = {}) => `<div class="row-edit avis">
  <label class="field"><span>Auteur</span><input data-k="auteur" value="${esc(a.auteur)}" maxlength="60"></label>
  <label class="field"><span>Note (1-5)</span><input data-k="note" type="number" min="1" max="5" value="${esc(a.note)}"></label>
  <label class="field"><span>Date</span><input data-k="date" value="${esc(a.date)}" placeholder="2025-06"></label>
  <label class="field"><span>Source</span><input data-k="source" value="${esc(a.source)}" placeholder="Google, PagesJaunes, courrier…"></label>
  <label class="field" style="grid-column:1/-1"><span>Texte (tel que rédigé par le client)</span><textarea data-k="texte" rows="2" maxlength="1200">${esc(a.texte)}</textarea></label>
  <label class="check"><input type="checkbox" data-k="publie" ${a.publie === false ? '' : 'checked'}> Publié</label>
  <button type="button" class="btn btn--danger btn--sm" data-rm-avis>Retirer</button></div>`;

const read = (box, sel) => $$(sel, box).map(row => Object.fromEntries($$('[data-k]', row).map(i => [i.dataset.k, i.type === 'checkbox' ? i.checked : i.value.trim()])));

export default {
  async render(el) {
    [communes, avis] = await Promise.all([api('/admin/communes'), api('/admin/avis')]);
    const ag = avis.agregat || {};
    el.innerHTML = `<div class="head"><div><h1>Communes &amp; avis</h1><p class="muted">Ce que vous saisissez ici alimente les pages « Immobilier à… », l’estimation indicative et les avis du site. Rien n’est affiché tant que vous n’avez rien saisi.</p></div></div>
    <form id="cForm" class="card"><h2>Communes et prix au m²</h2>
      <p class="muted">L’estimation indicative affichée aux vendeurs = surface × prix au m² saisi ci-dessous ± la marge. Elle n’est affichée que pour les communes où vous avez saisi un prix. Mettez des prix que vous pouvez justifier (ventes réalisées, données notariales).</p>
      <label class="field" style="max-width:220px"><span>Marge de la fourchette (± %)</span><input name="marge" type="number" min="0" max="50" value="${esc(communes.marge)}"></label>
      <div id="cRows">${communes.communes.map(communeRow).join('')}</div>
      <p><button type="button" class="btn btn--ghost btn--sm" id="cAdd">+ Ajouter une commune</button> <button class="btn btn--red" type="submit">Enregistrer les communes</button></p></form>
    <form id="aForm" class="card"><h2>Avis clients</h2>
      <p class="muted">Ne saisissez que de vrais avis, avec leur source. Une note globale (ex. celle de votre fiche Google) doit mentionner sa source et la date de relevé.</p>
      <div class="row-edit" id="aggBox">
        <label class="field"><span>Note globale</span><input name="note" value="${esc(ag.note)}" placeholder="4,7"></label>
        <label class="field"><span>Nombre d’avis</span><input name="nombre" value="${esc(ag.nombre)}"></label>
        <label class="field"><span>Source</span><input name="source" value="${esc(ag.source)}" placeholder="Google, PagesJaunes…"></label>
        <label class="field"><span>Lien vers la fiche (https)</span><input name="url" value="${esc(ag.url)}"></label>
        <label class="field"><span>Relevé le</span><input name="releveLe" type="date" value="${esc(ag.releveLe)}"></label></div>
      <div id="aRows">${avis.avis.map(avisRow).join('')}</div>
      <p><button type="button" class="btn btn--ghost btn--sm" id="aAdd">+ Ajouter un avis</button> <button class="btn btn--red" type="submit">Enregistrer les avis</button></p></form>`;

    $('#cAdd').addEventListener('click', () => $('#cRows').insertAdjacentHTML('beforeend', communeRow()));
    $('#aAdd').addEventListener('click', () => $('#aRows').insertAdjacentHTML('beforeend', avisRow({ note: 5 })));
    el.addEventListener('click', e => { e.target.closest('[data-rm-commune]')?.closest('.commune').remove(); e.target.closest('[data-rm-avis]')?.closest('.avis').remove(); });
    $('#cForm').addEventListener('submit', async e => {
      e.preventDefault(); const btn = $('button[type=submit]', e.target); setBusy(btn, true);
      try { communes = await api('/admin/communes', { method: 'PUT', body: { marge: e.target.marge.value, communes: read($('#cRows'), '.commune') } }); toast('Communes enregistrées'); } catch (er) { toast(er.message, true); } finally { setBusy(btn, false); }
    });
    $('#aForm').addEventListener('submit', async e => {
      e.preventDefault(); const btn = $('button[type=submit]', e.target); setBusy(btn, true);
      const f = e.target;
      try { avis = await api('/admin/avis', { method: 'PUT', body: { agregat: { note: f.note.value, nombre: f.nombre.value, source: f.source.value, url: f.url.value, releveLe: f.releveLe.value }, avis: read($('#aRows'), '.avis') } }); toast('Avis enregistrés'); } catch (er) { toast(er.message, true); } finally { setBusy(btn, false); }
    });
  },
};
