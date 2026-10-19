(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

  document.body.classList.add('is-loading');
  $('#year').textContent = new Date().getFullYear();

  // ---------- Loader ----------
  const start = () => {
    $('.loader').classList.add('is-done');
    document.body.classList.remove('is-loading');
    setTimeout(() => document.body.classList.add('is-ready'), 250);
  };
  const minDelay = reduced ? 0 : 1100;
  const t0 = performance.now();
  const go = () => setTimeout(start, Math.max(0, minDelay - (performance.now() - t0)));
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
  setTimeout(start, 3500); // filet de sécurité si une image tarde

  // ---------- Header / progress / mobile bar ----------
  const header = $('.header');
  const progress = $('.progress');
  const mobileBar = $('.mobile-bar');
  let lastY = 0;
  const onScroll = () => {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    header.classList.toggle('is-scrolled', y > 40);
    header.classList.toggle('is-hidden', y > 600 && y > lastY && !document.body.classList.contains('menu-open'));
    mobileBar.classList.toggle('is-visible', y > innerHeight * .6);
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Menu mobile ----------
  const burger = $('.burger');
  const toggleMenu = (open) => {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    $('.mobile-menu').setAttribute('aria-hidden', !open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => toggleMenu(!document.body.classList.contains('menu-open')));
  $$('.mobile-menu a').forEach(a => a.addEventListener('click', () => toggleMenu(false)));

  const navLinks = $$('.nav a');
  const sections = navLinks.map(a => a.getAttribute('href')).filter(h => /^#[\w-]+$/.test(h)).map(h => $(h)).filter(Boolean);

  // ---------- Hero slideshow ----------
  const slides = $$('.hero__slide');
  const dots = $$('.hero__dots button');
  let current = 0, timer;
  const show = (i) => {
    slides[current].classList.remove('is-active');
    dots[current].classList.remove('is-active');
    current = (i + slides.length) % slides.length;
    slides[current].classList.add('is-active');
    void dots[current].offsetWidth; // relance l'animation de la barre
    dots[current].classList.add('is-active');
    clearTimeout(timer);
    if (!reduced) timer = setTimeout(() => show(current + 1), 6000);
  };
  dots.forEach((d, i) => d.addEventListener('click', () => show(i)));
  if (!reduced) timer = setTimeout(() => show(1), 6000);

  // ---------- Search tabs ----------
  const tabs = $$('.search__tabs button');
  const pill = $('.search__pill');
  const movePill = (btn) => {
    pill.style.width = btn.offsetWidth + 'px';
    pill.style.transform = `translateX(${btn.offsetLeft - 4}px)`;
  };
  let searchTransaction = 'vente';
  tabs.forEach(b => b.addEventListener('click', () => {
    tabs.forEach(t => { t.classList.toggle('is-active', t === b); t.setAttribute('aria-selected', t === b); });
    searchTransaction = b.dataset.transaction;
    movePill(b);
  }));
  requestAnimationFrame(() => movePill($('.search__tabs .is-active')));
  addEventListener('resize', () => movePill($('.search__tabs .is-active')));

  // ---------- Reveal on scroll ----------
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
  // décalage en cascade pour les éléments frères
  $$('.reveal').forEach(el => {
    const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
    const idx = sibs.indexOf(el);
    if (idx > 0) el.style.setProperty('--d', `${Math.min(idx, 6) * 0.08}s`);
    io.observe(el);
  });

  // ---------- Nav active section ----------
  const navIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) navLinks.forEach(a => a.classList.toggle('is-current', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => navIO.observe(s));

  // ---------- Counters ----------
  const countIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const to = parseFloat(el.dataset.to);
      const dec = +(el.dataset.dec || 0);
      const dur = reduced ? 0 : 1800;
      const t1 = performance.now();
      const tick = (now) => {
        const p = dur ? Math.min(1, (now - t1) / dur) : 1;
        const v = to * (1 - Math.pow(1 - p, 4));
        el.textContent = v.toFixed(dec).replace('.', ',');
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      countIO.unobserve(el);
    });
  }, { threshold: .6 });
  $$('.count').forEach(el => countIO.observe(el));

  // ---------- Parallax ----------
  const para = $$('.parallax');
  if (!reduced && para.length) {
    let ticking = false;
    const update = () => {
      para.forEach(el => {
        const r = el.getBoundingClientRect();
        const off = (r.top + r.height / 2 - innerHeight / 2) * parseFloat(el.dataset.speed);
        el.style.transform = `translate3d(0, ${off}px, 0)`;
      });
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // ---------- Biens (chargés depuis l'admin) ----------
  const grid = $('#gridBiens');
  const { cardHTML, isClosed, esc } = window.SiteCards;
  let allBiens = [];
  // L'accueil montre une sélection (le catalogue complet est sur /biens) : exclusivités d'abord, ordre de l'admin ensuite
  const HOME_MAX = 9;
  const FILTER_LINKS = { all: '/biens', vente: '/biens', location: '/biens?transaction=location', vendu: '/biens?clos=1' };
  const selection = (f) => {
    const list = f === 'vendu' ? allBiens.filter(isClosed) : allBiens.filter(b => !isClosed(b) && (f === 'all' || (b.transaction || 'vente') === f));
    // Coups de cœur puis exclusivités en tête ; parkings et « autres » (fonds de commerce…) en fin de sélection
    const rank = (b) => (b.badge === 'Coup de cœur' ? 0 : b.badge === 'Exclusivité' ? 1 : 2) + (['Parking', 'Autre'].includes(b.type) ? 3 : 0);
    return list.map((b, i) => [b, rank(b), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([b]) => b);
  };
  const renderBiens = (f = 'all') => {
    const list = selection(f);
    grid.innerHTML = list.length ? list.slice(0, HOME_MAX).map(cardHTML).join('') : '<p class="grid-empty">Aucun bien ne correspond à votre recherche pour le moment. <a href="/espace-client.html#alertes">Créez une alerte</a> pour être prévenu(e) dès qu’un bien est publié.</p>';
    $$('.bien', grid).forEach((el, i) => { el.style.setProperty('--d', `${(i % 3) * 0.08}s`); io.observe(el); });
    const more = $('#voirTout');
    if (more) {
      more.hidden = list.length <= HOME_MAX;
      more.href = FILTER_LINKS[f] || '/biens';
      more.innerHTML = `Voir tous les biens <span>(${list.length})</span>`;
    }
  };
  const loadBiens = async () => {
    try {
      const res = await fetch('/api/biens');
      if (!res.ok) throw new Error();
      allBiens = await res.json();
      renderBiens();
      // Statistique réelle : nombre de biens disponibles en ligne
      const n = allBiens.filter(b => !isClosed(b)).length;
      const stat = $('#statBiens');
      stat.dataset.to = n; // si le compteur n'a pas encore défilé, il s'animera jusqu'à n
      stat.textContent = n;
    } catch {
      grid.innerHTML = `<p class="grid-empty">Nos biens sont momentanément indisponibles. Appelez-nous au ${esc($('.header__phone')?.textContent.trim() || '')}.</p>`;
    }
  };
  loadBiens();

  // ---------- Équipe : toutes les agences dépliées sur grand écran (repliées, sauf la première, sur mobile) ----------
  if (matchMedia('(min-width: 861px)').matches) $$('.team__group').forEach(d => { d.open = true; });

  // ---------- Filtres biens ----------
  const filterBtns = $$('.filters button');
  filterBtns.forEach(btn => btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.toggle('is-active', b === btn));
    renderBiens(btn.dataset.filter);
    // Les cartes redessinées apparaissent avec la même animation que les autres sections
    $$('.bien', grid).forEach(card => requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('is-in'))));
  }));

  // ---------- Effet magnétique sur les CTA ----------
  if (fine && !reduced) {
    $$('.magnetic').forEach(el => {
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * .25;
        const y = (e.clientY - r.top - r.height / 2) * .35;
        el.style.transform = `translate(${x}px, ${y}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });

    // Inclinaison 3D légère des cartes équipe
    $$('.tilt').forEach(el => {
      el.style.transition = 'transform .6s cubic-bezier(.22,1,.36,1), opacity 1s';
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const rx = ((e.clientY - r.top) / r.height - .5) * -8;
        const ry = ((e.clientX - r.left) / r.width - .5) * 8;
        el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  // ---------- Formulaire d'estimation ----------
  const wiz = $('#wizard');
  const steps = $$('.wizard__step', wiz);
  const bar = $('.wizard__progress span', wiz);
  const count = $('.wizard__count b', wiz);
  const prev = $('[data-prev]', wiz);
  const next = $('[data-next]', wiz);
  let step = 0;

  const validate = (fs) => {
    let ok = true;
    $$('input[required], select[required]', fs).forEach(inp => {
      const group = inp.type === 'radio' ? $$(`input[name="${inp.name}"]`, fs) : [inp];
      const valid = inp.type === 'radio' ? group.some(g => g.checked)
        : inp.type === 'checkbox' ? inp.checked : inp.checkValidity() && inp.value.trim() !== '';
      const wrap = inp.closest('.field');
      if (wrap) wrap.classList.toggle('is-error', !valid);
      if (!valid) ok = false;
    });
    if (!ok) {
      fs.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 320 });
    }
    return ok;
  };
  const goStep = (n) => {
    steps[step].classList.remove('is-active');
    step = n;
    steps[step].classList.add('is-active');
    bar.style.width = `${(step + 1) * 25}%`;
    count.textContent = step + 1;
    prev.disabled = step === 0;
    next.textContent = step === steps.length - 1 ? 'Recevoir mon estimation' : 'Continuer';
    const first = $('input:not([type=radio]):not([type=checkbox]), select', steps[step]);
    if (first && fine) first.focus({ preventScroll: true });
  };
  // avance automatique après le choix du type de bien
  $$('input[name="bien"]', wiz).forEach(r => r.addEventListener('change', () => setTimeout(() => step === 0 && goStep(1), 350)));
  prev.addEventListener('click', () => step > 0 && goStep(step - 1));
  next.addEventListener('click', () => {
    // Dernière étape : la validation détaillée (avec messages) est faite par sendEstimation
    if (step === steps.length - 1) return sendEstimation();
    if (!validate(steps[step])) return;
    if (step < steps.length - 1) return goStep(step + 1);
    sendEstimation();
  });

  // Photos facultatives jointes à l'estimation
  const estPhotos = [];
  const photoList = $('#estPhotoList');
  const renderEstPhotos = () => {
    photoList.innerHTML = estPhotos.map((p, i) => `<li><img src="${p.preview}" alt="Photo ${i + 1}"><button type="button" data-rm="${i}" aria-label="Retirer la photo ${i + 1}">✕</button></li>`).join('');
  };
  $('#estPhotos').addEventListener('change', async (e) => {
    const files = [...e.target.files].slice(0, 8 - estPhotos.length);
    e.target.value = '';
    for (const file of files) {
      const item = { preview: URL.createObjectURL(file), up: null };
      estPhotos.push(item);
      renderEstPhotos();
      try { item.up = await window.SiteForms.uploadPhoto(file); }
      catch (err) { estPhotos.splice(estPhotos.indexOf(item), 1); renderEstPhotos(); alert(`${file.name} : ${err.message}`); }
    }
  });
  photoList.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (b) { estPhotos.splice(+b.dataset.rm, 1); renderEstPhotos(); }
  });

  // Fourchette indicative = surface × prix au m² saisi par l'agence pour la commune (aucun chiffre si l'agence n'en a pas saisi)
  async function showIndicative(body) {
    try {
      const r = await fetch('/api/estimation/indicative', { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'site' }, body: JSON.stringify(body) });
      const { indicative: i } = await r.json();
      if (!i) return;
      const eur = (n) => n.toLocaleString('fr-FR') + '\u00a0€';
      const box = document.createElement('div');
      box.className = 'indicative';
      box.innerHTML = `<p class="indicative__label">Fourchette indicative pour ${esc(i.commune)}</p><strong>${eur(i.basse)} – ${eur(i.haute)}</strong><p class="indicative__note">Calcul automatique : surface × ${eur(i.prixM2)}/m² (prix moyen retenu par l'agence${i.source ? ` – ${esc(i.source)}` : ''}${i.date ? `, ${i.date.split('-').reverse().join('/')}` : ''}), à ± ${i.marge}\u00a0%. Estimation indicative, non contractuelle : seule une visite permet d'établir un avis de valeur fiable.</p>`;
      $('.wizard__msg', wiz).after(box);
    } catch { /* l'estimation indicative est facultative */ }
  }

  async function sendEstimation() {
    const F = window.SiteForms;
    const errs = F.checkContact(wiz, { requireTel: true });
    if (!F.showErrors(wiz, errs)) return;
    const err = $('.form-error', wiz);
    err.hidden = true;
    next.disabled = true;
    next.textContent = 'Envoi…';
    try {
      const r = await F.submit(wiz, {
        type: 'estimation',
        nom: wiz.nom.value, tel: wiz.tel.value, email: wiz.email.value,
        details: {
          typeBien: wiz.querySelector('input[name="bien"]:checked')?.value,
          ville: wiz.ville.value, adresse: wiz.adresse.value, surface: wiz.surface.value,
          pieces: wiz.pieces.value, etat: wiz.etat.value,
          atouts: $$('input[name="atouts"]:checked', wiz).map(c => c.value),
        },
        photos: estPhotos.filter(p => p.up).map(p => p.up),
      });
      steps.forEach(s => s.classList.remove('is-active'));
      $('.wizard__nav', wiz).remove();
      $('.wizard__count', wiz).hidden = true;
      bar.style.width = '100%';
      $('.wizard__msg', wiz).innerHTML = F.confirmation(r.code, r.emailSent);
      $('.wizard__done', wiz).hidden = false;
      showIndicative({ type: wiz.querySelector('input[name="bien"]:checked')?.value, ville: wiz.ville.value, surface: wiz.surface.value });
    } catch (e) {
      // Une erreur de champ renvoie à l'étape concernée
      const bad = wiz.querySelector('.is-error');
      const stepEl = bad?.closest('.wizard__step');
      if (stepEl) goStep(steps.indexOf(stepEl));
      err.textContent = e.message;
      err.hidden = false;
      next.disabled = false;
      next.textContent = 'Recevoir mon estimation';
    }
  }
  wiz.addEventListener('submit', e => e.preventDefault());

  // ---------- Formulaire de contact ----------
  const cf = $('#contactForm');
  cf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const F = window.SiteForms;
    if (!F.showErrors(cf, F.checkContact(cf))) return;
    const btn = $('button[type=submit]', cf);
    const err = $('.form-error', cf);
    err.hidden = true;
    btn.disabled = true;
    const [type, projet] = cf.projet.value.split('|');
    try {
      const r = await F.submit(cf, { type, projet: projet || cf.projet.selectedOptions[0].textContent, nom: cf.nom.value, tel: cf.tel.value, email: cf.email.value, message: cf.message.value });
      const ok = $('.form-ok', cf);
      ok.innerHTML = '<strong>Merci, votre message a bien été envoyé.</strong>' + F.confirmation(r.code, r.emailSent);
      ok.hidden = false;
      cf.reset();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Carte : chargée seulement après accord (Google dépose des cookies) ----------
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-map-load]');
    if (!b) return;
    const box = b.closest('[data-map]');
    box.innerHTML = `<iframe title="Plan d'accès" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(box.dataset.map)}&output=embed"></iframe>`;
  });

  // ---------- Recherche hero : ouvre la page « Nos biens » avec les critères choisis ----------
  const searchForm = $('.search');
  searchForm.addEventListener('submit', e => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (searchTransaction === 'location') p.set('transaction', 'location');
    if (searchForm.type.value) p.set('type', searchForm.type.value);
    if (searchForm.ville.value.trim()) p.set('q', searchForm.ville.value.trim());
    if (searchForm.budget.value) p.set('prixMax', searchForm.budget.value);
    location.href = '/biens' + (p.toString() ? `?${p}` : '');
  });

  // ---------- Avis clients : uniquement ceux saisis par l'agence, avec leur source ----------
  fetch('/api/avis').then(r => r.json()).then(({ global, avis }) => {
    if (!global) return;
    const note = global.note;
    $('#statAvis').hidden = false;
    $('#statNote').dataset.to = note;
    $('#statAvisLabel').textContent = `sur ${global.nombre} avis clients*`;
    $('#statFoot').hidden = false;
    $('#statFoot').textContent = `* ${global.source}${global.releveLe ? `, relevé le ${global.releveLe.split('-').reverse().join('/')}` : ''}.`;
    $('#avisNote').dataset.to = note;
    $('#avisStars').innerHTML = [1, 2, 3, 4, 5].map(n => `<i class="${n <= Math.floor(note) ? '' : n - note < 1 && n - note > 0 && note % 1 >= .5 ? 'half' : 'off'}"></i>`).join('');
    $('#avisStars').setAttribute('aria-label', `Note ${String(note).replace('.', ',')} sur 5`);
    $('#avisSub').textContent = `${global.nombre} avis · source : ${global.source}`;
    if (global.url) $('#avisLink').href = global.url;
    $('#avisList').innerHTML = avis.slice(0, 3).map(a => `<blockquote class="reviews__quote${a.texte.length > 140 ? ' reviews__quote--long' : ''}"><p>« ${esc(a.texte)} »</p><footer>${esc(a.auteur)}${a.date ? ` · ${esc(a.date.slice(0, 4))}` : ''} · ${esc(a.source)}</footer></blockquote>`).join('');
    $('#avis').hidden = false;
    $$('#statAvis .count, #avis .count').forEach(el => countIO.observe(el));
    $$('#avis .reveal').forEach(el => el.classList.add('is-in'));
  }).catch(() => {});
})();
