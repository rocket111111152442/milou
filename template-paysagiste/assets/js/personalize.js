/* =========================================================
   Personnalisation du template
   Valeurs par défaut ci-dessous, surchargées par l'URL :
   ?nom=Jardins+Dupont&ville=Hyères&cp=83400&tel=0612345678
    &note=4.8&avis=27&adresse=12+rue+des+Pins&email=contact@exemple.fr
   ========================================================= */
(() => {
  const DEFAUTS = {
    nom: "Votre Entreprise",
    ville: "Votre ville",
    cp: "",
    adresse: "",
    tel: "",
    email: "",
    note: "5,0",
    avis: ""
  };

  // Vous (l'expéditeur de la démo) : affiché dans le bandeau « démo ».
  const VENDEUR = {
    nom: "",
    tel: "",
    email: ""
  };

  const params = new URLSearchParams(location.search);
  const clean = (v, max = 60) => String(v || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);

  const d = {};
  for (const k of Object.keys(DEFAUTS)) d[k] = clean(params.get(k)) || DEFAUTS[k];
  d.tel = d.tel.replace(/[^\d+ .]/g, "");
  d.cp = d.cp.replace(/[^\dA-Za-z ]/g, "");
  d.avis = d.avis.replace(/\D/g, "");

  const noteNum = Math.min(5, Math.max(0, parseFloat(d.note.replace(",", ".")) || 5));
  d.note = noteNum.toFixed(1).replace(".", ",");
  d.note_num = String(noteNum);

  d.initiales = d.nom.split(/[\s'’-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toLowerCase() || "ja";

  const lieu = [d.adresse, d.cp, d.ville].filter(Boolean).join(" ");
  const q = encodeURIComponent;
  d.lien_google = "https://www.google.com/maps/search/?api=1&query=" + q(d.nom + " " + d.ville);
  d.lien_carte = "https://www.google.com/maps?q=" + q(d.adresse ? lieu : d.nom + " " + d.ville) + "&output=embed";
  d.lien_itineraire = "https://www.google.com/maps/dir/?api=1&destination=" + q(d.adresse ? lieu : d.nom + " " + d.ville);

  const fill = str => str.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in d ? d[k] : m));

  // textes (nœuds texte uniquement : aucune injection HTML possible)
  const walk = root => {
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = it.nextNode())) if (n.nodeValue.includes("{{")) n.nodeValue = fill(n.nodeValue);
  };
  walk(document.head);
  walk(document.body);
  document.title = fill(document.title);

  // attributs
  const ATTRS = ["content", "alt", "title", "aria-label", "href", "src", "data-count"];
  document.querySelectorAll("*").forEach(el => {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && v.includes("{{")) el.setAttribute(a, fill(v));
    }
  });

  // blocs conditionnels
  document.querySelectorAll("[data-if]").forEach(el => {
    if (!d[el.dataset.if]) el.remove();
  });
  if (!d.cp) document.querySelectorAll(".live").forEach(el => (el.lastChild.nodeValue = " " + d.ville));

  // transmis à main.js (téléphone, formulaire, météo)
  window.MD_CONFIG = Object.assign(window.MD_CONFIG || {}, { phone: d.tel, email: d.email, ville: d.ville === DEFAUTS.ville ? "" : d.ville });

  // bandeau « démo » quand le lien est personnalisé
  if (params.has("nom") && !params.has("sans-bandeau")) {
    const bar = document.createElement("div");
    bar.className = "demo-bar";
    const txt = document.createElement("span");
    txt.textContent = `Aperçu personnalisé pour ${d.nom} — ce site peut être le vôtre.`;
    bar.appendChild(txt);
    const contact = VENDEUR.tel || VENDEUR.email;
    if (contact) {
      const a = document.createElement("a");
      a.href = VENDEUR.tel ? "tel:" + VENDEUR.tel.replace(/[^\d+]/g, "") : "mailto:" + VENDEUR.email;
      a.textContent = "Me contacter" + (VENDEUR.nom ? " · " + VENDEUR.nom : "");
      bar.appendChild(a);
    }
    const x = document.createElement("button");
    x.type = "button";
    x.setAttribute("aria-label", "Fermer");
    x.textContent = "×";
    x.onclick = () => bar.remove();
    bar.appendChild(x);
    document.body.appendChild(bar);
  }

  // garder la personnalisation en naviguant entre les pages
  if (location.search) {
    document.querySelectorAll('a[href$=".html"], a[href*=".html#"]').forEach(a => {
      const [path, hash] = a.getAttribute("href").split("#");
      a.setAttribute("href", path + location.search + (hash ? "#" + hash : ""));
    });
  }
})();
