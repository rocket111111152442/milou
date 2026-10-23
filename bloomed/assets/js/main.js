/* =========================================================
   BLOOMED — interactions (vanilla JS, aucune dépendance)
   ========================================================= */
(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Header, progression, barre mobile ---------- */
  const header = $('#header');
  const progress = $('.progress');
  const mobilebar = $('.mobilebar');
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    header.classList.toggle('is-scrolled', y > 30);
    progress.style.setProperty('--p', max > 0 ? Math.min(y / max, 1).toFixed(4) : 0);
    mobilebar.classList.toggle('is-visible', y > 420);
    parallax();
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

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
      setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 350);
    }
  }
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { setMenu(false); burger.focus(); }
  });

  /* ---------- Lien actif dans la nav ---------- */
  const navLinks = $$('.nav a');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        // le hero n'a pas de lien : tout s'éteint quand on y revient
        navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    [$('#accueil'), ...sections].forEach((s) => navObserver.observe(s));
  }

  /* ---------- Apparitions au scroll (le brouillard se dissipe) ---------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el) => revealObserver.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Bandeaux défilants : on remplit pour couvrir tout l'écran ---------- */
  function fillMarquees() {
    $$('.marquee__track').forEach((track) => {
      if (!track.dataset.base) track.dataset.base = track.innerHTML;
      track.innerHTML = track.dataset.base;
      let guard = 0;
      while (track.scrollWidth < window.innerWidth * 2 && guard++ < 8) track.innerHTML += track.dataset.base;
      // vitesse constante quelle que soit la longueur
      track.style.setProperty('--mdur', Math.round(track.scrollWidth / 60) + 's');
    });
  }
  fillMarquees();
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fillMarquees, 250); });

  /* ---------- Parallaxe des nuages du hero (souris + scroll) ---------- */
  const layers = $$('.hero .sky__layer');
  const pointer = { x: 0, y: 0 };

  function parallax() {
    if (reduceMotion || !layers.length) return;
    const y = window.scrollY;
    if (y > window.innerHeight * 1.2) return;
    layers.forEach((layer) => {
      const depth = parseFloat(layer.dataset.depth) || 0.2;
      const tx = pointer.x * depth * 40;
      const ty = pointer.y * depth * 24 + y * depth * 0.45;
      layer.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
    });
  }
  if (finePointer && !reduceMotion) {
    $('.hero').addEventListener('pointermove', (e) => {
      pointer.x = e.clientX / window.innerWidth - 0.5;
      pointer.y = e.clientY / window.innerHeight - 0.5;
      if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
    });
  }

  /* ---------- Inclinaison 3D au survol ---------- */
  if (finePointer && !reduceMotion) {
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transition = 'transform .12s ease-out';
        el.style.transform = `perspective(900px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 9).toFixed(2)}deg) translateY(-6px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .6s cubic-bezier(.3,1.6,.5,1)';
        el.style.transform = '';
      });
    });
  }

  /* ---------- Petits nuages qui suivent le curseur ---------- */
  const puffLayer = $('.puffs');
  const puffColors = ['#ffffff', '#ffd3e2', '#bff0dc', '#ffe8f0', '#dcf7ec'];
  let lastPuff = 0;
  let puffCount = 0;

  function spawnPuff(x, y, big = false) {
    if (puffCount > 40) return;
    const p = document.createElement('span');
    p.className = big ? 'puff puff--big' : 'puff';
    p.style.setProperty('--px', x + 'px');
    p.style.setProperty('--py', y + 'px');
    p.style.setProperty('--dx', (Math.random() * 30 - 15).toFixed(0) + 'px');
    p.style.setProperty('--c', puffColors[Math.floor(Math.random() * puffColors.length)]);
    puffLayer.appendChild(p);
    puffCount++;
    p.addEventListener('animationend', () => { p.remove(); puffCount--; }, { once: true });
  }

  if (finePointer && !reduceMotion) {
    window.addEventListener('pointermove', (e) => {
      const now = performance.now();
      if (now - lastPuff < 55) return;
      lastPuff = now;
      spawnPuff(e.clientX + 8, e.clientY + 10);
    }, { passive: true });

    // un clic dans le ciel fait éclore un petit groupe de nuages
    $$('.hero, .final').forEach((zone) => {
      zone.addEventListener('click', (e) => {
        if (e.target.closest('a, button')) return;
        for (let i = 0; i < 5; i++) {
          setTimeout(() => spawnPuff(e.clientX + (Math.random() * 60 - 30), e.clientY + (Math.random() * 30 - 15), true), i * 60);
        }
      });
    });
  }

  /* ---------- Galerie : visionneuse + double-clic « like » ---------- */
  const lightbox = $('.lightbox');
  const lbImg = $('img', lightbox);
  const lbCap = $('.lightbox__cap', lightbox);
  let lastTrigger = null;

  function openLightbox(tile) {
    lastTrigger = tile;
    const thumb = $('img', tile);
    lbImg.src = tile.dataset.full;
    lbImg.alt = thumb ? thumb.alt : '';
    lbCap.textContent = tile.dataset.caption || '';
    if (typeof lightbox.showModal === 'function') lightbox.showModal();
    else window.open(tile.dataset.full, '_blank', 'noopener');
  }
  function closeLightbox() {
    lightbox.close();
    if (lastTrigger) lastTrigger.focus();
  }
  $('.lightbox__close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

  $$('.tile[data-full]').forEach((tile) => {
    let clickTimer = null;
    tile.addEventListener('click', () => {
      if (clickTimer) {
        // double clic : cœur façon Instagram
        clearTimeout(clickTimer);
        clickTimer = null;
        tile.classList.remove('is-liked');
        void tile.offsetWidth;
        tile.classList.add('is-liked');
        return;
      }
      clickTimer = setTimeout(() => { clickTimer = null; openLightbox(tile); }, 260);
    });
  });

  /* ---------- Carrousel d'avis ---------- */
  $$('[data-carousel]').forEach((carousel) => {
    const track = $('.carousel__track', carousel);
    const step = () => {
      const card = track.firstElementChild;
      return card ? card.getBoundingClientRect().width + 22 : 300;
    };
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
        const rect = carousel.getBoundingClientRect();
        const visible = rect.top < window.innerHeight && rect.bottom > 0;
        if (!paused && visible && !document.hidden) go(1);
      }, 5000);
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
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { day, time: parseInt(get('hour'), 10) + parseInt(get('minute'), 10) / 60 };
  }

  function updateStatus() {
    const el = $('[data-status]');
    if (!el) return;
    const { day, time } = parisNow();
    $$('.hours tr').forEach((tr) => tr.classList.toggle('is-today', Number(tr.dataset.day) === day));

    const today = HOURS[day];
    let text;
    let open = false;
    if (today && time >= today[0] && time < today[1]) {
      open = true;
      text = `Ouvert · jusqu'à ${fmtH(today[1])}`;
    } else if (today && time < today[0]) {
      text = `Fermé · ouvre à ${fmtH(today[0])}`;
    } else {
      for (let i = 1; i <= 7; i++) {
        const d = (day + i) % 7;
        if (HOURS[d]) {
          text = `Fermé · ouvre ${i === 1 ? 'demain' : DAY_NAMES[d]} à ${fmtH(HOURS[d][0])}`;
          break;
        }
      }
    }
    el.classList.toggle('is-open', open);
    $('.status__text', el).textContent = text;
  }
  updateStatus();
  setInterval(updateStatus, 60 * 1000);

  /* ---------- Divers ---------- */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  onScroll();
})();
