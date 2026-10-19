// Gestion des biens : liste filtrable, création, modification, publication, photos
import { api } from '../api.js';
import { $, $$, esc, toast, src, toNumber, confirmDialog, showFieldErrors, setBusy, openDrawer, closeDrawer } from '../ui.js';

const FIELDS = ['titre', 'ville', 'cp', 'adresse', 'prix', 'region', 'transaction', 'statut', 'surface', 'chambres', 'terrain', 'badge', 'extra',
  'type', 'ref', 'pieces', 'sdb', 'sde', 'niveaux', 'annee', 'cuisine', 'chauffage', 'description',
  'dpe', 'dpeKwh', 'ges', 'gesCo2', 'energieMin', 'energieMax', 'energieRef',
  'honoraires', 'taxeFonciere', 'chargesCopro', 'lotsCopro', 'visiteVirtuelle', 'video', 'titreEn', 'titreDe', 'descriptionEn', 'descriptionDe', 'negociateurId'];
const STATUT_CLASS = { disponible: 'pill--ok', 'sous-compromis': 'pill--warn', vendu: 'pill--sold', loue: 'pill--sold' };
const MAX_PHOTOS = 30;

let biens = [];
let meta = { statuts: {}, types: [] };
let filters = { q: '', ville: '', type: '', statut: '', publie: '', prixMin: '', prixMax: '' };
let session;

// ---------- Liste ----------
function filtered() {
  const q = filters.q.toLowerCase();
  return biens.filter(b =>
    (!q || `${b.titre} ${b.ville} ${b.ref} ${b.adresse}`.toLowerCase().includes(q)) &&
    (!filters.ville || b.ville === filters.ville) &&
    (!filters.type || b.type === filters.type) &&
    (!filters.statut || b.statut === filters.statut) &&
    (filters.publie === '' || String(b.publie) === filters.publie) &&
    (!filters.prixMin || toNumber(b.prix) >= +filters.prixMin) &&
    (!filters.prixMax || toNumber(b.prix) <= +filters.prixMax));
}

