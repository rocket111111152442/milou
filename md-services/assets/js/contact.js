/* Formulaire de devis en 3 étapes. */
(() => {
  const form = document.getElementById("wizard");
  if (!form) return;
  const steps = [...form.querySelectorAll(".fstep")];
  const dots = form.querySelectorAll(".step-dots i");
  const prev = document.getElementById("prev");
  const next = document.getElementById("next");
  const nav = document.getElementById("wizNav");
  const msg = document.getElementById("formMsg");
  const ring = document.getElementById("ring");
  const names = ["Vos besoins", "Votre terrain", "Vos coordonnées"];
  const C = 125.66;
  let step = 1;

  /* ---------- surface + grille ---------- */
  const range = document.getElementById("surface");
  const out = document.getElementById("surfOut");
  const plot = document.getElementById("plot");
  plot.innerHTML = "<i></i>".repeat(100);
  const cells = plot.children;
  // ordre de remplissage en spirale depuis le centre : effet "parcelle qui s'étend"
  const order = [...Array(100).keys()].sort((a, b) => {
    const d = i => Math.max(Math.abs((i % 10) - 4.5), Math.abs(Math.floor(i / 10) - 4.5));
    return d(a) - d(b) || a - b;
  });
  function updSurface() {
    const v = +range.value;
    out.textContent = v >= 2000 ? "2000+" : v;
    const p = (v - range.min) / (range.max - range.min);
    range.style.setProperty("--p", p * 100 + "%");
    const n = Math.max(1, Math.round(Math.sqrt(p) * 100));
    order.forEach((idx, k) => cells[idx].classList.toggle("on", k < n));
  }
  range.addEventListener("input", updSurface);
  updSurface();

  /* ---------- navigation ---------- */
  function show(n) {
    step = n;
    steps.forEach(s => s.classList.toggle("active", +s.dataset.step === n));
    dots.forEach((d, i) => d.classList.toggle("on", i < n));
    ring.style.strokeDashoffset = C * (1 - Math.min(n, 3) / 3);
    document.getElementById("stepNum").textContent = Math.min(n, 3);
    document.getElementById("stepName").textContent = names[Math.min(n, 3) - 1];
    prev.hidden = n === 1 || n === 4;
    next.innerHTML = n === 3 ? 'Envoyer la demande <span class="arrow">→</span>' : 'Continuer <span class="arrow">→</span>';
    nav.style.display = n === 4 ? "none" : "";
    msg.textContent = "";
    if (n === 3) recap();
    const top = form.getBoundingClientRect().top + scrollY - 100;
    if (scrollY > top) scrollTo({ top, behavior: "smooth" });
  }

  const checked = name => [...form.querySelectorAll(`[name="${name}"]:checked`)].map(i => i.value);

  function recap() {
    const s = checked("services");
    document.getElementById("recap").innerHTML =
      `<span class="mono" style="color:var(--chloro)">Récapitulatif</span><br>` +
      `<b>${s.join(", ") || "—"}</b> · ${out.textContent} m² · ${checked("frequence")[0]} · ${checked("delai")[0]}`;
  }

  function validate() {
    if (step === 1 && !checked("services").length) {
      msg.textContent = "Choisissez au moins un service.";
      return false;
    }
    if (step === 3) {
      let ok = true;
      ["nom", "tel"].forEach(id => {
        const el = document.getElementById(id);
        const bad = !el.value.trim() || (id === "tel" && el.value.replace(/\D/g, "").length < 9);
        el.parentElement.classList.toggle("invalid", bad);
        if (bad) ok = false;
      });
      const mail = document.getElementById("mail");
      const badMail = mail.value && !/^\S+@\S+\.\S+$/.test(mail.value);
      mail.parentElement.classList.toggle("invalid", badMail);
      if (badMail) ok = false;
      if (!ok) { msg.textContent = "Vérifiez les champs en rouge."; return false; }
      if (!document.getElementById("consent").checked) { msg.textContent = "Merci de cocher la case de consentement."; return false; }
    }
    return true;
  }

  next.addEventListener("click", () => {
    if (!validate()) return;
    if (step < 3) return show(step + 1);
    send();
  });
  prev.addEventListener("click", () => show(step - 1));
  form.addEventListener("submit", e => { e.preventDefault(); next.click(); });

  /* ---------- envoi ---------- */
  async function send() {
    if (form._honey.value) return show(4);
    const data = {
      _subject: "Nouvelle demande de devis — site MD Services",
      services: checked("services").join(", "),
      surface: out.textContent + " m²",
      frequence: checked("frequence")[0],
      delai: checked("delai")[0],
      nom: form.nom.value.trim(),
      telephone: form.telephone.value.trim(),
      email: form.email.value.trim(),
      ville: form.ville.value.trim(),
      message: form.message.value.trim()
    };
    const to = window.MD_CONFIG.email;
    if (!to) {
      msg.textContent = "Le formulaire n'est pas encore relié à une adresse e-mail. Merci d'appeler directement MD Services.";
      return;
    }
    next.disabled = true;
    next.textContent = "Envoi…";
    try {
      const r = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(to), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data)
      });
      if (!r.ok) throw new Error(r.status);
      show(4);
    } catch (err) {
      msg.textContent = "L'envoi a échoué. Réessayez ou appelez directement MD Services.";
      next.disabled = false;
      next.innerHTML = 'Envoyer la demande <span class="arrow">→</span>';
    }
  }

  show(1);
})();
