/* =========================================================
   CONFIG — à compléter par l'entreprise
   ========================================================= */
window.MD_CONFIG = {
  // Numéro au format affiché ; laissez vide tant qu'il n'est pas renseigné.
  phone: "",
  // Adresse e-mail qui recevra les demandes du formulaire (utilisée par FormSubmit.co).
  email: "",
  lat: 43.0936,
  lon: 5.8389
};

(() => {
  const cfg = window.MD_CONFIG;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  requestAnimationFrame(() => document.body.classList.add("is-loaded"));

  /* vidéo du hero : figée si l'utilisateur demande moins d'animations */
  const heroVideo = document.querySelector(".hero-video");
  if (heroVideo && reduce) { heroVideo.removeAttribute("autoplay"); heroVideo.pause(); }

  /* ---------- phone ---------- */
  const tel = cfg.phone.replace(/[^\d+]/g, "");
  document.querySelectorAll("[data-phone]").forEach(el => {
    el.textContent = cfg.phone || "Téléphone à venir";
    if (!cfg.phone) el.classList.add("todo");
  });
  document.querySelectorAll("[data-phone-link]").forEach(el => {
    if (tel) el.href = "tel:" + tel;
    else el.href = "contact.html";
  });
  document.querySelectorAll("[data-year]").forEach(el => (el.textContent = new Date().getFullYear()));

  /* ---------- nav ---------- */
  const nav = document.getElementById("nav");
  const burger = nav && nav.querySelector(".nav-burger");
  if (burger) {
    burger.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open);
    });
    nav.querySelectorAll(".nav-links a").forEach(a =>
      a.addEventListener("click", () => {
        nav.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      })
    );
  }
  let lastY = 0;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    if (nav && !nav.classList.contains("is-open")) nav.classList.toggle("is-hidden", y > lastY && y > 400);
    lastY = y;
  }, { passive: true });

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      e.target.querySelectorAll(":scope > .reveal-clip").forEach(c => c.classList.add("is-in"));
      e.target.querySelectorAll("[data-count]").forEach(countUp);
      if (e.target.hasAttribute("data-count")) countUp(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".reveal, .step").forEach(el => io.observe(el));
  // un élément entièrement masqué par clip-path n'est jamais « visible » : on observe son parent
  document.querySelectorAll(".reveal-clip").forEach(el => io.observe(el.parentElement));

  function countUp(el) {
    if (el.dataset.done) return;
    el.dataset.done = 1;
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || 0, 10);
    const fmt = v => v.toFixed(dec).replace(".", ",");
    if (reduce) return (el.textContent = fmt(target));
    const t0 = performance.now(), dur = 1600;
    const tick = t => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = fmt(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- cursor ---------- */
  if (fine && !reduce) {
    const ring = document.querySelector(".cursor");
    const dot = document.querySelector(".cursor-dot");
    if (ring && dot) {
      let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
      addEventListener("mousemove", e => {
        mx = e.clientX; my = e.clientY;
        dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
      });
      (function loop() {
        rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
        ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
        requestAnimationFrame(loop);
      })();
      document.querySelectorAll("a, button, label, .shot, .dial, input, textarea").forEach(el => {
        el.addEventListener("mouseenter", () => ring.classList.add("is-hover"));
        el.addEventListener("mouseleave", () => ring.classList.remove("is-hover"));
      });
    }

    /* magnetic buttons */
    document.querySelectorAll(".magnetic").forEach(btn => {
      btn.addEventListener("mousemove", e => {
        const r = btn.getBoundingClientRect();
        btn.style.setProperty("--bx", (e.clientX - r.left - r.width / 2) * 0.25 + "px");
        btn.style.setProperty("--by", (e.clientY - r.top - r.height / 2) * 0.35 + "px");
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.setProperty("--bx", "0px");
        btn.style.setProperty("--by", "0px");
      });
    });
  }

  /* ---------- live clock (Europe/Paris) ---------- */
  const clocks = document.querySelectorAll("[data-clock]");
  if (clocks.length) {
    const f = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
    const upd = () => clocks.forEach(c => (c.textContent = f.format(new Date())));
    upd(); setInterval(upd, 15000);
  }

  /* ---------- live weather (Open-Meteo, sans clé) ---------- */
  const weather = document.querySelectorAll("[data-weather]");
  if (weather.length) {
    const codes = c => c === 0 ? "ciel clair" : c <= 3 ? "nuageux" : c <= 48 ? "brume" : c <= 67 ? "pluie" : c <= 77 ? "neige" : c <= 82 ? "averses" : "orage";
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${cfg.lat}&longitude=${cfg.lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=Europe%2FParis`)
      .then(r => r.json())
      .then(d => {
        const c = d.current;
        const txt = `${Math.round(c.temperature_2m)}°C · ${codes(c.weather_code)} · vent ${Math.round(c.wind_speed_10m)} km/h`;
        weather.forEach(w => (w.textContent = txt));
        window.MD_WIND = c.wind_speed_10m;
      })
      .catch(() => weather.forEach(w => (w.closest("span").style.display = "none")));
  }
})();
