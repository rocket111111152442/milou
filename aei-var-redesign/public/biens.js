// Page « Nos biens » : recherche avancée, filtres synchronisés avec l'adresse (partageable), tri, recherche vocale
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const { cardHTML, esc } = globalThis.AEICards;
  const F = globalThis.AEIFilters;
  const form = $('#filters');
  const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: .08 });
  let all = [];

  const readForm = () => {
    const p = new URLSearchParams();
    const set = (k, v) => { if (v) p.set(k, v); };
    set('transaction', $('[data-transaction].is-active')?.dataset.transaction === 'location' ? 'location' : '');
    set('q', form.q.value.trim()); set('ville', form.ville.value); set('type', form.type.value);
    ['prixMin', 'prixMax', 'surfMin', 'piecesMin', 'chambresMin'].forEach(k => set(k, form[k].value.trim()));
    const equip = $$('input[name=equip]:checked', form).map(i => i.value).join('|');
    set('equip', equip);
    if (form.vv.checked) p.set('vv', '1');
    if (form.clos.checked) p.set('clos', '1');
    if (form.sort.value !== 'recent') p.set('sort', form.sort.value);
    return p;
  };

  const fillForm = (p) => {
    const f = F.parse(p);
    $$('[data-transaction]').forEach(b => { const on = b.dataset.transaction === f.transaction; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on); });
    form.q.value = f.q || '';
    const combo = (sel, vals) => {
      const v = vals.join('|');
      if (v && ![...sel.options].some(o => o.value === v)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(vals.join(' / '))}</option>`);
      sel.value = v;
    };
    combo(form.ville, f.villes); combo(form.type, f.types);
    form.prixMin.value = f.prixMin || ''; form.prixMax.value = f.prixMax || ''; form.surfMin.value = f.surfMin || '';
    form.piecesMin.value = f.piecesMin || ''; form.chambresMin.value = f.chambresMin || '';
    $$('input[name=equip]', form).forEach(i => { i.checked = f.equip.includes(i.value); });
    form.vv.checked = !!f.vv; form.clos.checked = !!f.clos; form.sort.value = f.sort || 'recent';
  };

  const render = () => {
    const p = readForm();
    history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname);
    const f = F.parse(p);
    const list = F.apply(all, f);
    $('#count').textContent = `${list.length} bien${list.length > 1 ? 's' : ''} ${f.transaction === 'location' ? 'à louer' : 'à vendre'}`;
    $('#results').innerHTML = list.map(cardHTML).join('');
    $('#empty').hidden = list.length > 0;
    $$('#results .reveal').forEach(el => io.observe(el));
    $('#biensTitle').textContent = f.transaction === 'location' ? 'Biens à louer' : 'Biens à vendre';
  };

  const buildFacets = () => {
    const fac = F.facets(all, { ...F.parse(new URLSearchParams()), clos: true });
    const sel = (el, items) => { el.insertAdjacentHTML('beforeend', items.map(([v]) => `<option value="${esc(v)}">${esc(v)}</option>`).join('')); };
    sel(form.ville, fac.villes); sel(form.type, fac.types);
    $('#equipList').innerHTML = fac.equip.map(([e]) => `<label class="check"><input type="checkbox" name="equip" value="${esc(e)}"> ${esc(e)}</label>`).join('');
  };

  // Recherche vocale : API du navigateur (Web Speech). Sur Chrome, l'audio est traité par les serveurs de Google ;
  // le bouton n'apparaît que si le navigateur le permet, et rien n'est enregistré par ce site.
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (SR) {
    const btn = $('#voiceBtn'); btn.hidden = false;
    btn.addEventListener('click', () => {
      const r = new SR(); r.lang = (globalThis.AEI_LANG === 'en' ? 'en-GB' : globalThis.AEI_LANG === 'de' ? 'de-DE' : 'fr-FR'); r.interimResults = false;
      btn.classList.add('is-on');
      r.onresult = (e) => { form.q.value = e.results[0][0].transcript; render(); };
      r.onend = () => btn.classList.remove('is-on'); r.onerror = () => btn.classList.remove('is-on');
      try { r.start(); } catch { btn.classList.remove('is-on'); }
    });
  }

  $$('[data-transaction]').forEach(b => b.addEventListener('click', () => { $$('[data-transaction]').forEach(x => x.classList.toggle('is-active', x === b)); render(); }));
  form.addEventListener('input', render);
  form.addEventListener('submit', e => e.preventDefault());
  $('#resetBtn').addEventListener('click', () => { form.reset(); fillForm(new URLSearchParams()); render(); });

  fetch('/api/biens').then(r => r.json()).then(list => {
    all = list; buildFacets(); fillForm(new URLSearchParams(location.search)); render();
  }).catch(() => { $('#count').textContent = 'Impossible de charger les biens. Réessayez dans un instant.'; });
})();
