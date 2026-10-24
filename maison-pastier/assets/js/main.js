/* ==========================================================================
   Maison Pastier — interactions & motion design
   GSAP + ScrollTrigger + Lenis (fichiers locaux dans assets/vendor)
   ========================================================================== */
(() => {
  "use strict";

  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = root.classList.contains("reduce-motion");
  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  const animate = hasGsap && !reduceMotion;

  // Sans GSAP, on affiche tout (pas d'état caché)
  if (!hasGsap) root.classList.add("reduce-motion");
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  const PHONE = "+33664974282";
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } },
  };

  /* ------------------------------------------------------------------------
     Horaires (source : widget horaires du site actuel)
     Index = Date.getDay() → 0 dimanche … 6 samedi
     ------------------------------------------------------------------------ */
  const HOURS = {
    0: [["08:30", "13:00"]],
    1: [],
    2: [["08:30", "13:00"], ["16:30", "19:00"]],
    3: [["08:30", "13:00"], ["16:30", "19:00"]],
    4: [["08:30", "13:00"], ["16:30", "19:00"]],
    5: [["08:30", "13:00"], ["16:30", "19:00"]],
    6: [["08:30", "13:00"], ["16:30", "19:00"]],
  };
  const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const fmt = (hhmm) => hhmm.replace(":", "h");

  function parisNow() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { day, min: Number(get("hour")) * 60 + Number(get("minute")) };
  }

  function openingStatus() {
    const { day, min } = parisNow();
    for (const [o, c] of HOURS[day]) {
      if (min >= toMin(o) && min < toMin(c)) {
        const soon = toMin(c) - min <= 30;
        return { open: true, day, text: soon ? `Ferme bientôt · ${fmt(c)}` : `Ouvert · jusqu’à ${fmt(c)}` };
      }
    }
    for (const [o] of HOURS[day]) {
      if (min < toMin(o)) return { open: false, day, text: `Fermé · ouvre à ${fmt(o)}` };
    }
    for (let i = 1; i <= 7; i++) {
      const d = (day + i) % 7;
      if (HOURS[d].length) {
        const when = i === 1 ? "demain" : DAYS[d];
        return { open: false, day, text: `Fermé · ouvre ${when} à ${fmt(HOURS[d][0][0])}` };
      }
    }
    return { open: false, day, text: "Fermé" };
  }

  function renderStatus() {
    const s = openingStatus();
    $$("[data-status]").forEach((el) => {
      el.classList.toggle("is-open", s.open);
      el.classList.toggle("is-closed", !s.open);
      const t = $("[data-status-text]", el);
      if (t) t.textContent = s.text;
    });
    $$("[data-hours-row]").forEach((row) => {
      row.classList.toggle("is-today", Number(row.dataset.hoursRow) === s.day);
    });
  }
  renderStatus();
  setInterval(renderStatus, 60 * 1000);

  /* ------------------------------------------------------------------------
     Smooth scroll (Lenis)
     ------------------------------------------------------------------------ */
  let lenis = null;
  if (animate && typeof window.Lenis !== "undefined") {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const scrollToTarget = (target) => {
    const offset = -(parseInt(getComputedStyle(root).getPropertyValue("--header-h"), 10) || 80) - 10;
    if (lenis) lenis.scrollTo(target, { offset, duration: 1.4 });
    else {
      const y = (typeof target === "number" ? target : target.getBoundingClientRect().top + window.scrollY + offset);
      window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
    }
  };

  // Ancres internes
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const el = document.getElementById(id.slice(1));
      if (!el) return;
      e.preventDefault();
      closeMenu();
      scrollToTarget(el);
      history.replaceState(null, "", id);
    });
  });

  /* ------------------------------------------------------------------------
     Header : masqué en descendant, visible en remontant
     ------------------------------------------------------------------------ */
  const header = $("[data-header]");
  const toTop = $(".to-top");
  const toTopRing = toTop ? $(".ring circle", toTop) : null;
  let lastY = window.scrollY;
  function onScroll() {
    const y = window.scrollY;
    if (header) {
      header.classList.toggle("is-scrolled", y > 40);
      const goingDown = y > lastY;
      const hide = goingDown && y > 400 && !root.classList.contains("menu-open");
      header.classList.toggle("is-hidden", hide);
      root.classList.toggle("hdr-hidden", hide);
    }
    if (toTop) {
      toTop.classList.toggle("is-visible", y > 700);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (toTopRing && max > 0) toTopRing.style.strokeDashoffset = String(1 - Math.min(1, y / max));
    }
    lastY = y;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener("click", () => scrollToTarget(0));

  /* ------------------------------------------------------------------------
     Menu mobile
     ------------------------------------------------------------------------ */
  const burger = $(".burger");
  const menu = $("#mobile-menu");
  function closeMenu() {
    if (!root.classList.contains("menu-open")) return;
    root.classList.remove("menu-open");
    if (burger) burger.setAttribute("aria-expanded", "false");
    if (menu) menu.setAttribute("aria-hidden", "true");
    if (lenis) lenis.start();
  }
  if (burger && menu) {
    burger.addEventListener("click", () => {
      const open = !root.classList.contains("menu-open");
      root.classList.toggle("menu-open", open);
      burger.setAttribute("aria-expanded", String(open));
      menu.setAttribute("aria-hidden", String(!open));
      if (lenis) open ? lenis.stop() : lenis.start();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  }

  /* ------------------------------------------------------------------------
     Transitions de page (rideau)
     ------------------------------------------------------------------------ */
  const curtain = $(".curtain");
  const panels = curtain ? $$(".curtain__panel", curtain) : [];
  const curtainLogo = curtain ? $(".curtain__logo", curtain) : null;

  function curtainOut() {
    if (!curtain || !root.classList.contains("is-entering")) return Promise.resolve();
    root.classList.remove("is-entering");
    if (!animate) return Promise.resolve();
    gsap.set(panels, { scaleY: 1, transformOrigin: "top" });
    gsap.set(curtainLogo, { opacity: 1 });
    const tl = gsap.timeline();
    tl.to(curtainLogo, { opacity: 0, scale: 0.8, duration: 0.35, ease: "power2.in" })
      .to(panels, { scaleY: 0, duration: 0.8, ease: "expo.inOut", stagger: 0.07 }, 0.1);
    return tl.then();
  }

  function isInternal(a) {
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return false;
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("sms:")) return false;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return false;
    if (url.pathname === location.pathname && url.hash) return false;
    return /\.html$|\/$/.test(url.pathname);
  }

  if (animate && curtain) {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!isInternal(a) || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      closeMenu();
      const href = a.href;
      store.set("mp-nav", "1");
      gsap.set(panels, { transformOrigin: "bottom" });
      gsap.timeline({ onComplete: () => { window.location.href = href; } })
        .to(panels, { scaleY: 1, duration: 0.7, ease: "expo.inOut", stagger: 0.06 })
        .to(curtainLogo, { opacity: 1, scale: 1, duration: 0.3 }, "-=0.25");
    });
  }

  // Retour arrière (bfcache) : on remet le rideau à zéro
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && hasGsap && panels.length) {
      gsap.set(panels, { scaleY: 0 });
      gsap.set(curtainLogo, { opacity: 0 });
    }
  });

  /* ------------------------------------------------------------------------
     Utilitaire : découpage du texte en mots
     ------------------------------------------------------------------------ */
  function splitWords(el, cls = "sw") {
    if (el.dataset.splitDone) return $$(`.${cls} > span`, el);
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
            const outer = document.createElement("span");
            outer.className = cls;
            const inner = document.createElement("span");
            inner.textContent = p;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== "BR") {
          walk(child);
        }
      });
    };
    walk(el);
    el.dataset.splitDone = "1";
    return $$(`.${cls} > span`, el);
  }

  /* ------------------------------------------------------------------------
     Intro (accueil)
     ------------------------------------------------------------------------ */
  function runIntro() {
    const intro = $("#intro");
    const visible = intro && getComputedStyle(intro).display !== "none";
    if (!visible || !animate) {
      if (intro) intro.remove();
      return Promise.resolve();
    }
    store.set("mp-intro", "1");
    if (lenis) lenis.stop();
    window.scrollTo(0, 0);

    const svg = $(".intro-logo", intro);
    const paths = $$("path", svg);
    paths.forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
    });
    const rings = $$(".lg-ring-top, .lg-ring-bot", svg);
    const lines = $$(".lg-line-top, .lg-line-bot", svg);
    const texts = $$(".lg-txt-top, .lg-txt-mid, .lg-txt-bot", svg);
    const flag = $$(".lg-flag rect", svg);
    const counter = $("[data-intro-count]", intro);
    const main = $(".intro__layer--main", intro);
    const wood = $(".intro__layer--wood", intro);
    const count = { v: 0 };

    gsap.set(flag, { scaleX: 0, transformOrigin: "left center" });
    gsap.set(lines, { scaleX: 0, transformOrigin: "center" });
    gsap.set(".intro__tag span", { yPercent: 110 });
    gsap.set(svg, { rotate: -8, scale: 0.92, transformOrigin: "50% 50%" });

    return new Promise((resolve) => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" }, onComplete: () => { intro.remove(); resolve(); } });
      tl.to(count, { v: 100, duration: 2.6, ease: "power2.inOut", onUpdate: () => { if (counter) counter.textContent = String(Math.round(count.v)).padStart(2, "0"); } }, 0)
        .to(".intro__bar", { scaleX: 1, duration: 2.6, ease: "power2.inOut" }, 0)
        .to(svg, { rotate: 0, scale: 1, duration: 2.4, ease: "expo.out" }, 0)
        .to(rings, { strokeDashoffset: 0, duration: 1.3, ease: "power2.inOut", stagger: 0.12 }, 0.1)
        .to(lines, { scaleX: 1, strokeDashoffset: 0, duration: 0.8, ease: "expo.out", stagger: 0.1 }, 0.7)
        .to(texts, { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut", stagger: 0.12 }, 0.55)
        .to(paths, { fillOpacity: 1, strokeWidth: 0, duration: 0.6, ease: "power1.out", stagger: 0.04 }, 1.45)
        .to(flag, { scaleX: 1, duration: 0.35, ease: "power2.out", stagger: 0.09 }, 1.7)
        .to(".intro__tag span", { yPercent: 0, duration: 0.9, ease: "expo.out" }, 1.6)
        .addLabel("out", 2.85)
        .to(".intro__center", { y: -40, opacity: 0, duration: 0.6, ease: "power3.in" }, "out")
        .to(".intro__meta, .intro__skip, .intro__bar", { opacity: 0, duration: 0.4 }, "out")
        .to(main, { clipPath: "inset(0% 0% 100% 0%)", duration: 1.05, ease: "expo.inOut" }, "out+=0.35")
        .to(wood, { clipPath: "inset(0% 0% 100% 0%)", duration: 1.05, ease: "expo.inOut" }, "out+=0.5")
        .add(() => { if (lenis) lenis.start(); resolve(); }, "out+=0.9");

      const skip = $(".intro__skip", intro);
      if (skip) skip.addEventListener("click", () => tl.seek("out"));
    });
  }

  /* ------------------------------------------------------------------------
     Entrée des héros
     ------------------------------------------------------------------------ */
  function heroIn() {
    if (!animate) return;
    const hero = $(".hero") || $(".page-hero");
    if (!hero) return;
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.to($$(".line > span", hero), { y: 0, yPercent: 0, duration: 1.3, stagger: 0.09 }, 0)
      .fromTo($$("[data-hero-fade]", hero), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08 }, 0.25);

    const visual = $(".arch", hero);
    if (visual) {
      tl.to(visual, { clipPath: "inset(0% 0 0 0 round 999px 999px 26px 26px)", duration: 1.5, ease: "expo.inOut" }, 0.05);
      const img = $("img", visual);
      if (img) tl.from(img, { scale: 1.35, duration: 2, ease: "expo.out" }, 0.1);
    }
    const bubble = $(".hero__bubble", hero);
    if (bubble) tl.from(bubble, { scale: 0, rotate: -40, duration: 1.2, ease: "back.out(1.6)" }, 0.75);
    const badge = $(".spin-badge", hero);
    if (badge) tl.from(badge, { scale: 0, rotate: 90, duration: 1.2, ease: "back.out(1.6)" }, 0.9);
    const floaters = $$(".floater", hero);
    if (floaters.length) tl.from(floaters, { opacity: 0, scale: 0.4, duration: 1.4, stagger: 0.08 }, 0.6);
  }

  /* ------------------------------------------------------------------------
     Apparition à l'écran
     Lance fn une seule fois quand l'élément arrive à l'écran, ou tout de suite
     s'il est déjà visible ou dépassé (lien avec ancre, rechargement en bas de
     page). On n'utilise pas l'option `once` de ScrollTrigger 3.12 : un
     déclencheur `once` déjà dépassé se supprime pendant son initialisation et
     fait planter la création des suivants.
     ------------------------------------------------------------------------ */
  let burst = 0;
  let burstAt = 0;
  function whenVisible(el, fn, ratio = 0.88) {
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      // Petit décalage quand plusieurs éléments apparaissent en même temps
      const now = performance.now();
      burst = now - burstAt < 150 ? Math.min(burst + 1, 6) : 0;
      burstAt = now;
      fn(burst * 0.08);
    };
    ScrollTrigger.create({ trigger: el, start: `top ${Math.round(ratio * 100)}%`, onEnter: run, onEnterBack: run });
    if (el.getBoundingClientRect().top < window.innerHeight * ratio) run();
  }

  /* ------------------------------------------------------------------------
     Animations au scroll
     ------------------------------------------------------------------------ */
  function scrollAnimations() {
    if (!animate) return;

    // Titres découpés en mots
    $$("[data-split]").forEach((el) => {
      const words = splitWords(el);
      gsap.set(words, { yPercent: 115 });
      whenVisible(el, (delay) => gsap.to(words, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.035, delay }));
    });

    // Apparitions simples
    $$("[data-reveal]").forEach((el) => {
      whenVisible(el, (delay) => gsap.fromTo(el, { opacity: 0, y: 46 }, { opacity: 1, y: 0, duration: 1.1, ease: "expo.out", delay }), 0.9);
    });

    // Images révélées par un volet
    $$("[data-reveal-img]").forEach((el) => {
      const img = $("img", el);
      whenVisible(el, (delay) => {
        const tl = gsap.timeline({ delay });
        tl.to(el, { clipPath: "inset(0% 0 0 0)", duration: 1.4, ease: "expo.inOut" });
        if (img) tl.from(img, { scale: 1.3, duration: 1.8, ease: "expo.out" }, 0.1);
      }, 0.85);
    });

    // Parallaxe
    $$("[data-speed]").forEach((el) => {
      const speed = parseFloat(el.dataset.speed) || 0.1;
      gsap.to(el, {
        yPercent: speed * -100,
        ease: "none",
        scrollTrigger: { trigger: el.closest("section") || el, start: "top bottom", end: "bottom top", scrub: true },
      });
    });

    // Image dans un cadre : léger déplacement interne
    $$("[data-inner-parallax] img").forEach((img) => {
      gsap.fromTo(img, { yPercent: -5 }, {
        yPercent: 5,
        ease: "none",
        scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true },
      });
    });

    // Manifeste : les mots s'allument au fil du scroll
    $$("[data-highlight]").forEach((el) => {
      const words = splitWords(el, "w-wrap").map((s) => { s.classList.add("w"); return s; });
      gsap.to(words, {
        opacity: 1,
        stagger: 0.1,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: 0.6 },
      });
    });

    // Compteurs
    $$("[data-count]").forEach((el) => {
      const end = parseFloat(el.dataset.count);
      const dec = parseInt(el.dataset.decimals || "0", 10);
      const obj = { v: 0 };
      el.textContent = (0).toFixed(dec).replace(".", ",");
      whenVisible(el, () => gsap.to(obj, {
        v: end, duration: 2, ease: "power3.out",
        onUpdate: () => { el.textContent = obj.v.toFixed(dec).replace(".", ","); },
      }), 0.9);
    });

    // Tracés SVG dessinés au scroll
    $$("[data-draw]").forEach((path) => {
      const len = path.getTotalLength();
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      gsap.to(path, {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: { trigger: path.closest("section") || path, start: "top 75%", end: "bottom 60%", scrub: 1 },
      });
    });

    // Étoiles des avis
    $$(".reviews__stars").forEach((wrap) => {
      const fg = $$(".s-fg", wrap);
      gsap.set(fg, { scale: 0, transformOrigin: "50% 50%" });
      whenVisible(wrap, () => gsap.to(fg, { scale: 1, duration: 0.7, ease: "back.out(2.5)", stagger: 0.12 }), 0.85);
    });

    // Pots de sauce qui se remplissent
    $$("[data-jars]").forEach((wrap) => {
      const fills = $$(".jar-fill", wrap);
      gsap.set(fills, { scaleY: 0, transformOrigin: "50% 100%" });
      whenVisible(wrap, () => gsap.to(fills, { scaleY: 1, duration: 1.3, ease: "power3.out", stagger: 0.12 }), 0.85);
    });

    // Pictos dessinés (formes de pâtes)
    $$("[data-draw-icon]").forEach((wrap) => {
      const shapes = $$("path, circle, ellipse, rect, line, polyline", wrap);
      shapes.forEach((s) => {
        const len = s.getTotalLength ? s.getTotalLength() : 200;
        s.style.strokeDasharray = `${len}`;
        s.style.strokeDashoffset = `${len}`;
      });
      whenVisible(wrap, () => gsap.to(shapes, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut", stagger: 0.05 }));
    });

    // Héros : parallaxe de sortie
    const hero = $(".hero");
    if (hero) {
      gsap.to(".hero__copy", { yPercent: -18, opacity: 0.2, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
      gsap.to(".hero__visual", { yPercent: 12, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
    }

    // Texte géant du footer
    $$(".footer__giant").forEach((el) => {
      const letters = el.textContent.split("");
      el.innerHTML = letters.map((l) => `<span>${l === " " ? "&nbsp;" : l}</span>`).join("");
      const spans = $$("span", el);
      gsap.set(spans, { yPercent: 100 });
      whenVisible(el, () => gsap.to(spans, { yPercent: 0, ease: "expo.out", duration: 1.4, stagger: 0.03 }), 0.95);
    });

    // Lignes de la timeline (savoir-faire)
    $$(".timeline").forEach((tl) => {
      const fill = $(".timeline__line i", tl);
      if (fill) gsap.to(fill, { scaleY: 1, ease: "none", scrollTrigger: { trigger: tl, start: "top 60%", end: "bottom 60%", scrub: true } });
      $$(".tl-step__dot", tl).forEach((dot) => {
        gsap.set(dot, { scale: 0, rotate: -90 });
        whenVisible(dot, () => gsap.to(dot, { scale: 1, rotate: 0, duration: 0.9, ease: "back.out(2)" }), 0.75);
      });
    });
  }

  /* ------------------------------------------------------------------------
     Défilement horizontal « Le geste »
     ------------------------------------------------------------------------ */
  function processScroll() {
    const section = $("[data-process]");
    if (!section || !animate) return;
    const track = $("[data-process-track]", section);
    const pin = $(".process__pin", section);
    const bar = $(".process__bar i", section);
    const counter = $("[data-process-count]", section);
    const strand = $(".process__strand path", section);
    const steps = $$(".step", track);
    const mm = gsap.matchMedia();

    mm.add("(min-width: 900px)", () => {
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
      let len = 0;
      if (strand) {
        len = strand.getTotalLength();
        gsap.set(strand, { strokeDasharray: len, strokeDashoffset: len });
      }
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          pin,
          start: "top top",
          end: () => `+=${distance()}`,
          scrub: 0.8,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (bar) bar.style.transform = `scaleX(${self.progress})`;
            if (strand) strand.style.strokeDashoffset = String(len * (1 - self.progress));
            if (counter) {
              const idx = Math.min(steps.length, Math.max(1, Math.round(self.progress * (steps.length - 1)) + 1));
              counter.textContent = String(idx).padStart(2, "0");
            }
          },
        },
      });
      steps.forEach((step) => {
        const img = $(".step__img img", step);
        if (img) {
          // Le zoom reste supérieur au décalage pour ne jamais découvrir le bord de l'image
          gsap.fromTo(img, { scale: 1.2, xPercent: 6 }, {
            scale: 1.15, xPercent: -6, ease: "none",
            scrollTrigger: { trigger: step, containerAnimation: tween, start: "left right", end: "right left", scrub: true },
          });
        }
      });
      return () => { if (strand) gsap.set(strand, { clearProps: "all" }); };
    });

    mm.add("(max-width: 899px)", () => {
      steps.forEach((step) => {
        gsap.set(step, { opacity: 0, y: 60 });
        whenVisible(step, () => gsap.to(step, { opacity: 1, y: 0, duration: 1, ease: "expo.out" }), 0.85);
      });
      return () => gsap.set(steps, { clearProps: "opacity,transform" });
    });
  }

  /* ------------------------------------------------------------------------
     Marquee piloté par le scroll
     ------------------------------------------------------------------------ */
  function marquees() {
    $$("[data-marquee]").forEach((m) => {
      const track = $(".marquee__track", m);
      const group = $(".marquee__group", track);
      if (!track || !group) return;
      // Duplique jusqu'à couvrir 2× l'écran
      while (track.scrollWidth < window.innerWidth * 2.2) track.appendChild(group.cloneNode(true));
      $$(".marquee__group", track).slice(1).forEach((g) => g.setAttribute("aria-hidden", "true"));
      if (!animate) return;
      const base = parseFloat(m.dataset.marquee) || 1;
      let x = 0;
      let dir = m.dataset.reverse ? -1 : 1;
      let boost = 0;
      const w = () => group.offsetWidth;
      gsap.ticker.add((t, dt) => {
        const v = lenis ? lenis.velocity : 0;
        if (lenis && Math.abs(v) > 0.1) dir = (v > 0 ? 1 : -1) * (m.dataset.reverse ? -1 : 1);
        boost += (Math.min(Math.abs(v), 40) * 0.25 - boost) * 0.1;
        x -= (base + boost) * dir * (dt / 16.67) * 1.1;
        const gw = w();
        if (x <= -gw) x += gw;
        if (x > 0) x -= gw;
        track.style.transform = `translate3d(${x}px,0,0)`;
      });
    });
  }

  /* ------------------------------------------------------------------------
     Pâtes flottantes (héros) + boutons magnétiques + curseur
     ------------------------------------------------------------------------ */
  function pointerFx() {
    if (!animate) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    $$(".floater").forEach((f, i) => {
      gsap.to(f, { y: "+=" + (14 + (i % 3) * 8), rotate: (i % 2 ? 1 : -1) * (8 + i * 2), duration: 3 + (i % 4), ease: "sine.inOut", yoyo: true, repeat: -1, delay: i * 0.2 });
    });

    if (!fine) return;

    const hero = $(".hero, .page-hero");
    if (hero) {
      const floaters = $$(".floater", hero).map((el) => ({ el, depth: parseFloat(el.dataset.depth) || 0.05 }));
      hero.addEventListener("mousemove", (e) => {
        const cx = e.clientX / window.innerWidth - 0.5;
        const cy = e.clientY / window.innerHeight - 0.5;
        floaters.forEach(({ el, depth }) => gsap.to(el, { x: cx * depth * 600, y: cy * depth * 400, duration: 1.2, ease: "power3.out", overwrite: "auto" }));
      });
    }

    $$(".magnetic").forEach((el) => {
      const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.28);
        yTo((e.clientY - r.top - r.height / 2) * 0.35);
      });
      el.addEventListener("mouseleave", () => { xTo(0); yTo(0); });
    });

    // Curseur personnalisé
    const cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML = '<div class="cursor__ring"><span class="cursor__label"></span></div><div class="cursor__dot"></div>';
    document.body.appendChild(cursor);
    root.classList.add("has-cursor");
    const ring = $(".cursor__ring", cursor);
    const dot = $(".cursor__dot", cursor);
    const label = $(".cursor__label", cursor);
    gsap.set([ring, dot], { x: -100, y: -100 });
    const rx = gsap.quickTo(ring, "x", { duration: 0.5, ease: "power3.out" });
    const ry = gsap.quickTo(ring, "y", { duration: 0.5, ease: "power3.out" });
    const dx = gsap.quickTo(dot, "x", { duration: 0.12, ease: "power3.out" });
    const dy = gsap.quickTo(dot, "y", { duration: 0.12, ease: "power3.out" });
    window.addEventListener("mousemove", (e) => { rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY); });
    document.addEventListener("mouseover", (e) => {
      const lab = e.target.closest("[data-cursor]");
      const link = e.target.closest("a, button, summary, label, input, select, textarea");
      cursor.classList.toggle("is-label", !!lab);
      cursor.classList.toggle("is-hover", !lab && !!link);
      label.textContent = lab ? lab.dataset.cursor : "";
    });
    document.addEventListener("mouseleave", () => gsap.to([ring, dot], { opacity: 0, duration: 0.3 }));
    document.addEventListener("mouseenter", () => gsap.to([ring, dot], { opacity: 1, duration: 0.3 }));
  }

  /* ------------------------------------------------------------------------
     Carte des raviolis (accordéon + image)
     ------------------------------------------------------------------------ */
  function carte() {
    const wrap = $("[data-carte]");
    if (!wrap) return;
    const items = $$(".carte__item", wrap);
    const imgs = $$("[data-carte-img]", wrap);
    const caption = $("[data-carte-caption]", wrap);
    const open = (item) => {
      items.forEach((it) => {
        const on = it === item;
        it.classList.toggle("is-open", on);
        $(".carte__btn", it).setAttribute("aria-expanded", String(on));
      });
      const i = item.dataset.img;
      imgs.forEach((im) => im.classList.toggle("is-active", im.dataset.carteImg === i));
      if (caption) caption.textContent = $(".name", item).textContent;
    };
    items.forEach((it) => {
      const btn = $(".carte__btn", it);
      btn.addEventListener("click", () => open(it));
      btn.addEventListener("mouseenter", () => { if (window.matchMedia("(hover: hover)").matches) open(it); });
    });
  }

  /* ------------------------------------------------------------------------
     Tarifs : bascule box seule / menu
     ------------------------------------------------------------------------ */
  function priceSwitch() {
    $$("[data-switch]").forEach((sw) => {
      const scope = sw.closest("[data-formule-scope]") || document;
      const buttons = $$("button", sw);
      buttons.forEach((b) => b.addEventListener("click", () => {
        const f = b.dataset.formule;
        sw.dataset.state = f;
        buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (scope.setAttribute) scope.setAttribute("data-formule-scope", f);
        $$("[data-price]", scope).forEach((p) => {
          const to = parseFloat(p.dataset[f]);
          const euros = $(".price__euros", p);
          const cents = $(".price__cents", p);
          const obj = { v: parseFloat(p.dataset.current || p.dataset.seule) };
          p.dataset.current = String(to);
          const write = (v) => {
            const [e, c] = v.toFixed(2).split(".");
            euros.textContent = e;
            cents.textContent = "," + c;
          };
          if (!animate) { write(to); return; }
          gsap.to(obj, { v: to, duration: 0.8, ease: "power3.out", onUpdate: () => write(obj.v) });
          gsap.fromTo(p, { rotateX: -50, opacity: 0.4 }, { rotateX: 0, opacity: 1, duration: 0.7, ease: "back.out(2)" });
        });
      }));
    });
  }

  /* ------------------------------------------------------------------------
     Commande d'une box (repas.html) → SMS prérempli
     ------------------------------------------------------------------------ */
  const euro = (n) => n.toFixed(2).replace(".", ",") + " €";
  function toast(msg) {
    let t = $(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("is-visible");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("is-visible"), 2600);
  }

  function smsHref(body) {
    return `sms:${PHONE}?&body=${encodeURIComponent(body)}`;
  }

  function orderBuilder() {
    const form = $("[data-order]");
    if (!form) return;
    const PRICES = { pates: { seule: 8.5, menu: 9.5 }, gnocchis: { seule: 8.5, menu: 9.5 }, raviolis: { seule: 9.5, menu: 10.5 } };
    const LABELS = { pates: "Pâtes fraîches", gnocchis: "Gnocchis", raviolis: "Raviolis" };
    const cart = [];
    const qtyOut = $("[data-qty]", form);
    const unit = $("[data-unit]", form);
    const drinkField = $(".drink-field", form);
    const list = $("[data-cart]");
    const total = $("[data-total]");
    const sendBtn = $("[data-send]");
    const copyBtn = $("[data-copy]");
    const nameIn = $("#order-name");
    const timeIn = $("#order-time");
    const noteIn = $("#order-note");
    let qty = 1;

    const val = (n) => { const el = $(`input[name="${n}"]:checked`, form); return el ? el.value : null; };
    const current = () => {
      const base = val("base");
      const formule = val("formule");
      return { base, sauce: val("sauce"), formule, drink: formule === "menu" ? val("drink") : null, qty, price: PRICES[base][formule] };
    };
    const refresh = () => {
      const c = current();
      drinkField.hidden = c.formule !== "menu";
      unit.textContent = euro(c.price * c.qty);
      qtyOut.textContent = String(qty);
    };
    form.addEventListener("change", refresh);
    $$("[data-step]", form).forEach((b) => b.addEventListener("click", () => {
      qty = Math.min(20, Math.max(1, qty + Number(b.dataset.step)));
      refresh();
    }));

    const describe = (l) => `${l.qty} × Box ${LABELS[l.base]}, sauce ${l.sauce}${l.formule === "menu" ? `, en menu (${l.drink})` : ", seule"}`;

    const message = () => {
      const lines = cart.map((l) => `- ${describe(l)} : ${euro(l.price * l.qty)}`);
      const sum = cart.reduce((s, l) => s + l.price * l.qty, 0);
      const parts = ["Bonjour Maison Pastier, je souhaite commander :", ...lines, `Total : ${euro(sum)}`];
      if (timeIn && timeIn.value) parts.push(`Retrait souhaité : ${timeIn.value.replace(":", "h")}`);
      if (noteIn && noteIn.value.trim()) parts.push(`Précision : ${noteIn.value.trim()}`);
      if (nameIn && nameIn.value.trim()) parts.push(`Nom : ${nameIn.value.trim()}`);
      parts.push("Merci !");
      return parts.join("\n");
    };

    const render = () => {
      list.innerHTML = "";
      if (!cart.length) {
        list.innerHTML = '<p class="cart__empty">Votre panier est vide. Composez une box à gauche puis ajoutez-la.</p>';
      }
      cart.forEach((l, i) => {
        const row = document.createElement("div");
        row.className = "cart__line";
        row.innerHTML = `<div><strong>${l.qty} × Box ${LABELS[l.base]}</strong><small>Sauce ${l.sauce} · ${l.formule === "menu" ? `menu, ${l.drink}` : "seule"}</small></div><span class="p">${euro(l.price * l.qty)}</span><button type="button" aria-label="Retirer cette box">✕</button>`;
        $("button", row).addEventListener("click", () => { cart.splice(i, 1); render(); });
        list.appendChild(row);
        if (animate && i === cart.length - 1 && row.dataset.new !== "0") gsap.from(row, { opacity: 0, x: 30, duration: 0.6, ease: "expo.out" });
      });
      const sum = cart.reduce((s, l) => s + l.price * l.qty, 0);
      total.textContent = euro(sum);
      const disabled = !cart.length;
      sendBtn.classList.toggle("is-disabled", disabled);
      sendBtn.setAttribute("aria-disabled", String(disabled));
      sendBtn.href = disabled ? "#commande" : smsHref(message());
    };

    $("[data-add]", form).addEventListener("click", () => {
      const c = current();
      const same = cart.find((l) => l.base === c.base && l.sauce === c.sauce && l.formule === c.formule && l.drink === c.drink);
      if (same) same.qty += c.qty; else cart.push(c);
      qty = 1;
      refresh();
      render();
      toast("Box ajoutée au panier");
    });
    [nameIn, timeIn, noteIn].forEach((el) => el && el.addEventListener("input", render));
    sendBtn.addEventListener("click", (e) => {
      if (!cart.length) { e.preventDefault(); toast("Ajoutez au moins une box"); }
    });
    if (copyBtn) copyBtn.addEventListener("click", async () => {
      if (!cart.length) { toast("Ajoutez au moins une box"); return; }
      try { await navigator.clipboard.writeText(message()); toast("Récapitulatif copié"); }
      catch (e) { toast("Copie impossible sur ce navigateur"); }
    });
    refresh();
    render();
  }

  /* Formulaire de contact → SMS */
  function contactForm() {
    const form = $("[data-contact]");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#c-name", form).value.trim();
      const msg = $("#c-msg", form).value.trim();
      if (!msg) { toast("Écrivez votre message"); return; }
      const body = `Bonjour Maison Pastier,\n${msg}${name ? `\n— ${name}` : ""}`;
      window.location.href = smsHref(body);
    });
  }

  /* ------------------------------------------------------------------------
     Minuteur de cuisson (savoir-faire.html)
     ------------------------------------------------------------------------ */
  function cookingTimer() {
    const box = $("[data-timer]");
    if (!box) return;
    const presets = $$(".timer__preset", box);
    const timeEl = $(".timer__time", box);
    const labelEl = $(".timer__label", box);
    const msg = $(".timer__msg", box);
    const fg = $(".timer__ring .fg", box);
    const startBtn = $("[data-timer-start]", box);
    const resetBtn = $("[data-timer-reset]", box);
    const C = 2 * Math.PI * 140;
    fg.style.strokeDasharray = `${C}`;
    let total = 180, left = 180, running = false, raf = 0, endAt = 0, name = "Tagliatelles", tip = "";

    const draw = () => {
      const m = Math.floor(Math.ceil(left) / 60);
      const s = Math.ceil(left) % 60;
      timeEl.textContent = `${m}:${String(s).padStart(2, "0")}`;
      fg.style.strokeDashoffset = String(C * (1 - left / total));
    };
    const beep = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.35, 0.7].forEach((d) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = 880;
          g.gain.setValueAtTime(0.0001, ctx.currentTime + d);
          g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + d + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.25);
          o.connect(g).connect(ctx.destination);
          o.start(ctx.currentTime + d);
          o.stop(ctx.currentTime + d + 0.3);
        });
      } catch (e) { /* audio indisponible */ }
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    };
    const tick = () => {
      left = Math.max(0, (endAt - performance.now()) / 1000);
      draw();
      if (left <= 0) {
        running = false;
        startBtn.textContent = "Relancer";
        box.classList.add("is-done");
        msg.textContent = tip || "C’est prêt ! Égouttez sans rincer.";
        beep();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const select = (p) => {
      presets.forEach((x) => x.setAttribute("aria-pressed", String(x === p)));
      total = left = Number(p.dataset.seconds);
      name = p.dataset.name;
      tip = p.dataset.tip || "";
      cancelAnimationFrame(raf);
      running = false;
      box.classList.remove("is-done");
      labelEl.textContent = name;
      msg.textContent = "";
      startBtn.textContent = "Lancer";
      draw();
    };
    presets.forEach((p) => p.addEventListener("click", () => select(p)));
    startBtn.addEventListener("click", () => {
      if (running) {
        running = false;
        cancelAnimationFrame(raf);
        startBtn.textContent = "Reprendre";
        return;
      }
      if (left <= 0) { left = total; box.classList.remove("is-done"); msg.textContent = ""; }
      running = true;
      endAt = performance.now() + left * 1000;
      startBtn.textContent = "Pause";
      msg.textContent = "Dans l’eau bouillante salée…";
      raf = requestAnimationFrame(tick);
    });
    resetBtn.addEventListener("click", () => select(presets.find((p) => p.getAttribute("aria-pressed") === "true") || presets[0]));
    select(presets[0]);
  }

  /* ------------------------------------------------------------------------
     Sous-navigation active (produits.html)
     ------------------------------------------------------------------------ */
  function subnav() {
    const nav = $("[data-subnav]");
    if (!nav || !hasGsap) return;
    const links = $$("a", nav);
    links.forEach((a) => {
      const sec = document.getElementById(a.getAttribute("href").slice(1));
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec,
        start: "top 50%",
        end: "bottom 50%",
        onToggle: (self) => {
          if (!self.isActive) return;
          links.forEach((l) => l.classList.toggle("is-active", l === a));
          a.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
        },
      });
    });
  }

  /* FAQ : ouverture animée */
  function faq() {
    if (!animate) return;
    $$(".faq details").forEach((d) => {
      const s = $("summary", d);
      const a = $(".faq__a", d);
      s.addEventListener("click", (e) => {
        e.preventDefault();
        if (d.open) {
          gsap.to(a, { height: 0, opacity: 0, duration: 0.45, ease: "power3.inOut", onComplete: () => { d.open = false; gsap.set(a, { clearProps: "all" }); ScrollTrigger.refresh(); } });
        } else {
          d.open = true;
          gsap.from(a, { height: 0, opacity: 0, duration: 0.6, ease: "expo.out", onComplete: () => ScrollTrigger.refresh() });
        }
      });
    });
  }

  /* Carte Google : activée au clic pour ne pas bloquer le scroll */
  $$(".map").forEach((m) => {
    m.addEventListener("click", () => m.classList.add("is-active"));
    m.addEventListener("mouseleave", () => m.classList.remove("is-active"));
  });

  /* Année courante */
  $$("[data-year]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  /* ------------------------------------------------------------------------
     Lancement
     ------------------------------------------------------------------------ */
  carte();
  priceSwitch();
  orderBuilder();
  contactForm();
  cookingTimer();
  marquees();

  const start = async () => {
    await curtainOut();
    await runIntro();
    heroIn();
    scrollAnimations();
    processScroll();
    subnav();
    faq();
    pointerFx();
    if (hasGsap) {
      ScrollTrigger.refresh();
      // Recalcule après chargement des images/polices
      window.addEventListener("load", () => ScrollTrigger.refresh());
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
    // Ancre dans l'URL à l'arrivée
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) setTimeout(() => scrollToTarget(el), 300);
    }
  };
  start();
})();
