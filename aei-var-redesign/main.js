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
  const sections = navLinks.map(a => $(a.getAttribute('href'))).filter(Boolean);

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
  tabs.forEach(b => b.addEventListener('click', () => {
    tabs.forEach(t => { t.classList.toggle('is-active', t === b); t.setAttribute('aria-selected', t === b); });
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
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BADGE_CLASS = { 'Exclusivité': 'tag--gold', 'Coup de cœur': 'tag--light' };
  const cardHTML = (b) => {
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
    const badge = !b.vendu && b.badge ? `<span class="tag ${BADGE_CLASS[b.badge] || ''}">${esc(b.badge)}</span>` : '';
    const foot = b.vendu
      ? `<span class="bien__sold">Vendu par l'agence</span>`
      : `<strong>${b.prix ? esc(b.prix) + ' €' : 'Prix sur demande'}</strong><a href="#contact" class="bien__cta" aria-label="Demander une visite">→</a>`;
    const media = photos.length
      ? `<button type="button" class="bien__media" data-gallery="${esc(b.id)}" aria-label="Voir les ${photos.length} photo${photos.length > 1 ? 's' : ''} : ${esc(b.titre)}">${img}${badge}${count}</button>`
      : `<div class="bien__media">${badge}</div>`;
    return `<article class="bien reveal${b.vendu ? ' bien--sold' : ''}" data-cat="${b.vendu ? 'vendu' : esc(b.region)}">
      ${media}
      <div class="bien__body">
        <p class="bien__loc">${loc}</p>
        <h3>${esc(b.titre)}</h3>
        <ul class="bien__specs">${specs}</ul>
        <div class="bien__foot">${foot}</div>
      </div>
    </article>`;
  };
  let allBiens = [];
  const renderBiens = (list) => {
    // les biens en vente d'abord, les vendus à la fin
    const sorted = [...list].sort((a, b) => a.vendu - b.vendu);
    allBiens = sorted;
    grid.innerHTML = sorted.map(cardHTML).join('');
    $$('.bien', grid).forEach((el, i) => { el.style.setProperty('--d', `${(i % 3) * 0.08}s`); io.observe(el); });
  };
  const loadBiens = async () => {
    for (const url of ['/api/biens', 'data/biens.json']) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data)) return renderBiens(data);
      } catch {}
    }
    grid.innerHTML = '<p>Nos biens sont momentanément indisponibles. Appelez-nous au 04 94 07 26 35.</p>';
  };
  loadBiens();

  // ---------- Galerie photos plein écran ----------
  const lb = $('#lightbox');
  const lbImg = $('.lb__img', lb);
  let lbPhotos = [], lbIndex = 0, lbLastFocus = null;
  const lbShow = (i, dir = 0) => {
    lbIndex = (i + lbPhotos.length) % lbPhotos.length;
    lbImg.classList.remove('is-in');
    lbImg.style.setProperty('--from', `${dir * 40}px`);
    lbImg.onload = () => requestAnimationFrame(() => lbImg.classList.add('is-in'));
    lbImg.src = lbPhotos[lbIndex];
    $('.lb__count', lb).textContent = `${lbIndex + 1} / ${lbPhotos.length}`;
    $$('.lb__thumbs button', lb).forEach((t, n) => {
      t.classList.toggle('is-active', n === lbIndex);
      if (n === lbIndex) t.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' });
    });
    // précharge la suivante
    if (lbPhotos.length > 1) new Image().src = lbPhotos[(lbIndex + 1) % lbPhotos.length];
  };
  const lbOpen = (b) => {
    lbPhotos = b.photos?.length ? b.photos : [b.photo];
    $('.lb__title', lb).textContent = b.titre;
    $('.lb__meta', lb).textContent = [b.ville, b.vendu ? 'Vendu' : b.prix ? `${b.prix} €` : ''].filter(Boolean).join(' · ');
    $('.lb__cta', lb).hidden = !!b.vendu;
    $('.lb__thumbs', lb).innerHTML = lbPhotos.length > 1
      ? lbPhotos.map((p, n) => `<button type="button" data-n="${n}" aria-label="Photo ${n + 1}"><img src="${esc(p)}" alt=""></button>`).join('')
      : '';
    lb.classList.toggle('is-single', lbPhotos.length < 2);
    lbLastFocus = document.activeElement;
    lb.hidden = false;
    requestAnimationFrame(() => lb.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    lbShow(0);
    $('.lb__close', lb).focus();
  };
  const lbClose = () => {
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { lb.hidden = true; lbImg.removeAttribute('src'); }, reduced ? 0 : 400);
    lbLastFocus?.focus();
  };
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-gallery]');
    if (!btn) return;
    const b = allBiens.find(x => x.id === btn.dataset.gallery);
    if (b) lbOpen(b);
  });
  $('.lb__close', lb).addEventListener('click', lbClose);
  $('.lb__prev', lb).addEventListener('click', () => lbShow(lbIndex - 1, -1));
  $('.lb__next', lb).addEventListener('click', () => lbShow(lbIndex + 1, 1));
  $('.lb__thumbs', lb).addEventListener('click', (e) => {
    const t = e.target.closest('button[data-n]');
    if (t) lbShow(+t.dataset.n, +t.dataset.n > lbIndex ? 1 : -1);
  });
  $('.lb__cta', lb).addEventListener('click', lbClose);
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb__stage')) lbClose(); });
  addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') lbClose();
    if (e.key === 'ArrowRight' && lbPhotos.length > 1) lbShow(lbIndex + 1, 1);
    if (e.key === 'ArrowLeft' && lbPhotos.length > 1) lbShow(lbIndex - 1, -1);
    if (e.key === 'Tab') { // garde le focus dans la galerie
      const f = $$('button:not([hidden]), a:not([hidden])', lb).filter(el => el.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  });
  // balayage au doigt
  let touchX = null;
  $('.lb__stage', lb).addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  $('.lb__stage', lb).addEventListener('touchend', (e) => {
    if (touchX === null || lbPhotos.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) lbShow(lbIndex + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    touchX = null;
  });

  // ---------- Filtres biens ----------
  const filterBtns = $$('.filters button');
  filterBtns.forEach(btn => btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.toggle('is-active', b === btn));
    const f = btn.dataset.filter;
    let i = 0;
    $$('.bien', grid).forEach(card => {
      const show = f === 'all' || card.dataset.cat === f;
      card.classList.toggle('is-hidden', !show);
      if (show) {
        card.classList.remove('is-in');
        card.style.setProperty('--d', `${(i++ % 3) * 0.08}s`);
        requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('is-in')));
      }
    });
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
    if (!validate(steps[step])) return;
    if (step < steps.length - 1) return goStep(step + 1);
    // TODO : brancher sur l'outil de l'agence (CRM, Formspree, e-mail…)
    steps.forEach(s => s.classList.remove('is-active'));
    $('.wizard__nav', wiz).remove();
    $('.wizard__count', wiz).hidden = true;
    bar.style.width = '100%';
    $('.wizard__done', wiz).hidden = false;
  });
  wiz.addEventListener('submit', e => e.preventDefault());

  // ---------- Formulaire de contact ----------
  const cf = $('#contactForm');
  cf.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate(cf)) return;
    // TODO : brancher sur l'outil de l'agence (CRM, Formspree, e-mail…)
    $('.form-ok', cf).hidden = false;
    cf.reset();
  });

  // ---------- Recherche hero -> filtre biens ----------
  $('.search').addEventListener('submit', e => {
    e.preventDefault();
    $('#biens').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  });
})();
