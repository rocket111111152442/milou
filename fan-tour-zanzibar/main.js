/* Fan Tour Zanzibar – interactions légères, sans dépendance. */

// À MODIFIER : numéro WhatsApp au format international, chiffres uniquement.
const WHATSAPP_NUMBER = "255786978003";

const waLink = (message) =>
  `https://wa.me/${WHATSAPP_NUMBER}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

// Liens WhatsApp : chaque élément [data-wa] reçoit son message prérempli.
document.querySelectorAll("[data-wa]").forEach((el) => {
  el.href = waLink(el.dataset.wa);
});

// Vidéo du hero : image fixe (poster) si l'utilisateur préfère réduire les animations.
const heroVideo = document.querySelector("[data-hero-video]");
if (heroVideo && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  heroVideo.removeAttribute("autoplay");
  heroVideo.pause();
}

// En-tête : fond opaque après le hero.
const header = document.querySelector("[data-header]");
const hero = document.querySelector(".hero");
if (header && hero && "IntersectionObserver" in window) {
  new IntersectionObserver(
    ([entry]) => header.classList.toggle("is-scrolled", !entry.isIntersecting),
    { rootMargin: `-${header.offsetHeight}px 0px 0px 0px` }
  ).observe(hero);
}

// Menu mobile.
const toggle = document.querySelector("[data-menu-toggle]");
const menu = document.getElementById("menu");
const setMenu = (open) => {
  toggle.setAttribute("aria-expanded", String(open));
  toggle.querySelector(".sr-only").textContent = open ? "Fermer le menu" : "Ouvrir le menu";
  header.classList.toggle("menu-open", open);
  document.body.style.overflow = open ? "hidden" : "";
};
if (toggle && menu) {
  toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      toggle.focus();
    }
  });
  window.matchMedia("(min-width: 1024px)").addEventListener("change", (e) => {
    if (e.matches) setMenu(false);
  });
}

// Apparition douce des éléments au défilement.
const reveals = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  // Léger décalage entre éléments voisins (cartes, étapes…).
  reveals.forEach((el) => {
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
    el.style.setProperty("--delay", `${Math.min(siblings.indexOf(el), 5) * 0.08}s`);
    io.observe(el);
  });
} else {
  reveals.forEach((el) => el.classList.add("is-visible"));
}

// Bouton flottant masqué quand la section contact (qui a déjà son bouton) est visible.
const floatBtn = document.querySelector(".wa-float");
const contact = document.getElementById("contact");
if (floatBtn && contact && "IntersectionObserver" in window) {
  new IntersectionObserver(([entry]) => floatBtn.classList.toggle("is-hidden", entry.isIntersecting), {
    threshold: 0.35,
  }).observe(contact);
}

// Formulaire : compose un message et l'ouvre dans WhatsApp (aucun envoi serveur).
const form = document.querySelector("[data-wa-form]");
if (form) {
  const error = form.querySelector("[data-form-error]");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const get = (k) => String(data.get(k) || "").trim();
    const prenom = form.elements.prenom;

    if (!get("prenom")) {
      prenom.setAttribute("aria-invalid", "true");
      error.hidden = false;
      prenom.focus();
      return;
    }
    prenom.removeAttribute("aria-invalid");
    error.hidden = true;

    const lines = [`Bonjour Fan Tour Zanzibar ! Je m’appelle ${get("prenom")}.`];
    if (get("dates")) lines.push(`Dates approximatives : ${get("dates")}`);
    if (get("personnes")) lines.push(`Nombre de personnes : ${get("personnes")}`);
    if (get("message")) lines.push("", get("message"));

    const url = waLink(lines.join("\n"));
    const win = window.open(url, "_blank");
    if (win) win.opener = null;
    else window.location.href = url; // fenêtre bloquée : on ouvre dans l'onglet courant
  });
}

// Année du pied de page.
const year = document.querySelector("[data-year]");
if (year) year.textContent = new Date().getFullYear();
