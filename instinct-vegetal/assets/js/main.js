/* Instinct Végétal — interactions communes */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* vidéo du hero : figée si l'utilisateur demande moins d'animations */
  const heroVideo = document.querySelector(".hero-media video");
  if (heroVideo && reduce) { heroVideo.removeAttribute("autoplay"); heroVideo.pause(); }
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---------- Header : se cache en descendant, revient en remontant ---------- */
  const header = $(".header");
  let lastY = scrollY;
  addEventListener("scroll", () => {
    const y = scrollY;
    header?.classList.toggle("scrolled", y > 40);
    if (!document.body.classList.contains("menu-open")) {
      header?.classList.toggle("hide", y > lastY && y > 400);
    }
    lastY = y;
  }, { passive: true });

  /* ---------- Menu mobile ---------- */
  const burger = $(".burger");
  burger?.addEventListener("click", () => {
    const open = document.body.classList.toggle("menu-open");
    burger.setAttribute("aria-expanded", open);
    $(".mobile-menu")?.setAttribute("aria-hidden", !open);
  });
  $$(".mobile-menu a").forEach(a => a.addEventListener("click", () => {
    document.body.classList.remove("menu-open");
    burger?.setAttribute("aria-expanded", "false");
  }));

  /* ---------- Apparitions au scroll ----------
     Tout bloc arrivé dans l'écran OU déjà dépassé (saut via le menu) est révélé. */
  let pending = $$(".reveal, .img-reveal, .step, .reviews");
  let ticking = false;
  const revealCheck = () => {
    ticking = false;
    const limit = innerHeight * 0.9;
    pending = pending.filter(el => {
      if (el.getBoundingClientRect().top < limit) { el.classList.add("in"); return false; }
      return true;
    });
  };
  const queueReveal = () => { if (!ticking) { ticking = true; requestAnimationFrame(revealCheck); } };
  addEventListener("scroll", queueReveal, { passive: true });
  addEventListener("resize", queueReveal);
  addEventListener("load", queueReveal);
  revealCheck();

  /* ---------- Manifeste : les mots s'allument en lisant ---------- */
  const big = $(".manifesto .big");
  if (big && !reduce) {
    const wrapWords = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part.trim()) { frag.append(part); return; }
            const s = document.createElement("span");
            s.className = "w"; s.textContent = part; frag.append(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) wrapWords(n);
      });
    };
    wrapWords(big);
    const words = $$(".w", big);
    const light = () => {
      const r = big.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
      const n = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle("on", i < n));
    };
    addEventListener("scroll", light, { passive: true });
    light();
  }

  /* ---------- Curseur ---------- */
  if (finePointer && !reduce) {
    const c = document.createElement("div");
    c.className = "cursor";
    c.innerHTML = "<span></span>";
    document.body.append(c);
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener("mousemove", e => { x = e.clientX; y = e.clientY; c.style.opacity = 1; });
    document.addEventListener("mouseleave", () => (c.style.opacity = 0));
    addEventListener("blur", () => (c.style.opacity = 0));
    (function loop() {
      cx += (x - cx) * 0.2; cy += (y - cy) * 0.2;
      c.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener("mouseover", e => {
      const big = e.target.closest("[data-cursor]");
      const link = e.target.closest("a, button, label, input[type=range]");
      c.classList.toggle("big", !!big);
      c.classList.toggle("link", !big && !!link);
      c.firstChild.textContent = big ? big.dataset.cursor : "";
    });
  }

  /* ---------- Boutons magnétiques ---------- */
  if (finePointer && !reduce) {
    $$(".btn").forEach(b => {
      b.addEventListener("mousemove", e => {
        const r = b.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        b.style.transform = `translate(${dx * 0.18}px, ${dy * 0.28}px)`;
      });
      b.addEventListener("mouseleave", () => (b.style.transform = ""));
    });
  }

  /* ---------- Cartes services : lumière + inclinaison ---------- */
  if (finePointer && !reduce) {
    $$(".svc").forEach(card => {
      card.addEventListener("mousemove", e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty("--mx", px * 100 + "%");
        card.style.setProperty("--my", py * 100 + "%");
        card.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 5}deg) rotateY(${(px - 0.5) * 6}deg)`;
      });
      card.addEventListener("mouseleave", () => (card.style.transform = ""));
    });
  }

  /* ---------- Palette végétale : filtres + dépliage ---------- */
  $$(".plant-row").forEach(row => row.addEventListener("click", () => {
    const li = row.parentElement;
    const open = li.classList.toggle("open");
    row.setAttribute("aria-expanded", open);
  }));
  $$(".filter").forEach(btn => btn.addEventListener("click", () => {
    $$(".filter").forEach(b => b.classList.toggle("active", b === btn));
    const f = btn.dataset.f;
    $$(".plant").forEach(p => p.classList.toggle("dim", f !== "all" && !p.dataset.tags.split(" ").includes(f)));
  }));

  /* ---------- Réalisations : scroll vertical -> défilement horizontal ---------- */
  const pin = $(".works-pin");
  if (pin) {
    const track = $(".works-track", pin);
    const bar = $(".works-progress i", pin);
    const num = $(".works-progress .num", pin);
    const desktop = matchMedia("(min-width: 861px)");
    const update = () => {
      if (!desktop.matches || reduce) { track.style.transform = ""; return; }
      const r = pin.getBoundingClientRect();
      const total = pin.offsetHeight - innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / total));
      const max = Math.max(0, track.scrollWidth - innerWidth);
      track.style.transform = `translate3d(${-p * max}px,0,0)`;
      if (bar) bar.style.transform = `scaleX(${p})`;
      if (num) num.textContent = String(Math.round(p * 100)).padStart(2, "0");
    };
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    update();
  }

  /* ---------- Parallaxe douce sur les images marquées ---------- */
  if (!reduce) {
    const par = $$("[data-parallax]");
    const run = () => {
      par.forEach(el => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        el.style.transform = `translate3d(0, ${p * -parseFloat(el.dataset.parallax)}px, 0) scale(1.1)`;
      });
    };
    addEventListener("scroll", run, { passive: true });
    run();
  }

  /* ---------- Croissance générative du hero ---------- */
  const cv = $("#growth");
  if (cv && !reduce) {
    const ctx = cv.getContext("2d");
    let W, H, dpr, stems = [], mouseX = 0.5, t0 = performance.now(), visible = true;
    const rand = (a, b) => a + Math.random() * (b - a);

    let builtW = 0;
    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const build = () => {
      size();
      if (W === builtW) return; // seule la hauteur a changé (barre d'adresse mobile)
      builtW = W;
      const n = Math.round(W / (W < 600 ? 18 : 14));
      stems = Array.from({ length: n }, (_, i) => {
        const edge = Math.abs(i / n - 0.5) * 2; // plus haut sur les bords
        return {
          x: i / n + rand(-8, 8) / W,
          h: rand(0.08, 0.22) * (0.6 + edge * 0.9),
          bend: rand(-0.25, 0.25),
          phase: rand(0, Math.PI * 2),
          delay: rand(0, 1400),
          w: rand(0.6, 1.6),
          leaf: Math.random() < 0.22,
          hue: Math.random() < 0.12 ? "196,103,59" : "169,183,154",
        };
      });
    };

    const draw = now => {
      if (!visible) { requestAnimationFrame(draw); return; }
      const t = now - t0;
      ctx.clearRect(0, 0, W, H);
      const wind = (mouseX - 0.5) * 0.5;
      for (const s of stems) {
        const g = Math.min(1, Math.max(0, (t - s.delay) / 2200));
        if (g <= 0) continue;
        const e = 1 - Math.pow(1 - g, 3);
        const sway = Math.sin(t / 1600 + s.phase) * 0.06 + wind * s.h * 1.4;
        const len = s.h * H * e;
        const x = s.x * W;
        const tipX = x + (s.bend + sway) * len;
        const tipY = H - len;
        const cX = x + (s.bend * 0.3 + sway * 0.4) * len;
        const cY = H - len * 0.55;
        ctx.strokeStyle = `rgba(${s.hue},${0.22 + 0.35 * e})`;
        ctx.lineWidth = s.w;
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.quadraticCurveTo(cX, cY, tipX, tipY);
        ctx.stroke();
        if (s.leaf && e > 0.85) {
          ctx.fillStyle = `rgba(${s.hue},${0.5 * e})`;
          ctx.beginPath();
          ctx.ellipse(tipX, tipY, 2.4, 5.5, (s.bend + sway) * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      requestAnimationFrame(draw);
    };

    build();
    addEventListener("resize", build);
    addEventListener("mousemove", e => (mouseX = e.clientX / innerWidth), { passive: true });
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(cv);
    requestAnimationFrame(draw);
  }

  /* ---------- Météo en direct à Six-Fours + conseil jardin ---------- */
  const live = $("#live");
  if (live) {
    const labels = {
      0: "ciel dégagé", 1: "plutôt dégagé", 2: "partiellement nuageux", 3: "couvert",
      45: "brouillard", 48: "brouillard", 51: "bruine", 53: "bruine", 55: "bruine",
      61: "pluie", 63: "pluie", 65: "forte pluie", 80: "averses", 81: "averses", 82: "fortes averses",
      95: "orage", 96: "orage", 99: "orage",
    };
    fetch("https://api.open-meteo.com/v1/forecast?latitude=43.094&longitude=5.839&current=temperature_2m,weather_code,precipitation,wind_speed_10m&timezone=Europe%2FParis")
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(({ current: c }) => {
        const temp = Math.round(c.temperature_2m);
        const label = labels[c.weather_code] || "temps variable";
        let tip = "Belle journée pour le jardin";
        if (c.precipitation > 0 || [61, 63, 65, 80, 81, 82].includes(c.weather_code)) tip = "Pas d'arrosage aujourd'hui";
        else if (c.wind_speed_10m >= 40) tip = "Mistral : on reporte les tailles";
        else if (temp >= 28) tip = "Arrosez tôt le matin ou le soir";
        else if (temp <= 3) tip = "Gel possible : protégez les agrumes";
        live.querySelector(".data").textContent = `Six-Fours · ${temp}°C · ${label}`;
        live.querySelector(".tip").textContent = "→ " + tip;
        live.classList.add("ready");
      })
      .catch(() => live.remove());
  }

  /* ---------- Année du footer ---------- */
  $$("[data-year]").forEach(el => (el.textContent = new Date().getFullYear()));
})();
