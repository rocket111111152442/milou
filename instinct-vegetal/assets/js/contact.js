/* Formulaire de contact en étapes
 *
 * ENVOI DES DEMANDES : renseignez FORM_ENDPOINT avec l'URL d'un service de formulaire
 * (ex. Formspree : https://formspree.io/f/xxxxxx — gratuit, les demandes arrivent par e-mail).
 * Tant que FORM_ENDPOINT est vide, le site propose d'envoyer le récapitulatif par SMS
 * ou d'appeler directement.
 */
const FORM_ENDPOINT = "";
const PHONE = "+33658582084";

(() => {
  const form = document.getElementById("wizard");
  if (!form) return;
  const panels = [...form.querySelectorAll(".panel")];
  const bars = [...form.querySelectorAll(".wz-steps i")];
  const count = document.getElementById("wzCount");
  const err = document.getElementById("wzError");
  const next = document.getElementById("next");
  const prev = document.getElementById("prev");
  const nav = document.getElementById("wzNav");
  let step = 1;

  /* Surface : curseur à échelle logarithmique (20 m² -> 3 000 m²) */
  const range = document.getElementById("surface");
  const out = document.getElementById("surfVal");
  const toM2 = v => {
    const m = 20 * Math.pow(150, v / 100);
    const step = m < 100 ? 5 : m < 1000 ? 25 : 100;
    return Math.round(m / step) * step;
  };
  const syncRange = () => {
    const m = toM2(+range.value);
    out.textContent = m >= 3000 ? "3 000+" : m.toLocaleString("fr-FR");
    range.style.setProperty("--p", range.value + "%");
  };
  range.addEventListener("input", syncRange);
  syncRange();

  /* Passer à l'étape suivante dès qu'un type de projet est choisi */
  form.querySelectorAll('input[name="projet"]').forEach(r =>
    r.addEventListener("change", () => setTimeout(() => go(1), 260))
  );

  const val = name => form.querySelector(`[name="${name}"]:checked`)?.value || "";
  const field = id => document.getElementById(id).value.trim();

  const data = () => ({
    projet: val("projet"),
    surface: out.textContent + " m²",
    ambiance: val("ambiance"),
    delai: val("delai"),
    nom: field("nom"),
    telephone: field("tel"),
    email: field("email"),
    commune: field("ville"),
    message: field("msg"),
  });

  const validate = () => {
    err.textContent = "";
    form.querySelectorAll(".f.err").forEach(f => f.classList.remove("err"));
    if (step === 1 && !val("projet")) return (err.textContent = "Choisissez un type de projet."), false;
    if (step === 3) {
      let ok = true;
      const nom = document.getElementById("nom");
      const tel = document.getElementById("tel");
      const email = document.getElementById("email");
      if (!nom.value.trim()) { nom.parentElement.classList.add("err"); ok = false; }
      if (tel.value.replace(/\D/g, "").length < 10) { tel.parentElement.classList.add("err"); ok = false; }
      if (email.value && !email.checkValidity()) { email.parentElement.classList.add("err"); ok = false; }
      if (!ok) return (err.textContent = "Vérifiez les champs en rouge (nom et téléphone obligatoires)."), false;
      if (!document.getElementById("rgpd").checked) return (err.textContent = "Merci d'accepter d'être recontacté."), false;
    }
    return true;
  };

  const esc = s => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const render = () => {
    panels.forEach(p => p.classList.toggle("active", p.dataset.step === String(step)));
    bars.forEach((b, i) => b.classList.toggle("done", i < step));
    count.textContent = `ÉTAPE ${step} / 4`;
    prev.hidden = step === 1;
    next.innerHTML = step === 4 ? 'Envoyer la demande <span class="arrow">→</span>' : 'Continuer <span class="arrow">→</span>';
    if (step === 4) {
      const d = data();
      document.getElementById("summary").innerHTML = [
        ["Projet", d.projet], ["Surface", d.surface], ["Ambiance", d.ambiance], ["Délai", d.delai],
        ["Nom", d.nom], ["Téléphone", d.telephone], ["E-mail", d.email || "—"], ["Commune", d.commune || "—"],
        ["Message", d.message || "—"],
      ].map(([k, v]) => `<b>${k.toUpperCase()}</b> · ${esc(v)}`).join("<br>");
    }
  };

  const go = dir => {
    if (dir > 0 && !validate()) return;
    step = Math.min(4, Math.max(1, step + dir));
    render();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const done = (title, text, actions) => {
    panels.forEach(p => p.classList.toggle("active", p.dataset.step === "done"));
    bars.forEach(b => b.classList.add("done"));
    count.textContent = "TERMINÉ";
    nav.style.display = "none";
    err.textContent = "";
    document.getElementById("doneTitle").innerHTML = title;
    document.getElementById("doneText").textContent = text;
    document.getElementById("doneActions").innerHTML = actions;
  };

  const smsBody = d =>
    `Bonjour, demande de devis via le site.\nProjet : ${d.projet}\nSurface : ${d.surface}\nAmbiance : ${d.ambiance}\nDélai : ${d.delai}\n` +
    `Nom : ${d.nom}\nTél : ${d.telephone}${d.email ? "\nE-mail : " + d.email : ""}${d.commune ? "\nCommune : " + d.commune : ""}${d.message ? "\n" + d.message : ""}`;

  const fallback = d => {
    const sms = `sms:${PHONE}?&body=${encodeURIComponent(smsBody(d))}`;
    done(
      "Dernière <em>étape</em>.",
      "Envoyez votre récapitulatif par SMS (il est déjà rédigé) ou appelez directement.",
      `<a class="btn" href="${sms}">Envoyer par SMS <span class="arrow">→</span></a><a class="btn ghost" href="tel:${PHONE}">Appeler</a>`
    );
  };

  const submit = async () => {
    const d = data();
    if (form.querySelector('[name="_gotcha"]').value) return; // robot
    if (!FORM_ENDPOINT) return fallback(d);
    next.disabled = true;
    next.innerHTML = "Envoi…";
    try {
      const r = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...d, _subject: `Demande de devis — ${d.projet} — ${d.nom}` }),
      });
      if (!r.ok) throw new Error(r.status);
      done("Merci, c'est <em>envoyé</em> !", "On vous rappelle très vite pour organiser une visite.", "");
    } catch {
      next.disabled = false;
      render();
      err.textContent = "L'envoi a échoué. Réessayez ou appelez le 06 58 58 20 84.";
    }
  };

  next.addEventListener("click", () => (step === 4 ? submit() : go(1)));
  prev.addEventListener("click", () => go(-1));
  form.addEventListener("submit", e => e.preventDefault());
  form.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox") {
      e.preventDefault();
      next.click();
    }
  });
  render();
})();
