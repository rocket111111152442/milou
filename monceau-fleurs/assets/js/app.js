/* =========================================================
   Monceau Fleurs — La Seyne-sur-Mer · interactions & animations
   ========================================================= */
(() => {
  'use strict';

  const D = window.MF;
  const C = D.config;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const hasFlip = hasGSAP && typeof window.Flip !== 'undefined';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const img = (id, w, h) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ''}&q=75`;
  const euro = n => n.toFixed(2).replace('.', ',') + ' €';
  const money = n => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')) + ' €';
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } }
  };

  if (hasGSAP) gsap.registerPlugin(ScrollTrigger, ...(hasFlip ? [Flip] : []));

  /* ---------- Défilement fluide ---------- */
  let lenis = null;
  if (hasGSAP && !reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const lockScroll = on => { if (lenis) on ? lenis.stop() : lenis.start(); document.body.style.overflow = on ? 'hidden' : ''; };
  function scrollToTarget(target) {
    if (lenis) return lenis.scrollTo(target, { offset: target === 0 ? 0 : -40, duration: 1.4 });
    if (target === 0) return window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    const el = typeof target === 'string' ? $(target) : target;
    if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }

  /* ---------- Utilitaires de découpage de texte ---------- */
  function splitWords(el, cls = 'word', wrap = true) {
    const out = [];
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span');
          w.className = cls; w.textContent = part; out.push(w);
          if (wrap) { const ww = document.createElement('span'); ww.className = 'word-wrap'; ww.append(w); frag.append(ww); }
          else frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
    walk(el);
    return out;
  }
  function splitChars(el) {
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span');
          w.style.cssText = 'display:inline-block;white-space:nowrap';
          [...part].forEach(ch => { const s = document.createElement('span'); s.className = 'char'; s.textContent = ch; w.append(s); });
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
    walk(el);
    return $$('.char', el);
  }

  /* ---------- Heure de Paris & horaires ---------- */
  const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const fmtH = t => { const [h, m] = t.split(':'); return `${+h}h${m === '00' ? '' : m}`; };
  const toMin = t => { const [h, m] = t.split(':'); return +h * 60 + +m; };
  function parisNow() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const get = t => parts.find(p => p.type === t).value;
    return { day: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get('weekday')], min: (+get('hour') % 24) * 60 + +get('minute') };
  }
  function updateStatus() {
    const el = $('#openStatus'); if (!el) return;
    const { day, min } = parisNow();
    const today = C.hours[day];
    let open = false, txt;
    if (today && min >= toMin(today[0]) && min < toMin(today[1])) { open = true; txt = `Ouvert · ferme à ${fmtH(today[1])}`; }
    else if (today && min < toMin(today[0])) txt = `Fermé · ouvre à ${fmtH(today[0])}`;
    else {
      for (let i = 1; i <= 7; i++) {
        const d = (day + i) % 7; const h = C.hours[d];
        if (h) { txt = `Fermé · ouvre ${i === 1 ? 'demain' : DAYS[d].toLowerCase()} ${fmtH(h[0])}`; break; }
      }
    }
    el.classList.toggle('is-open', open); el.classList.toggle('is-closed', !open);
    el.lastElementChild.textContent = txt || 'Fermé';
  }
  function renderHours() {
    const { day } = parisNow();
    $('#hoursTable').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d => {
      const h = C.hours[d];
      return `<tr class="${d === day ? 'is-today' : ''}"><td>${DAYS[d]}</td><td>${h ? `${fmtH(h[0])} – ${fmtH(h[1])}` : 'Fermé'}</td></tr>`;
    }).join('');
  }

  /* ---------- Contenus dynamiques ---------- */
  function fillStatic() {
    $('#year').textContent = new Date().getFullYear();
    $$('.js-maps').forEach(a => { a.href = C.mapsUrl; });
    if (C.phone) {
      $$('.js-phone-row').forEach(r => { r.hidden = false; });
      $$('.js-phone').forEach(a => { a.href = 'tel:' + C.phone.replace(/\s/g, ''); a.textContent = C.phone; });
    }
    renderHours();
    updateStatus();
    setInterval(updateStatus, 60000);
  }

  /* ---------- Rendez-vous de saison ---------- */
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }
  const nthSunday = (y, m, n) => { const d = new Date(y, m, 1); d.setDate(1 + (7 - d.getDay()) % 7 + 7 * (n - 1)); return d; };
  const lastSunday = (y, m) => { const d = new Date(y, m + 1, 0); d.setDate(d.getDate() - d.getDay()); return d; };
  function seasonEvents(y) {
    let meres = lastSunday(y, 4);
    if (meres.getTime() === addDays(easter(y), 49).getTime()) meres = addDays(meres, 7);
    return [
      { date: new Date(y, 1, 14), title: 'Saint-<em>Valentin</em>', desc: 'Roses rouges, compositions en cœur, bouquets passion : déclarez votre flamme. Réservez dès maintenant pour un retrait au Drive ou une livraison le jour J.' },
      { date: nthSunday(y, 2, 1), title: 'Fête des <em>grands-mères</em>', desc: 'Un bouquet tendre pour celle qui a tout donné. Retrait en boutique, au Drive ou livraison à domicile.' },
      { date: new Date(y, 4, 1), title: 'Muguet du <em>1er mai</em>', desc: 'Brins, pots et bouquets de muguet porte-bonheur. Réservez-les pour être sûr d\'en avoir !' },
      { date: meres, title: 'Fête des <em>mères</em>', desc: 'Le grand rendez-vous fleuri de l\'année. Commandez à l\'avance bouquets, plantes fleuries et compositions.' },
      { date: nthSunday(y, 5, 3), title: 'Fête des <em>pères</em>', desc: 'Plantes graphiques, bouquets aux tons francs : les papas aussi méritent des fleurs.' },
      { date: new Date(y, 10, 1), title: '<em>Toussaint</em>', desc: 'Chrysanthèmes, compositions et coussins pour honorer ceux que nous aimons. Réservez dès maintenant, retrait en boutique ou au Drive.' },
      { date: new Date(y, 11, 25), title: 'Noël <em>fleuri</em>', desc: 'Centres de table, couronnes de porte, amaryllis : faites entrer la magie des fêtes dans la maison.' }
    ];
  }
  function initSeason() {
    const now = new Date();
    const list = [...seasonEvents(now.getFullYear()), ...seasonEvents(now.getFullYear() + 1)];
    const ev = list.find(e => addDays(e.date, 1) > now);
    const isToday = ev.date <= now;
    const dateTxt = ev.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/ 1 /, ' 1er ');
    $('#seasonEyebrow').textContent = isToday ? "C'est aujourd'hui !" : `Prochain rendez-vous · ${dateTxt}`;
    $('#seasonTitle').innerHTML = ev.title;
    $('#seasonDesc').textContent = ev.desc;
    const nums = { d: $('[data-unit="d"]'), h: $('[data-unit="h"]'), m: $('[data-unit="m"]'), s: $('[data-unit="s"]') };
    const tick = () => {
      let diff = Math.max(0, ev.date - new Date());
      const vals = { d: Math.floor(diff / 864e5), h: Math.floor(diff / 36e5) % 24, m: Math.floor(diff / 6e4) % 60, s: Math.floor(diff / 1e3) % 60 };
      Object.keys(vals).forEach(k => {
        const v = String(vals[k]).padStart(2, '0');
        if (nums[k].textContent !== v) {
          nums[k].textContent = v;
          if (hasGSAP && !reduce) gsap.fromTo(nums[k], { yPercent: -45, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .45, ease: 'power3.out' });
        }
      });
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Toast & confettis de pétales ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.innerHTML = `<svg><use href="#i-check"/></svg>${msg}`;
    t.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('is-on'), 2600);
  }
  const PETAL_COLORS = ['#f6c9d3', '#f2a3b5', '#fbe3e8', '#e07a96', '#ffffff', '#f7d6c8', '#c2456a'];
  function drawPetal(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.scale(1, Math.max(.25, Math.abs(Math.cos(p.flip))));
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.moveTo(0, -p.s);
    ctx.bezierCurveTo(p.s * .9, -p.s * .6, p.s * .7, p.s * .7, 0, p.s);
    ctx.bezierCurveTo(-p.s * .7, p.s * .7, -p.s * .9, -p.s * .6, 0, -p.s);
    ctx.fill();
    ctx.restore();
  }
  const burstCanvas = $('#burst');
  const bctx = burstCanvas.getContext('2d');
  let bParts = [], bRunning = false;
  function burst(x, y, n = 70) {
    if (reduce) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    burstCanvas.width = innerWidth * dpr; burstCanvas.height = innerHeight * dpr;
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 9;
      bParts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 6, s: 5 + Math.random() * 7, a: Math.random() * 6, va: (Math.random() - .5) * .3, flip: Math.random() * 6, c: PETAL_COLORS[i % PETAL_COLORS.length], alpha: 1 });
    }
    if (!bRunning) { bRunning = true; requestAnimationFrame(bLoop); }
  }
  function bLoop() {
    bctx.clearRect(0, 0, innerWidth, innerHeight);
    bParts.forEach(p => { p.vy += .28; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.a += p.va; p.flip += .12; p.alpha -= .009; drawPetal(bctx, p); });
    bParts = bParts.filter(p => p.alpha > 0 && p.y < innerHeight + 40);
    if (bParts.length) requestAnimationFrame(bLoop);
    else { bRunning = false; bctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* ---------- Pétales du hero ---------- */
  function initPetals() {
    const canvas = $('#petals');
    if (!canvas || reduce) return;
    const ctx = canvas.getContext('2d');
    const hero = $('#hero');
    let w, h, ps = [], running = true, mouse = { x: -999, y: -999 };
    const make = initial => ({ x: Math.random() * w, y: initial ? Math.random() * h : -20, s: 5 + Math.random() * 8, vy: .35 + Math.random() * .8, vx: -.25 + Math.random() * .5, a: Math.random() * 6.3, va: (Math.random() - .5) * .03, sw: Math.random() * 6.3, flip: Math.random() * 6.3, c: PETAL_COLORS[Math.floor(Math.random() * 6)], alpha: .55 + Math.random() * .35, pushX: 0, pushY: 0 });
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.min(34, Math.round(w / 48));
      while (ps.length < target) ps.push(make(true));
      ps.length = target;
    }
    function loop() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      ps.forEach(p => {
        p.sw += .018; p.flip += .025; p.a += p.va;
        const dx = p.x - mouse.x, dy = p.y - mouse.y, dist = Math.hypot(dx, dy);
        if (dist < 120) { const f = (120 - dist) / 120; p.pushX += (dx / dist) * f * 1.6; p.pushY += (dy / dist) * f * 1.6; }
        p.pushX *= .92; p.pushY *= .92;
        p.x += p.vx + Math.sin(p.sw) * .55 + p.pushX;
        p.y += p.vy + p.pushY;
        if (p.y > h + 20 || p.x < -40 || p.x > w + 40) Object.assign(p, make(false));
        drawPetal(ctx, p);
      });
      requestAnimationFrame(loop);
    }
    resize();
    addEventListener('resize', resize);
    hero.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    hero.addEventListener('mouseleave', () => { mouse.x = mouse.y = -999; });
    new IntersectionObserver(([en]) => { const was = running; running = en.isIntersecting; if (running && !was) loop(); }).observe(hero);
    loop();
  }

  /* ---------- Curseur & effets magnétiques ---------- */
  function initCursor() {
    if (!fine || reduce || !hasGSAP) return;
    document.documentElement.classList.add('has-cursor');
    const cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
    gsap.set(cur, { opacity: 0 });
    const dx = gsap.quickTo(dot, 'x', { duration: .08 }), dy = gsap.quickTo(dot, 'y', { duration: .08 });
    const rx = gsap.quickTo(ring, 'x', { duration: .45, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: .45, ease: 'power3' });
    let shown = false;
    addEventListener('mousemove', e => {
      if (!shown) { shown = true; gsap.to(cur, { opacity: 1, duration: .3 }); }
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    });
    document.addEventListener('mouseleave', () => { shown = false; gsap.to(cur, { opacity: 0, duration: .3 }); });
    document.addEventListener('mouseover', e => {
      const lab = e.target.closest('[data-cursor]');
      const onBtn = e.target.closest('button');
      const hov = e.target.closest('a, button, label, .svc, .fl, .bq-head');
      const showLabel = lab && !onBtn;
      cur.classList.toggle('is-label', !!showLabel);
      cur.classList.toggle('is-hover', !!hov && !showLabel);
      label.textContent = showLabel ? lab.dataset.cursor : '';
    });
  }
  function initMagnetic() {
    if (!fine || reduce || !hasGSAP) return;
    $$('.magnetic').forEach(el => {
      const xTo = gsap.quickTo(el, 'x', { duration: .7, ease: 'elastic.out(1, .4)' });
      const yTo = gsap.quickTo(el, 'y', { duration: .7, ease: 'elastic.out(1, .4)' });
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * .3);
        yTo((e.clientY - r.top - r.height / 2) * .4);
      });
      el.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ---------- En-tête, menu, navigation ---------- */
  function initHeader() {
    const header = $('#header'), totop = $('#totop'), bar = $('#totopBar');
    let lastY = scrollY, ticking = false;
    const onScroll = () => {
      const y = scrollY;
      header.classList.toggle('is-scrolled', y > 30);
      if (!document.body.classList.contains('menu-open')) header.classList.toggle('is-hidden', y > 500 && y > lastY + 2);
      if (y < lastY - 2) header.classList.remove('is-hidden');
      lastY = y;
      const max = document.documentElement.scrollHeight - innerHeight;
      totop.classList.toggle('is-on', y > innerHeight);
      bar.style.strokeDashoffset = 138.2 * (1 - Math.min(1, y / max));
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
    totop.addEventListener('click', () => scrollToTarget(0));

    const burger = $('#burger');
    const setMenu = on => {
      document.body.classList.toggle('menu-open', on);
      burger.setAttribute('aria-expanded', on);
      burger.setAttribute('aria-label', on ? 'Fermer le menu' : 'Ouvrir le menu');
      lockScroll(on);
    };
    burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));

    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      e.preventDefault();
      if (document.body.classList.contains('menu-open')) setMenu(false);
      if (a.dataset.subject) $('#subject').value = a.dataset.subject;
      if (a.dataset.goFilter) applyFilter(a.dataset.goFilter);
      scrollToTarget(id === '#top' ? 0 : id);
    });

    const links = $$('.nav a');
    const navSections = links.map(l => $(l.getAttribute('href')));
    const markActive = () => {
      const mid = innerHeight / 2;
      const cur = navSections.find(sec => { const r = sec.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; });
      links.forEach((l, i) => l.classList.toggle('is-active', navSections[i] === cur));
    };
    addEventListener('scroll', () => requestAnimationFrame(markActive), { passive: true });

    const bar2 = $('#demoBar');
    try { if (sessionStorage.getItem('mf-demo') === '1') bar2.classList.add('is-hidden'); } catch (e) { /* stockage indisponible */ }
    $('.demo-bar__close').addEventListener('click', () => { bar2.classList.add('is-hidden'); try { sessionStorage.setItem('mf-demo', '1'); } catch (e) { /* ignore */ } });
  }

  /* ---------- Boutique ---------- */
  function renderProducts() {
    $('#products').innerHTML = D.products.map(p => `
      <article class="card" data-id="${p.id}" data-cats="${p.cats.join(' ')}" data-cursor="Voir" tabindex="0" aria-label="${p.name}, ${p.price} euros">
        <div class="card__media">
          ${p.tag ? `<span class="card__tag">${p.tag}</span>` : ''}
          <img src="${img(p.img, 640, 800)}" srcset="${img(p.img, 400, 500)} 400w, ${img(p.img, 640, 800)} 640w, ${img(p.img, 900, 1125)} 900w" sizes="(max-width: 600px) 50vw, (max-width: 1100px) 33vw, 25vw" alt="${p.name}" width="640" height="800" loading="lazy">
          <button class="card__add" data-add="${p.id}" aria-label="Ajouter ${p.name} au panier"><svg><use href="#i-bag"/></svg>Ajouter</button>
        </div>
        <div class="card__info"><h3 class="card__name">${p.name}</h3><span class="card__price">${money(p.price)}</span></div>
        <p class="card__desc">${p.desc}</p>
      </article>`).join('');
  }
  function movePill() {
    const act = $('.filter.is-active'), pill = $('.filters__pill');
    if (!act || !pill) return;
    pill.style.width = act.offsetWidth + 'px';
    pill.style.height = act.offsetHeight + 'px';
    pill.style.transform = `translate(${act.offsetLeft}px, ${act.offsetTop}px)`;
  }
  function applyFilter(f) {
    $$('.filter').forEach(b => { const on = b.dataset.filter === f; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on); });
    movePill();
    const cards = $$('.card');
    const state = hasFlip && !reduce ? Flip.getState(cards) : null;
    cards.forEach(c => c.classList.toggle('is-hidden', f !== 'all' && !c.dataset.cats.split(' ').includes(f)));
    if (state) {
      Flip.from(state, {
        duration: .7, ease: 'power3.inOut', absolute: true, scale: true, stagger: .02,
        onEnter: els => gsap.fromTo(els, { opacity: 0, scale: .85 }, { opacity: 1, scale: 1, duration: .6, delay: .15 }),
        onLeave: els => gsap.to(els, { opacity: 0, scale: .85, duration: .35 }),
        onComplete: () => ScrollTrigger.refresh()
      });
    } else if (hasGSAP) ScrollTrigger.refresh();
  }
  function initShop() {
    renderProducts();
    $$('.filter').forEach(b => b.addEventListener('click', () => applyFilter(b.dataset.filter)));
    movePill();
    addEventListener('resize', movePill);
    document.fonts && document.fonts.ready.then(movePill);

    const grid = $('#products');
    grid.addEventListener('click', e => {
      const add = e.target.closest('[data-add]');
      const card = e.target.closest('.card');
      if (!card) return;
      const p = D.products.find(x => x.id === card.dataset.id);
      if (add) { e.stopPropagation(); addToCart({ key: p.id + '-classique', name: p.name, price: p.price, img: p.img, meta: 'Classique' }, card.querySelector('img')); }
      else openQuick(p);
    });
    grid.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.target.closest('button')) return;
      const card = e.target.closest('.card');
      if (card) openQuick(D.products.find(x => x.id === card.dataset.id));
    });
    if (fine && hasGSAP && !reduce) {
      grid.addEventListener('mousemove', e => {
        const media = e.target.closest('.card__media'); if (!media) return;
        const r = media.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        gsap.to(media, { rotateY: px * 10, rotateX: -py * 10, transformPerspective: 900, duration: .5, ease: 'power2.out' });
      });
      grid.addEventListener('mouseout', e => {
        const media = e.target.closest('.card__media');
        if (media && !media.contains(e.relatedTarget)) gsap.to(media, { rotateY: 0, rotateX: 0, duration: .8, ease: 'elastic.out(1, .5)' });
      });
    }
  }

  /* ---------- Fiche produit ---------- */
  let qv = null, lastFocus = null;
  function openModal(m) { lastFocus = document.activeElement; m.classList.add('is-open'); m.setAttribute('aria-hidden', 'false'); lockScroll(true); setTimeout(() => (m.querySelector('.modal__close') || m.querySelector('button')).focus(), 50); }
  function closeModal(m) { m.classList.remove('is-open'); m.setAttribute('aria-hidden', 'true'); lockScroll(false); if (lastFocus) lastFocus.focus({ preventScroll: true }); }
  function openQuick(p) {
    qv = { p, size: D.sizes[0] };
    $('#qvImg').src = img(p.img, 900, 1100);
    $('#qvImg').alt = p.name;
    $('#qvTag').textContent = p.tag || 'Création maison';
    $('#qvName').textContent = p.name;
    $('#qvDesc').textContent = p.desc;
    $('#qvMsg').value = '';
    $('#qvSizes').innerHTML = D.sizes.map((s, i) => `<button class="size${i ? '' : ' is-active'}" data-size="${s.id}">${s.label}<small>${s.add ? '+' + s.add + ' €' : 'inclus'}</small></button>`).join('');
    updateQvPrice();
    openModal($('#modal'));
    if (hasGSAP && !reduce) {
      gsap.fromTo('#qvImg', { scale: 1.25 }, { scale: 1, duration: 1.2, ease: 'expo.out' });
      gsap.fromTo('.modal__body > *', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .7, stagger: .05, ease: 'power3.out', delay: .1 });
    }
  }
  function updateQvPrice() { $('#qvPrice').textContent = money(qv.p.price + qv.size.add); }
  function initModal() {
    const m = $('#modal');
    $('#qvSizes').addEventListener('click', e => {
      const b = e.target.closest('.size'); if (!b) return;
      $$('.size').forEach(x => x.classList.toggle('is-active', x === b));
      qv.size = D.sizes.find(s => s.id === b.dataset.size);
      updateQvPrice();
      if (hasGSAP) gsap.fromTo('#qvPrice', { scale: 1.2, color: '#c2456a' }, { scale: 1, color: '#1c2847', duration: .5 });
    });
    $('#qvAdd').addEventListener('click', () => {
      const msg = $('#qvMsg').value.trim();
      addToCart({ key: `${qv.p.id}-${qv.size.id}${msg ? '-' + Date.now() : ''}`, name: qv.p.name, price: qv.p.price + qv.size.add, img: qv.p.img, meta: qv.size.label + (msg ? ` · « ${msg} »` : '') }, $('#qvImg'));
      closeModal(m);
    });
    $('#modalClose').addEventListener('click', () => closeModal(m));
    m.addEventListener('click', e => { if (e.target === m) closeModal(m); });
    const s = $('#success');
    $('#successClose').addEventListener('click', () => closeModal(s));
    s.addEventListener('click', e => { if (e.target === s) closeModal(s); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (m.classList.contains('is-open')) closeModal(m);
      if (s.classList.contains('is-open')) closeModal(s);
      if ($('#drawer').classList.contains('is-open')) setDrawer(false);
      if (document.body.classList.contains('menu-open')) $('#burger').click();
    });
  }

  /* ---------- Panier ---------- */
  let cart = store.get('mf-cart') || [];
  const saveCart = () => store.set('mf-cart', cart);
  function bumpCart() { const b = $('#cartBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  function fly(fromEl, src) {
    $('#header').classList.remove('is-hidden');
    if (!hasGSAP || reduce || !fromEl) return bumpCart();
    const r = fromEl.getBoundingClientRect(), t = $('#cartBtn').getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'fly';
    d.innerHTML = src ? `<img src="${img(src, 140, 140)}" alt="">` : '<svg style="width:100%;height:100%;padding:12px;color:#c2456a;background:#fff"><use href="#i-flower"/></svg>';
    document.body.append(d);
    gsap.set(d, { x: r.left + r.width / 2 - 32, y: r.top + r.height / 2 - 32, scale: .3 });
    gsap.timeline({ onComplete: () => { d.remove(); bumpCart(); } })
      .to(d, { scale: 1, duration: .35, ease: 'back.out(2)' })
      .to(d, { x: t.left + t.width / 2 - 32, duration: .85, ease: 'power1.inOut' }, .25)
      .to(d, { y: t.top + t.height / 2 - 32, duration: .85, ease: 'back.in(1.6)' }, .25)
      .to(d, { scale: .2, duration: .3, ease: 'power2.in' }, .85);
  }
  function addToCart(item, fromEl) {
    const ex = cart.find(i => i.key === item.key);
    if (ex) ex.qty++; else cart.push({ ...item, qty: 1 });
    saveCart(); renderCart(); fly(fromEl, item.img);
    toast(`${item.name} ajouté au panier`);
  }
  function renderCart() {
    const count = cart.reduce((s, i) => s + i.qty, 0);
    const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
    $('#cartCount').textContent = count;
    $('#cartTotal').textContent = euro(total);
    $('#cartFoot').classList.toggle('is-empty', !cart.length);
    $('#cartItems').innerHTML = cart.length ? cart.map((i, idx) => `
      <div class="ci" data-idx="${idx}">
        <div class="ci__img">${i.img ? `<img src="${img(i.img, 160, 190)}" alt="">` : '<svg style="color:#c2456a"><use href="#i-flower"/></svg>'}</div>
        <div><div class="ci__name">${i.name}</div><div class="ci__meta">${i.meta || ''}</div></div>
        <div class="ci__side"><span class="ci__price">${euro(i.price * i.qty)}</span>
          <div class="qty"><button data-q="-1" aria-label="Retirer un">−</button><output>${i.qty}</output><button data-q="1" aria-label="Ajouter un">+</button></div>
        </div>
      </div>`).join('')
      : `<div class="drawer__empty"><svg><use href="#i-flower"/></svg><p>Votre panier est encore vide…<br>mais pas pour longtemps&nbsp;!</p><a href="#boutique" class="btn btn--primary btn--sm" data-close-drawer><span>Voir la boutique</span></a></div>`;
  }
  function setDrawer(on) {
    $('#drawer').classList.toggle('is-open', on);
    $('#drawer').setAttribute('aria-hidden', !on);
    $('#overlay').classList.toggle('is-on', on);
    lockScroll(on);
    if (on && hasGSAP && !reduce) gsap.fromTo('.ci, .drawer__empty', { x: 40, opacity: 0 }, { x: 0, opacity: 1, stagger: .06, duration: .6, ease: 'power3.out', delay: .2 });
    if (on) setTimeout(() => $('#drawerClose').focus(), 60);
  }
  function initCart() {
    renderCart();
    $('#cartBtn').addEventListener('click', () => setDrawer(true));
    $('#drawerClose').addEventListener('click', () => setDrawer(false));
    $('#overlay').addEventListener('click', () => setDrawer(false));
    $('#cartItems').addEventListener('click', e => {
      if (e.target.closest('[data-close-drawer]')) { setDrawer(false); return; }
      const b = e.target.closest('[data-q]'); if (!b) return;
      const idx = +b.closest('.ci').dataset.idx;
      cart[idx].qty += +b.dataset.q;
      if (cart[idx].qty <= 0) cart.splice(idx, 1);
      saveCart(); renderCart(); bumpCart();
    });
    $('#checkout').addEventListener('click', () => {
      if (!cart.length) return;
      const mode = $('input[name="mode"]:checked').value;
      const labels = { boutique: 'à retirer en boutique', drive: 'à récupérer au Drive', livraison: 'en livraison' };
      const n = cart.reduce((s, i) => s + i.qty, 0);
      const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
      $('#successText').textContent = `Votre commande de ${n} article${n > 1 ? 's' : ''} (${euro(total)}) ${labels[mode]} a bien été enregistrée.`;
      cart = []; saveCart(); renderCart();
      setDrawer(false);
      setTimeout(() => { openModal($('#success')); burst(innerWidth / 2, innerHeight / 2, 110); }, 350);
    });
  }

  /* ---------- Atelier : compositeur de bouquet ---------- */
  function initBuilder() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const F = Object.fromEntries(D.flowers.map(f => [f.id, f]));
    const SCALE = { rose: .84, pivoine: .92, tulipe: .74, renoncule: .78, tournesol: .9, lys: .88, gypso: .8, euca: .9 };
    const FOLIAGE = ['euca', 'gypso'];
    const MAX = 30;
    const stemsG = $('#bqStems'), headsG = $('#bqHeads');
    const back = document.createElementNS(svgNS, 'g'), front = document.createElementNS(svgNS, 'g');
    headsG.append(back, front);
    let stems = [], wrap = D.wraps[0], seed = Math.random() * 6.28, priceShown = { v: 0 }, pending = [];

    $('#flowerList').innerHTML = D.flowers.map(f => `
      <div class="fl" data-f="${f.id}">
        <div class="fl__ic"><svg viewBox="-50 -50 100 100"><use href="#f-${f.id}" x="-50" y="-50" width="100" height="100"/></svg></div>
        <div class="fl__txt"><strong>${f.name}</strong><span>${money(f.price)} la tige</span></div>
        <div class="qty"><button data-d="-1" aria-label="Retirer une ${f.name}">−</button><output>0</output><button data-d="1" aria-label="Ajouter une ${f.name}">+</button></div>
      </div>`).join('');
    $('#wrapList').innerHTML = D.wraps.map((w, i) => `<button class="wrap-opt${i ? '' : ' is-active'}" data-w="${w.id}"><i style="background:${w.color}"></i>${w.name} <small>+${w.price} €</small></button>`).join('');

    const counts = () => stems.reduce((o, s) => (o[s.fid] = (o[s.fid] || 0) + 1, o), {});
    const total = () => stems.reduce((s, st) => s + F[st.fid].price, 0) + (stems.length ? wrap.price : 0);

    function render(st) {
      st.head.setAttribute('transform', `translate(${st.x.toFixed(1)} ${st.y.toFixed(1)}) rotate(${st.rot.toFixed(1)}) scale(${Math.max(st.s, .001).toFixed(3)})`);
      const bx = 200 + (st.x - 200) * .07, by = 446;
      st.line.setAttribute('d', `M${st.x.toFixed(1)} ${(st.y + 10).toFixed(1)} Q${((st.x + bx) / 2 + (st.x - 200) * .12).toFixed(1)} ${((st.y + by) / 2).toFixed(1)} ${bx.toFixed(1)} ${by}`);
      st.line.style.opacity = Math.min(1, st.s * 1.6);
    }
    function tween(st, vars, opts = {}) {
      if (hasGSAP && !reduce) gsap.to(st, { ...vars, ...opts, overwrite: 'auto', onUpdate: () => render(st), onComplete: opts.onComplete });
      else { Object.assign(st, vars); render(st); opts.onComplete && opts.onComplete(); }
    }
    function layout(newSt) {
      const n = stems.length;
      const R = Math.min(26 + 20 * Math.sqrt(n), 132);
      stems.forEach((st, i) => {
        const r = n === 1 ? 0 : R * Math.sqrt((i + .5) / n);
        const a = i * 2.39996 + seed;
        const k = R ? r / R : 0;
        const tx = 200 + r * Math.cos(a), ty = 182 + r * Math.sin(a) * .64 + k * 22;
        const ts = SCALE[st.fid] * (1.06 - .16 * k) * (n > 18 ? .88 : 1);
        if (st === newSt) tween(st, { x: tx, y: ty, s: ts }, { duration: 1, ease: 'elastic.out(1, .55)' });
        else tween(st, { x: tx, y: ty, s: ts }, { duration: .8, ease: 'power3.out' });
      });
    }
    function update() {
      const c = counts();
      $$('.fl').forEach(el => { const q = c[el.dataset.f] || 0; el.querySelector('output').textContent = q; el.classList.toggle('has-qty', q > 0); });
      const n = stems.length, t = total();
      $('#bqCount').textContent = `${n} tige${n > 1 ? 's' : ''}`;
      $('#bqAdd').disabled = !n;
      $('#bqEmpty').style.display = n ? 'none' : '';
      if (hasGSAP && !reduce) gsap.to(priceShown, { v: t, duration: .6, ease: 'power2.out', onUpdate: () => { $('#bqPrice').textContent = priceShown.v.toFixed(2).replace('.', ','); } });
      else $('#bqPrice').textContent = t.toFixed(2).replace('.', ',');
    }
    function add(fid) {
      if (stems.length >= MAX) { toast(`${MAX} tiges maximum — on vous fait un devis !`); return; }
      const head = document.createElementNS(svgNS, 'g');
      head.setAttribute('class', 'bq-head');
      head.innerHTML = `<use href="#f-${fid}" x="-50" y="-50" width="100" height="100"/>`;
      const line = document.createElementNS(svgNS, 'path');
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', fid === 'euca' ? '#6f8a6b' : '#5f7d4f');
      line.setAttribute('stroke-width', '3');
      line.setAttribute('stroke-linecap', 'round');
      const st = { fid, head, line, x: 200, y: 400, s: 0, rot: (Math.random() - .5) * 50 };
      head.addEventListener('click', () => remove(st));
      stemsG.append(line);
      (FOLIAGE.includes(fid) ? back : front).append(head);
      stems.push(st);
      render(st);
      layout(st);
      update();
    }
    function remove(st) {
      if (!st) return;
      stems = stems.filter(s => s !== st);
      tween(st, { s: 0, y: st.y + 40 }, { duration: .35, ease: 'power2.in', onComplete: () => { st.head.remove(); st.line.remove(); } });
      layout();
      update();
    }
    function reset() { pending.forEach(clearTimeout); pending = []; [...stems].forEach(remove); seed = Math.random() * 6.28; }
    function setWrap(id) {
      wrap = D.wraps.find(w => w.id === id);
      $$('.wrap-opt').forEach(b => b.classList.toggle('is-active', b.dataset.w === id));
      const front = $('#wrapFront'), backP = $('#bqBackWrap path');
      if (hasGSAP) { gsap.to(front, { fill: wrap.color, duration: .6 }); gsap.to(backP, { fill: wrap.dark, duration: .6 }); gsap.fromTo('#bqFrontWrap', { scaleY: .94, transformOrigin: '50% 100%' }, { scaleY: 1, duration: .8, ease: 'elastic.out(1, .4)' }); }
      else { front.setAttribute('fill', wrap.color); backP.setAttribute('fill', wrap.dark); }
      update();
    }

    $('#flowerList').addEventListener('click', e => {
      const b = e.target.closest('[data-d]'); if (!b) return;
      const fid = b.closest('.fl').dataset.f;
      if (+b.dataset.d > 0) add(fid);
      else remove([...stems].reverse().find(s => s.fid === fid));
    });
    $('#wrapList').addEventListener('click', e => { const b = e.target.closest('.wrap-opt'); if (b) setWrap(b.dataset.w); });
    $('#bqReset').addEventListener('click', reset);
    $('#bqSurprise').addEventListener('click', () => {
      reset();
      const recipes = [['rose', 'rose', 'rose', 'rose', 'rose', 'gypso', 'gypso', 'euca', 'euca', 'rose', 'rose'], ['pivoine', 'pivoine', 'pivoine', 'rose', 'gypso', 'euca', 'euca', 'pivoine', 'gypso', 'lys'], ['tournesol', 'tournesol', 'renoncule', 'renoncule', 'euca', 'euca', 'tulipe', 'tournesol', 'renoncule', 'gypso'], ['tulipe', 'tulipe', 'tulipe', 'tulipe', 'tulipe', 'tulipe', 'euca', 'euca', 'tulipe', 'tulipe'], ['lys', 'lys', 'rose', 'pivoine', 'gypso', 'gypso', 'euca', 'lys', 'renoncule', 'euca', 'pivoine']];
      const r = recipes[Math.floor(Math.random() * recipes.length)];
      const order = [...r.filter(f => FOLIAGE.includes(f)), ...r.filter(f => !FOLIAGE.includes(f))];
      order.forEach((f, i) => pending.push(setTimeout(() => add(f), 380 + i * 110)));
      pending.push(setTimeout(() => setWrap(D.wraps[Math.floor(Math.random() * D.wraps.length)].id), 400));
    });
    $('#bqAdd').addEventListener('click', () => {
      if (!stems.length) return;
      const c = counts();
      const meta = Object.entries(c).map(([k, v]) => `${v} ${F[k].name}${v > 1 && !/s$/.test(F[k].name) ? 's' : ''}`).join(', ') + ' · ' + wrap.name;
      addToCart({ key: 'custom-' + Date.now(), name: 'Bouquet sur-mesure', price: Math.round(total() * 100) / 100, img: null, meta }, $('#bq'));
      const r = $('#bq').getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height * .4, 50);
    });
    update();

    // Bouquet de démonstration quand l'atelier apparaît
    const demo = ['euca', 'euca', 'gypso', 'rose', 'pivoine', 'rose', 'renoncule', 'pivoine', 'rose'];
    let played = false;
    new IntersectionObserver(([en], obs) => {
      if (en.isIntersecting && !played) { played = true; obs.disconnect(); if (!stems.length) demo.forEach((f, i) => pending.push(setTimeout(() => add(f), 200 + i * 140))); }
    }, { threshold: .35 }).observe($('.builder__stage'));
  }

  /* ---------- Services : image qui suit le curseur ---------- */
  function initServices() {
    const targets = [['#livraison'], ['#livraison'], ['#boutique'], ['#contact', 'Abonnement'], ['#contact', 'Entreprise'], ['#boutique', null, 'deuil']];
    $$('.svc').forEach((li, i) => {
      li.tabIndex = 0;
      const go = () => { const [t, subj, filt] = targets[i]; if (subj) $('#subject').value = subj; if (filt) applyFilter(filt); scrollToTarget(t); };
      li.addEventListener('click', go);
      li.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
    if (!fine || !hasGSAP || reduce) return;
    const fl = $('.svc-float'), im = fl.querySelector('img'), list = $('#svcList');
    $$('.svc').forEach(li => { const p = new Image(); p.src = img(li.dataset.img, 520, 640); });
    const xTo = gsap.quickTo(fl, 'x', { duration: .6, ease: 'power3' }), yTo = gsap.quickTo(fl, 'y', { duration: .6, ease: 'power3' });
    list.addEventListener('mousemove', e => { xTo(e.clientX + 40); yTo(e.clientY); });
    $$('.svc').forEach(li => li.addEventListener('mouseenter', () => {
      im.src = img(li.dataset.img, 520, 640);
      gsap.to(fl, { opacity: 1, scale: 1, rotate: gsap.utils.random(-7, 7), duration: .55, ease: 'power3.out' });
      gsap.fromTo(im, { scale: 1.3 }, { scale: 1, duration: .8, ease: 'power3.out' });
    }));
    list.addEventListener('mouseleave', () => gsap.to(fl, { opacity: 0, scale: .6, duration: .4 }));
  }

  /* ---------- Code postal ---------- */
  function initZip() {
    $('#zipForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#zipInput').value.trim(), out = $('#zipResult');
      out.className = 'zip__result';
      if (!/^\d{5}$/.test(v)) { out.textContent = 'Entrez un code postal à 5 chiffres.'; return; }
      const z = D.zones.find(x => x.zip.includes(v));
      if (z) { out.classList.add('ok'); out.innerHTML = `Oui ! Nous livrons <strong>${z.city}</strong> — frais de livraison ${euro(z.fee)}.`; }
      else out.innerHTML = 'Hors de notre zone directe, mais <strong>livraison partout en France en 24 h</strong> via le réseau Monceau Fleurs.';
      if (hasGSAP && !reduce) gsap.fromTo(out, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .5 });
    });
    $('#zipInput').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5); });
  }

  /* ---------- FAQ ---------- */
  function initFaq() {
    $$('.qa__q').forEach(q => q.addEventListener('click', () => {
      const qa = q.parentElement, open = !qa.classList.contains('is-open');
      $$('.qa').forEach(x => { x.classList.remove('is-open'); x.firstElementChild.setAttribute('aria-expanded', 'false'); });
      qa.classList.toggle('is-open', open); q.setAttribute('aria-expanded', open);
      if (hasGSAP) setTimeout(() => ScrollTrigger.refresh(), 650);
    }));
  }

  /* ---------- Formulaire ---------- */
  function initForm() {
    const f = $('#contactForm'), note = $('#formNote');
    f.addEventListener('submit', e => {
      e.preventDefault();
      let ok = true;
      $$('[required]', f).forEach(i => { const bad = !i.value.trim(); i.parentElement.classList.toggle('invalid', bad); if (bad) ok = false; });
      if (!ok) { note.className = 'form__note err'; note.textContent = 'Merci de compléter les champs indiqués.'; return; }
      const name = f.elements.namedItem('name').value.trim().split(' ')[0];
      note.className = 'form__note';
      note.textContent = `Merci ${name} ! Message bien reçu. (Démo : dans la version finale, il arrive directement dans la boîte mail de la boutique.)`;
      const r = f.querySelector('.btn').getBoundingClientRect();
      burst(r.left + r.width / 2, r.top, 60);
      f.reset();
    });
    $$('input, textarea', f).forEach(i => i.addEventListener('input', () => i.parentElement.classList.remove('invalid')));
  }

  /* ---------- Animations au défilement ---------- */
  function countUp(el) {
    const end = parseFloat(el.dataset.count), dec = +el.dataset.decimals || 0, plain = el.dataset.plain;
    const fmt = v => dec ? v.toFixed(dec).replace('.', ',') : plain ? String(Math.round(v)) : Math.round(v).toLocaleString('fr-FR');
    if (!hasGSAP || reduce) { el.textContent = fmt(end); return; }
    const o = { v: plain ? end - 60 : 0 };
    gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(o.v); } });
  }
  function initScrollFx() {
    // Univers : défilement horizontal épinglé (créé en premier, avant les déclencheurs situés plus bas)
    const mm = gsap.matchMedia();
    mm.add('(min-width: 961px)', () => {
      const track = $('#worldsTrack');
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '.worlds', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 } });
    });

    // Titres mot à mot
    $$('.split-words').forEach(el => {
      const words = splitWords(el);
      gsap.from(words, { yPercent: 115, rotate: 4, duration: 1.1, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    $$('.worlds__head .title, .season__title').forEach(el => {
      const words = splitWords(el);
      gsap.from(words, { yPercent: 115, duration: 1.1, ease: 'expo.out', stagger: .07, scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    });

    // Manifeste : les mots s'allument au fil du défilement
    const mt = $('#manifestoText');
    const mw = splitWords(mt, 'w', false);
    gsap.to(mw, { opacity: 1, stagger: .1, ease: 'none', scrollTrigger: { trigger: mt, start: 'top 80%', end: 'bottom 50%', scrub: true } });

    // Apparitions génériques
    const rv = $$('.section-head__aside, .lead, main .eyebrow:not(.hero__eyebrow), .stat, .ticks li, .badges li, .qa, .contact__list li, .form, .zip, .reviews__score, .builder__panel, .builder__stage, .footer__claim, .footer .btn, .footer__cols > div, .season__desc, #seasonCta, .countdown .cd, .filters');
    gsap.set(rv, { y: 46, opacity: 0 });
    ScrollTrigger.batch(rv, { start: 'top 90%', once: true, onEnter: b => gsap.to(b, { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', stagger: .09, overwrite: true }) });

    // Cartes produits
    gsap.set('.card', { y: 70, opacity: 0 });
    ScrollTrigger.batch('.card', { start: 'top 92%', once: true, onEnter: b => gsap.to(b, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: .08, overwrite: true }) });

    // Images révélées par un rideau
    $$('.reveal-img').forEach(el => {
      const inner = el.querySelector('img, iframe');
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
      tl.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', clearProps: 'clipPath' });
      if (inner && inner.tagName === 'IMG') tl.fromTo(inner, { scale: 1.35 }, { scale: 1, duration: 1.8, ease: 'expo.out' }, 0.1);
    });

    // Parallaxe
    $$('[data-speed]').forEach(el => {
      const sp = parseFloat(el.dataset.speed);
      const inHero = !!el.closest('.hero');
      gsap.fromTo(el, { y: inHero ? 0 : -sp * 160 }, { y: inHero ? -sp * 420 : sp * 160, ease: 'none', scrollTrigger: { trigger: el.closest('section') || el, start: inHero ? 'top top' : 'top bottom', end: 'bottom top', scrub: true } });
    });

    // Bandeau défilant réactif à la vitesse de défilement
    const loop = gsap.to('#marquee1', { xPercent: -50, ease: 'none', duration: 32, repeat: -1 });
    loop.totalTime(loop.duration() * 100);
    let back;
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: s => {
        const dir = s.direction, boost = 1 + Math.min(Math.abs(s.getVelocity()) / 260, 6);
        gsap.to(loop, { timeScale: dir * boost, duration: .2, overwrite: true });
        clearTimeout(back);
        back = setTimeout(() => gsap.to(loop, { timeScale: dir, duration: 1.2, overwrite: true }), 120);
      }
    });

    // Compteurs
    $$('[data-count]').forEach(el => ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => countUp(el) }));

    // Étapes de commande
    gsap.fromTo('#stepsRect', { attr: { width: 0 } }, { attr: { width: 1000 }, ease: 'none', scrollTrigger: { trigger: '.steps', start: 'top 80%', end: 'top 30%', scrub: true } });
    gsap.from('.step__ic', { scale: 0, rotate: -40, duration: 1, ease: 'back.out(1.8)', stagger: .18, clearProps: 'transform', scrollTrigger: { trigger: '.steps', start: 'top 80%', once: true } });
    gsap.from('.step h3, .step p', { y: 30, opacity: 0, duration: .9, ease: 'power3.out', stagger: .08, scrollTrigger: { trigger: '.steps', start: 'top 78%', once: true } });

    // Note Google
    ScrollTrigger.create({
      trigger: '.reviews', start: 'top 70%', once: true, onEnter: () => {
        const o = { v: 0 };
        gsap.to(o, { v: C.rating, duration: 2, ease: 'power3.out', onUpdate: () => { $('#ratingNum').textContent = o.v.toFixed(1).replace('.', ','); } });
        gsap.to('#starsFg', { width: (C.rating / 5 * 100) + '%', duration: 2.2, ease: 'power2.inOut', delay: .2 });
      }
    });

    // Univers : cartes qui montent
    gsap.from('.world', { y: 80, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: '.worlds', start: 'top 70%', once: true } });

    // Mariage : badge
    gsap.from('.wedding__badge', { scale: 0, rotate: -120, duration: 1.4, ease: 'back.out(1.6)', scrollTrigger: { trigger: '.wedding', start: 'top 70%', once: true } });

    // Lettres géantes du pied de page
    gsap.from('.footer__giant span', { yPercent: 100, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: '.footer__giant', start: 'top 95%', once: true } });

    addEventListener('load', () => ScrollTrigger.refresh());
  }

  /* ---------- Intro ---------- */
  function buildIntro() {
    const chars = $$('.hero__title .line').flatMap(splitChars);
    const tl = gsap.timeline({ paused: true });
    tl.from(chars, { yPercent: 120, rotate: 10, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .022 })
      .from('.hero__img--main', { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut', clearProps: 'clipPath' }, 0)
      .from('.hero__img--main img', { scale: 1.4, duration: 2, ease: 'expo.out' }, .3)
      .from('.hero__img--sm1, .hero__img--sm2', { scale: 0, rotate: -15, duration: 1.3, ease: 'back.out(1.5)', stagger: .15 }, .5)
      .from('.hero__eyebrow, .hero__lead, .hero__ctas, .hero__chips', { y: 34, opacity: 0, duration: 1, ease: 'power3.out', stagger: .1 }, .35)
      .from('.float-card', { y: 50, opacity: 0, scale: .8, duration: 1, ease: 'back.out(1.6)', stagger: .2 }, .9)
      .from('.header', { opacity: 0, duration: 1.2, ease: 'power2.out' }, .2)
      .from('.scroll-cue', { opacity: 0, y: -10, duration: .8 }, 1.4);
    return tl;
  }
  function runLoader(onDone) {
    const loader = $('#loader');
    if (!hasGSAP || reduce) { loader.remove(); onDone(); return; }
    document.body.classList.add('is-loading');
    const o = { v: 0 }, cnt = $('#loaderCount');
    gsap.timeline()
      .to(o, { v: 100, duration: 1.5, ease: 'power2.inOut', onUpdate: () => { cnt.textContent = Math.round(o.v); } })
      .to('.loader__inner, .loader__count', { y: -30, opacity: 0, duration: .5, ease: 'power2.in' })
      .to('.loader__panel--a', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '-=.1')
      .to('.loader__panel--b', { yPercent: 100, duration: 1.1, ease: 'expo.inOut' }, '<')
      .add(() => { loader.classList.add('is-done'); document.body.classList.remove('is-loading'); onDone(); }, '-=.8')
      .add(() => loader.remove());
  }

  /* ---------- Démarrage ---------- */
  fillStatic();
  initSeason();
  initShop();
  initModal();
  initCart();
  initBuilder();
  initServices();
  initZip();
  initFaq();
  initForm();
  initHeader();
  initCursor();
  initMagnetic();

  if (hasGSAP && !reduce) {
    const intro = buildIntro();
    initScrollFx();
    runLoader(() => { intro.play(); initPetals(); ScrollTrigger.refresh(); });
  } else {
    $$('[data-count]').forEach(countUp);
    $('#ratingNum').textContent = String(C.rating).replace('.', ',');
    $('#starsFg').style.width = (C.rating / 5 * 100) + '%';
    runLoader(() => {});
  }
})();
