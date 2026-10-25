/* =========================================================
   BLOOMED — interactions (vanilla JS, aucune dépendance)
   ========================================================= */
(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Effets dans les nuages ----------
     Chaque nuage est enveloppé pour recevoir : respiration, reflet de lumière
     irisé qui le traverse, halo, et réaction au curseur. */
  const FX_SELECTOR = '.cloud, .bank, .hero__front-cloud, .concept__cloud, .bar__cloud, .tile__cloud, .events__cloud';
  $$(FX_SELECTOR).forEach((img, i) => {
    if (img.tagName !== 'IMG') return;
    const wrap = document.createElement('span');
    wrap.className = img.className + ' cloudfx';
    if (img.getAttribute('style')) wrap.setAttribute('style', img.getAttribute('style'));
    if (img.dataset.depth) wrap.dataset.depth = img.dataset.depth;
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.setProperty("--mask", `url("${img.src}")`); // URL absolue : sinon résolue depuis le CSS
    wrap.style.setProperty('--fxd', (-(i * 1.7) % 9).toFixed(1) + 's');
    if (img.closest('.hero, .final')) wrap.classList.add('cloudfx--glow');
    img.className = 'cloudfx__img';
    img.removeAttribute('style');
    delete img.dataset.depth;
    img.replaceWith(wrap);
    wrap.appendChild(img);
  });

  // paillettes de lumière qui scintillent dans le ciel
  if (!reduceMotion) {
    $$('.hero .sky, .final .sky').forEach((sky) => {
      for (let i = 0; i < 16; i++) {
        const g = document.createElement('span');
        g.className = 'glint';
        g.style.cssText = `--x:${(Math.random() * 100).toFixed(1)}%;--y:${(Math.random() * 90).toFixed(1)}%;--s:${(2 + Math.random() * 4).toFixed(1)}px;--d:${(-Math.random() * 6).toFixed(1)}s;--t:${(4 + Math.random() * 4).toFixed(1)}s`;
        sky.appendChild(g);
      }
    });
  }

  // les effets s'arrêtent quand le nuage n'est pas à l'écran (économie de batterie)
  if ('IntersectionObserver' in window) {
    const fxObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle('fx-off', !e.isIntersecting));
    }, { rootMargin: '100px' });
    $$('.cloudfx').forEach((el) => fxObserver.observe(el));
  }

  /* ---------- Header, barre mobile, parallaxe ---------- */
  const header = $('#header');
  const mobilebar = $('.mobilebar');
  const parallaxEls = $$('[data-depth]').filter((el) => parseFloat(el.dataset.depth) > 0);
  const pointer = { x: 0, y: 0, px: -9999, py: -9999 };
  let ticking = false;

  function update() {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 30);
    mobilebar.classList.toggle('is-visible', y > 420);
    if (!reduceMotion) {
      parallaxEls.forEach((el) => {
        const d = parseFloat(el.dataset.depth);
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
        const center = r.top + r.height / 2 - window.innerHeight / 2;
        let ty = -center * d * 0.35 + pointer.y * d * 30;
        let tx = pointer.x * d * 50;
        // dans le hero, les nuages s'écartent quand on descend
        if (el.closest('.hero')) {
          const side = r.left + r.width / 2 < window.innerWidth / 2 ? -1 : 1;
          tx += side * Math.min(y, window.innerHeight) * d * 1.4;
        }
        // le curseur repousse doucement les nuages et les illumine
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = cx - pointer.px;
        const dy = cy - pointer.py;
        const dist = Math.hypot(dx, dy);
        const radius = Math.max(r.width, r.height) * 0.6 + 120;
        const near = dist < radius ? 1 - dist / radius : 0;
        if (near) { tx += (dx / dist) * near * 45; ty += (dy / dist) * near * 30; }
        el.classList.toggle('is-lit', near > 0.25);
        el.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
      });
    }
    ticking = false;
  }
  const requestUpdate = () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } };
  window.addEventListener('scroll', requestUpdate, { passive: true });
  if (finePointer && !reduceMotion) {
    window.addEventListener('pointermove', (e) => {
      pointer.x = e.clientX / window.innerWidth - 0.5;
      pointer.y = e.clientY / window.innerHeight - 0.5;
      pointer.px = e.clientX;
      pointer.py = e.clientY;
      requestUpdate();
    }, { passive: true });
  }

  /* ---------- Menu mobile ---------- */
  const burger = $('.burger');
  const menu = $('#menu');
  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
    } else {
      menu.classList.remove('is-open');
      setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 400);
    }
  }
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { setMenu(false); burger.focus(); }
  });

  /* ---------- Lien actif dans la nav ---------- */
  const navLinks = $$('.nav a');
  if ('IntersectionObserver' in window) {
    const targets = [$('#accueil'), ...navLinks.map((a) => $(a.getAttribute('href')))].filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach((t) => io.observe(t));
  }

  /* ---------- Apparitions au scroll ---------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Bandeau défilant ---------- */
  function fillMarquee() {
    $$('.marquee__track').forEach((track) => {
      if (!track.dataset.base) track.dataset.base = track.innerHTML;
      track.innerHTML = track.dataset.base;
      let guard = 0;
      while (track.scrollWidth < window.innerWidth * 2 && guard++ < 8) track.innerHTML += track.dataset.base;
      track.style.setProperty('--mdur', Math.round(track.scrollWidth / 45) + 's');
    });
  }
  fillMarquee();
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fillMarquee, 250); });

  /* ---------- Rideau de nuages entre les sections ---------- */
  const curtain = $('.curtain');
  let curtainBusy = false;
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = link.getAttribute('href');
    const target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const go = () => {
      document.documentElement.style.scrollBehavior = 'auto';
      target.scrollIntoView({ block: 'start' });
      document.documentElement.style.scrollBehavior = '';
      history.pushState(null, '', id);
    };
    if (menu.classList.contains('is-open')) setMenu(false);
    if (reduceMotion || !curtain) { go(); return; }
    if (curtainBusy) return;
    curtainBusy = true;
    curtain.classList.add('is-closed');
    setTimeout(() => {
      go();
      setTimeout(() => {
        curtain.classList.remove('is-closed');
        setTimeout(() => { curtainBusy = false; }, 800);
      }, 300);
    }, 800);
  });

  /* ---------- Galerie : visionneuse ---------- */
  const lightbox = $('.lightbox');
  const lbImg = $('img', lightbox);
  const lbCap = $('.lightbox__cap', lightbox);
  let lastTrigger = null;
  $$('.tile[data-full]').forEach((tile) => {
    tile.addEventListener('click', () => {
      lastTrigger = tile;
      lbImg.src = tile.dataset.full;
      lbImg.alt = ($('img', tile) || {}).alt || '';
      lbCap.textContent = tile.dataset.caption || '';
      if (typeof lightbox.showModal === 'function') lightbox.showModal();
      else window.open(tile.dataset.full, '_blank', 'noopener');
    });
  });
  const closeLightbox = () => { lightbox.close(); if (lastTrigger) lastTrigger.focus(); };
  $('.lightbox__close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

  /* ---------- Carrousel d'avis ---------- */
  $$('[data-carousel]').forEach((carousel) => {
    const track = $('.carousel__track', carousel);
    const step = () => (track.firstElementChild ? track.firstElementChild.getBoundingClientRect().width + 20 : 300);
    const go = (dir) => {
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
      if (dir > 0 && atEnd) track.scrollTo({ left: 0, behavior: 'smooth' });
      else track.scrollBy({ left: dir * step(), behavior: 'smooth' });
    };
    $('[data-prev]', carousel).addEventListener('click', () => go(-1));
    $('[data-next]', carousel).addEventListener('click', () => go(1));
    if (!reduceMotion) {
      let paused = false;
      ['pointerenter', 'focusin', 'touchstart'].forEach((ev) => carousel.addEventListener(ev, () => { paused = true; }, { passive: true }));
      ['pointerleave', 'focusout'].forEach((ev) => carousel.addEventListener(ev, () => { paused = false; }));
      setInterval(() => {
        const r = carousel.getBoundingClientRect();
        if (!paused && !document.hidden && r.top < window.innerHeight && r.bottom > 0) go(1);
      }, 5500);
    }
  });

  /* ---------- Ouvert / fermé (heure de Paris) ---------- */
  // 0 = dimanche … 6 = samedi ; [ouverture, fermeture] en heures
  const HOURS = { 1: [10, 19], 2: [10, 19], 3: [10, 19], 5: [10, 19], 6: [10, 19] };
  const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const fmtH = (h) => (Number.isInteger(h) ? h + 'h' : Math.floor(h) + 'h' + String(Math.round((h % 1) * 60)).padStart(2, '0'));

  function parisNow() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Paris', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    return {
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
      time: parseInt(get('hour'), 10) + parseInt(get('minute'), 10) / 60,
    };
  }
  function updateStatus() {
    const el = $('[data-status]');
    if (!el) return;
    const { day, time } = parisNow();
    $$('.hours tr').forEach((tr) => tr.classList.toggle('is-today', Number(tr.dataset.day) === day));
    const today = HOURS[day];
    let text = '';
    let open = false;
    if (today && time >= today[0] && time < today[1]) {
      open = true;
      text = `Ouvert · jusqu'à ${fmtH(today[1])}`;
    } else if (today && time < today[0]) {
      text = `Fermé · ouvre à ${fmtH(today[0])}`;
    } else {
      for (let i = 1; i <= 7; i++) {
        const d = (day + i) % 7;
        if (HOURS[d]) { text = `Fermé · ouvre ${i === 1 ? 'demain' : DAY_NAMES[d]} à ${fmtH(HOURS[d][0])}`; break; }
      }
    }
    el.classList.toggle('is-open', open);
    $('.status__text', el).textContent = text;
  }
  updateStatus();
  setInterval(updateStatus, 60 * 1000);

  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  update();
})();