function renderList() {
  const rows = filtered();
  const pub = biens.filter(b => b.publie).length;
  $('#bSummary').textContent = `${biens.length} biens · ${pub} publiés · ${biens.length - pub} masqués${rows.length !== biens.length ? ` · ${rows.length} affichés` : ''}`;
  const canReorder = rows.length === biens.length;
  $('#bList').innerHTML = rows.length ? rows.map((b) => {
    const i = biens.indexOf(b);
    const photos = b.photos?.length ? b.photos : b.photo ? [b.photo] : [];
    return `<li class="item${b.publie ? '' : ' is-hidden-item'}">
      ${photos[0] ? `<img class="item__img" src="${esc(src(photos[0]))}" alt="" loading="lazy">` : '<div class="item__img"></div>'}
      <div class="item__info">
        <p class="item__title">${esc(b.titre)}</p>
        <p class="item__meta">${esc([b.type, b.ville, b.cp].filter(Boolean).join(' · '))}${b.surface ? ` · ${esc(b.surface)} m²` : ''} · ${photos.length} photo${photos.length > 1 ? 's' : ''}${b.ref ? ` · réf. ${esc(b.ref)}` : ''}</p>
        <p class="item__pills">
          <span class="pill ${STATUT_CLASS[b.statut] || ''}">${esc(meta.statuts[b.statut] || b.statut)}</span>
          ${b.transaction === 'location' ? '<span class="pill">Location</span>' : ''}
          ${b.badge ? `<span class="pill">${esc(b.badge)}</span>` : ''}
          ${b.publie ? '' : '<span class="pill pill--muted">Masqué</span>'}
          ${b.source === 'api' ? '<span class="pill pill--muted">Importé</span>' : ''}
        </p>
      </div>
      <span class="item__price">${b.prix ? esc(b.prix) + (b.transaction === 'location' ? ' €/mois' : ' €') : '—'}</span>
      <div class="item__actions">
        ${canReorder ? `<button class="icon-btn" data-up="${i}" aria-label="Monter" title="Monter" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" data-down="${i}" aria-label="Descendre" title="Descendre" ${i === biens.length - 1 ? 'disabled' : ''}>↓</button>` : ''}
        <button class="icon-btn" data-toggle="${esc(b.id)}" aria-label="${b.publie ? 'Masquer du site' : 'Publier sur le site'}" title="${b.publie ? 'Masquer du site' : 'Publier sur le site'}">${b.publie ? '◉' : '○'}</button>
        <a class="icon-btn" href="/bien.html?id=${encodeURIComponent(b.id)}" target="_blank" rel="noopener" aria-label="Voir la fiche sur le site" title="Voir la fiche">↗</a>
        <button class="icon-btn" data-edit="${esc(b.id)}" aria-label="Modifier" title="Modifier">✎</button>
      </div>
    </li>`;
  }).join('') : '<li class="empty">Aucun bien ne correspond à ces filtres.</li>';
}

async function load() {
  const r = await api('/admin/biens');
  biens = r.biens;
  meta = r;
  const villes = [...new Set(biens.map(b => b.ville))].sort((a, b) => a.localeCompare(b, 'fr'));
  $('#fVille').innerHTML = '<option value="">Toutes les villes</option>' + villes.map(v => `<option${v === filters.ville ? ' selected' : ''}>${esc(v)}</option>`).join('');
  renderList();
}

// ---------- Formulaire ----------
let editing = null;
let photos = [];
let equipements = [];

const renderPhotos = () => {
  $('#photoCount').textContent = photos.length ? `(${photos.length})` : '';
  $('#photoGrid').innerHTML = photos.map((url, i) => `
    <li class="thumb">
      <img src="${esc(src(url))}" alt="Photo ${i + 1}">
      ${i === 0 ? '<span class="thumb__main">Principale</span>' : ''}
      <div class="thumb__tools">
        <button type="button" data-ph="first" data-i="${i}" title="Mettre en photo principale" aria-label="Mettre en photo principale" ${i === 0 ? 'disabled' : ''}>★</button>
        <button type="button" data-ph="left" data-i="${i}" title="Déplacer vers la gauche" aria-label="Déplacer vers la gauche" ${i === 0 ? 'disabled' : ''}>←</button>
        <button type="button" data-ph="right" data-i="${i}" title="Déplacer vers la droite" aria-label="Déplacer vers la droite" ${i === photos.length - 1 ? 'disabled' : ''}>→</button>
        <button type="button" class="del" data-ph="del" data-i="${i}" title="Retirer la photo" aria-label="Retirer la photo">✕</button>
      </div>
    </li>`).join('');
};

const renderEq = () => {
  $('#eqChips').innerHTML = equipements.map((e, i) => `<span class="chip">${esc(e)}<button type="button" data-eq="${i}" aria-label="Retirer ${esc(e)}">✕</button></span>`).join('');
  $('#eqCount').textContent = equipements.length ? `(${equipements.length})` : '';
  $$('#eqQuick button').forEach(btn => { btn.hidden = equipements.some(e => e.toLowerCase() === btn.textContent.toLowerCase()); });
};
const addEq = (v) => {
  v = v.trim().slice(0, 40);
  if (!v || equipements.some(e => e.toLowerCase() === v.toLowerCase()) || equipements.length >= 30) return;
  equipements.push(v);
  renderEq();
};

const compoRow = (r = {}) => `<div class="compo__row">
    <input data-k="niveau" placeholder="Niveau (ex. Rez-de-chaussée)" value="${esc(r.niveau)}" maxlength="40" list="niveaux" aria-label="Niveau">
    <input data-k="piece" placeholder="Pièce (ex. Salon)" value="${esc(r.piece)}" maxlength="60" aria-label="Pièce">
    <input data-k="surface" placeholder="m²" value="${esc(r.surface)}" maxlength="12" inputmode="decimal" aria-label="Surface en m²">
    <button type="button" aria-label="Retirer la pièce">✕</button>
  </div>`;
const readCompo = () => $$('#compo .compo__row').map(row => Object.fromEntries($$('input', row).map(i => [i.dataset.k, i.value.trim()]))).filter(r => r.piece);
const updateCompoCount = () => { const n = readCompo().length; $('#compoCount').textContent = n ? `(${n})` : ''; };

const updatePrixLabel = () => {
  const loc = $('#bienForm').elements.transaction.value === 'location';
  $('#prixLabel').textContent = loc ? 'Loyer mensuel CC (€)' : 'Prix (€)';
};

let team = null;
async function fillTeam(form, b) {
  const sel = form.elements.negociateurId;
  try {
    team ||= (await api('/admin/equipe')).equipe;
    sel.innerHTML = '<option value="">Non assigné</option>' + team.map(u => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('');
    sel.value = b?.negociateurId || '';
  } catch { /* liste indisponible */ }
  const box = $('#acqBox');
  box.textContent = '';
  if (!b) return;
  try {
    const { contacts } = await api(`/admin/biens/${encodeURIComponent(b.id)}/acquereurs`);
    box.innerHTML = contacts.length
      ? `<strong>${contacts.length} contact${contacts.length > 1 ? 's' : ''} recherche${contacts.length > 1 ? 'nt' : ''} ce type de bien :</strong><ul>${contacts.map(c => `<li><a href="#contacts/${esc(c.id)}">${esc(c.nom)}</a> ${esc(c.tel || c.email)}</li>`).join('')}</ul>`
      : 'Aucun contact enregistré ne correspond à ce bien (critères saisis dans les fiches contacts / alertes).';
  } catch { /* facultatif */ }
}

function openForm(b = null) {
  const form = $('#bienForm');
  editing = b ? b.id : null;
  form.reset();
  showFieldErrors(form, {});
  $('#formTitle').textContent = b ? 'Modifier le bien' : 'Ajouter un bien';
  $('#deleteBtn').hidden = !b || !['owner', 'admin'].includes(session.user.role);
  if (b) {
    for (const k of FIELDS) if (form.elements[k]) form.elements[k].value = b[k] ?? '';
    form.elements.publie.checked = b.publie !== false;
  } else {
    form.elements.publie.checked = true;
  }
  form.elements.quartierTxt.value = (b?.quartier || []).map(q => q.distance ? `${q.label} | ${q.distance}` : q.label).join('\n');
  fillTeam(form, b);
  updatePrixLabel();
  equipements = [...(b?.equipements || [])];
  renderEq();
  $('#compo').innerHTML = (b?.composition || []).map(compoRow).join('');
  updateCompoCount();
  photos = [...(b?.photos?.length ? b.photos : b?.photo ? [b.photo] : [])];
  renderPhotos();
  openDrawer($('#drawer'));
  setTimeout(() => form.elements.titre.focus(), 300);
}

async function submitForm(e) {
  e.preventDefault();
  const form = e.target;
  const errors = {};
  if (!form.titre.value.trim()) errors.titre = 'Le titre est obligatoire';
  if (!form.ville.value.trim()) errors.ville = 'La ville est obligatoire';
  if (form.cp.value && !/^\d{5}$/.test(form.cp.value.trim())) errors.cp = '5 chiffres';
  ['prix', 'surface', 'terrain', 'pieces', 'chambres'].forEach(k => {
    if (form[k].value && !/^[\d\s.,]+$/.test(form[k].value)) errors[k] = 'Nombre attendu';
  });
  showFieldErrors(form, errors);
  if (Object.keys(errors).length) {
    form.querySelector('.is-error input')?.focus();
    return toast('Certains champs sont à corriger', true);
  }
  if (!$('#photoBusy').hidden) return toast('Patientez, les photos sont en cours d’envoi', true);

  const data = Object.fromEntries(FIELDS.map(k => [k, form.elements[k]?.value.trim() ?? '']));
  data.quartier = form.elements.quartierTxt.value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [label, distance] = l.split('|').map(x => x.trim()); return { label, distance: distance || '' }; });
  data.publie = form.elements.publie.checked;
  data.equipements = [...equipements];
  data.composition = readCompo();
  data.photos = [...photos];

  const btn = $('#saveBtn');
  setBusy(btn, true, 'Enregistrement…');
  try {
    if (editing) await api(`/admin/biens/${encodeURIComponent(editing)}`, { method: 'PUT', body: data });
    else await api('/admin/biens', { method: 'POST', body: data });
    toast(editing ? 'Bien mis à jour' : (data.publie ? 'Bien ajouté et publié sur le site' : 'Bien ajouté (masqué)'));
    closeDrawer($('#drawer'));
    await load();
  } catch (err) {
    showFieldErrors(form, err.data?.errors);
    toast(err.message, true);
  } finally {
    setBusy(btn, false);
  }
}

// Photos : redimensionnées (1600 px) et converties en WebP dans le navigateur, puis envoyées une par une
const resize = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    c.toBlob(b => (b ? resolve(b) : reject(new Error('Conversion impossible'))), 'image/webp', 0.82);
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
  img.src = url;
});

async function upload(files) {
  files = [...files].filter(f => /^image\/(jpeg|png|webp)$/.test(f.type));
  if (!files.length) return toast('Format accepté : JPEG, PNG ou WebP', true);
  const room = MAX_PHOTOS - photos.length;
  if (room <= 0) return toast(`${MAX_PHOTOS} photos maximum par bien`, true);
  if (files.length > room) { toast(`Seules ${room} photos seront ajoutées (${MAX_PHOTOS} max)`, true); files = files.slice(0, room); }
  const busy = $('#photoBusy');
  busy.hidden = false;
  let ok = 0;
  try {
    for (const [n, file] of files.entries()) {
      busy.textContent = `Envoi de la photo ${n + 1} / ${files.length}…`;
      try {
        const blob = await resize(file);
        const { url } = await api('/admin/photos', { method: 'POST', body: blob, headers: { 'content-type': blob.type } });
        photos.push(url);
        ok++;
        renderPhotos();
      } catch (e) {
        toast(`${file.name} : ${e.message}`, true);
      }
    }
    if (ok) toast(ok > 1 ? `${ok} photos ajoutées — pensez à enregistrer` : 'Photo ajoutée — pensez à enregistrer');
  } finally {
    busy.hidden = true;
    $('#photoInput').value = '';
  }
}

// Les écouteurs du formulaire ne sont posés qu'une fois (le formulaire est dans index.html)
let wired = false;
function wireForm() {
  if (wired) return;
  wired = true;
  const drawer = $('#drawer');
  const form = $('#bienForm');
  form.addEventListener('submit', submitForm);
  form.elements.transaction.addEventListener('change', updatePrixLabel);
  $$('[data-close]', drawer).forEach(el => el.addEventListener('click', () => closeDrawer(drawer)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer(drawer); });

  $('#deleteBtn').addEventListener('click', async () => {
    const b = biens.find(x => x.id === editing);
    if (!b || !(await confirmDialog('Supprimer ce bien ?', `« ${b.titre} » sera définitivement retiré du site. Pour le cacher temporairement, décochez plutôt « Publié sur le site ».`, 'Supprimer'))) return;
    try {
      await api(`/admin/biens/${encodeURIComponent(editing)}`, { method: 'DELETE' });
      toast('Bien supprimé');
      closeDrawer(drawer);
      await load();
    } catch (err) { toast(err.message, true); }
  });

  $('#photoGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-ph]');
    if (!btn) return;
    const i = +btn.dataset.i;
    const move = (to) => photos.splice(to, 0, photos.splice(i, 1)[0]);
    if (btn.dataset.ph === 'first') move(0);
    if (btn.dataset.ph === 'left') move(i - 1);
    if (btn.dataset.ph === 'right') move(i + 1);
    if (btn.dataset.ph === 'del') photos.splice(i, 1);
    renderPhotos();
  });
  const zone = $('#photoZone');
  $('#photoInput').addEventListener('change', e => upload(e.target.files));
  ['dragenter', 'dragover'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.add('is-drag'); }));
  ['dragleave', 'drop'].forEach(t => zone.addEventListener(t, () => zone.classList.remove('is-drag')));
  zone.addEventListener('drop', e => { e.preventDefault(); upload(e.dataTransfer.files); });

  $('#eqChips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-eq]');
    if (btn) { equipements.splice(+btn.dataset.eq, 1); renderEq(); }
  });
  $('#eqInput').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    addEq(e.target.value);
    e.target.value = '';
  });
  $('#eqQuick').addEventListener('click', (e) => { if (e.target.matches('button')) addEq(e.target.textContent); });

  $('#compoAdd').addEventListener('click', () => {
    const rows = $$('#compo .compo__row');
    const lastLevel = rows.length ? $('input[data-k="niveau"]', rows.at(-1)).value : '';
    $('#compo').insertAdjacentHTML('beforeend', compoRow({ niveau: lastLevel }));
    $('#compo .compo__row:last-child input[data-k="piece"]').focus();
  });
  $('#compo').addEventListener('click', (e) => { if (e.target.closest('button')) { e.target.closest('.compo__row').remove(); updateCompoCount(); } });
  $('#compo').addEventListener('input', updateCompoCount);
  document.body.insertAdjacentHTML('beforeend', '<datalist id="niveaux"><option value="Sous-sol"><option value="Rez-de-chaussée"><option value="Rez-de-jardin"><option value="1er étage"><option value="2e étage"><option value="Combles"><option value="Extérieur"></datalist>');
}

export default {
  async render(el, _rest, s) {
    session = s;
    el.innerHTML = `
      <div class="head">
        <div><h1>Biens</h1><p class="muted" id="bSummary">Chargement…</p></div>
        <button class="btn btn--red" id="addBtn" type="button">+ Ajouter un bien</button>
      </div>
      <form class="filters-bar" id="bFilters" role="search">
        <input type="search" name="q" placeholder="Titre, ville, référence, adresse…" aria-label="Rechercher" value="${esc(filters.q)}">
        <select name="ville" id="fVille" aria-label="Ville"></select>
        <select name="type" aria-label="Type"><option value="">Tous les types</option>${(meta.types.length ? meta.types : ['Maison', 'Villa', 'Appartement', 'Terrain', 'Immeuble', 'Local commercial', 'Parking', 'Autre']).map(t => `<option${t === filters.type ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <select name="statut" aria-label="Statut"><option value="">Tous les statuts</option><option value="disponible">Disponible</option><option value="sous-compromis">Sous compromis</option><option value="vendu">Vendu</option><option value="loue">Loué</option></select>
        <select name="publie" aria-label="Publication"><option value="">Publiés et masqués</option><option value="true">Publiés</option><option value="false">Masqués</option></select>
        <input type="number" name="prixMin" min="0" step="1000" placeholder="Prix min" aria-label="Prix minimum" value="${esc(filters.prixMin)}">
        <input type="number" name="prixMax" min="0" step="1000" placeholder="Prix max" aria-label="Prix maximum" value="${esc(filters.prixMax)}">
        <button type="reset" class="btn btn--ghost btn--sm">Réinitialiser</button>
      </form>
      <ul class="list" id="bList"></ul>`;
    const f = $('#bFilters');
    f.statut.value = filters.statut;
    f.publie.value = filters.publie;
    f.addEventListener('input', () => { filters = Object.fromEntries(new FormData(f)); renderList(); });
    f.addEventListener('reset', () => setTimeout(() => { filters = Object.fromEntries(new FormData(f)); renderList(); }));
    f.addEventListener('submit', e => e.preventDefault());
    $('#addBtn').addEventListener('click', () => openForm());

    $('#bList').addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.edit) return openForm(biens.find(b => b.id === btn.dataset.edit));
      if (btn.dataset.toggle) {
        const b = biens.find(x => x.id === btn.dataset.toggle);
        try {
          await api(`/admin/biens/${encodeURIComponent(b.id)}`, { method: 'PUT', body: { ...b, publie: !b.publie } });
          toast(b.publie ? 'Bien masqué du site' : 'Bien publié sur le site');
          await load();
        } catch (err) { toast(err.message, true); }
        return;
      }
      const from = btn.dataset.up ?? btn.dataset.down;
      if (from === undefined) return;
      const to = btn.dataset.up !== undefined ? +from - 1 : +from + 1;
      const next = [...biens];
      next.splice(to, 0, next.splice(+from, 1)[0]);
      biens = next;
      renderList();
      try { await api('/admin/biens/ordre', { method: 'POST', body: { ids: next.map(b => b.id) } }); }
      catch (err) { toast(err.message, true); await load(); }
    });

    wireForm();
    await load();
  },
};

