/* Cadran des saisons : glisser le point autour du cercle. */
(() => {
  const dial = document.getElementById("dial");
  if (!dial) return;
  const svg = dial.querySelector("svg");
  const knob = document.getElementById("knob");
  const arc = document.getElementById("arc");
  const ticks = document.getElementById("ticks");
  const panel = document.getElementById("seasonPanel");
  const labels = dial.querySelectorAll(".dial-label");
  const R = 170;

  const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const SEASONS = [
    {
      name: "Printemps", range: "Mars — Mai", color: "#c4f26a",
      title: "Le réveil du jardin",
      text: "La sève remonte, tout repart. C'est le moment de remettre le jardin en ordre et de préparer l'été avant les fortes chaleurs.",
      tasks: [["Tonte", "Reprise des tontes régulières"], ["Plantation", "Vivaces et arbustes méditerranéens"], ["Paillage", "Garder l'humidité avant l'été"], ["Débroussaillage", "Se mettre en règle avant la saison des feux"]]
    },
    {
      name: "Été", range: "Juin — Août", color: "#f2c14e",
      title: "Tenir face au soleil",
      text: "Chaleur, sécheresse, mistral. L'objectif : protéger les plantes et économiser l'eau, sans laisser le jardin s'emballer.",
      tasks: [["Arrosage", "Tôt le matin, en profondeur"], ["Tonte haute", "Le gazon résiste mieux à la chaleur"], ["Taille légère", "Haies et arbustes, sans les stresser"], ["Prévention", "Abords dégagés contre le risque incendie"]]
    },
    {
      name: "Automne", range: "Sept. — Nov.", color: "#e07b4f",
      title: "La meilleure saison du Var",
      text: "Les pluies reviennent, la terre est encore chaude. En climat méditerranéen, c'est la période idéale pour planter et tailler.",
      tasks: [["Taille", "Grande taille des haies"], ["Plantation", "Les racines s'installent avant l'été suivant"], ["Gazon", "Regarnissage et scarification"], ["Nettoyage", "Ramassage des feuilles"]]
    },
    {
      name: "Hiver", range: "Déc. — Fév.", color: "#8fd3e8",
      title: "Le jardin au repos",
      text: "La végétation dort : on en profite pour les gros travaux de structure et pour préparer le printemps.",
      tasks: [["Élagage", "Arbres en repos végétatif"], ["Rosiers", "Taille en fin d'hiver"], ["Structure", "Bordures, massifs, gravier"], ["Préparation", "Plan du jardin pour le printemps"]]
    }
  ];

  // graduations
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const major = i % 4 === 0;
    const r1 = major ? 150 : 156, r2 = 162;
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", Math.sin(a) * r1); l.setAttribute("y1", -Math.cos(a) * r1);
    l.setAttribute("x2", Math.sin(a) * r2); l.setAttribute("y2", -Math.cos(a) * r2);
    if (major) l.classList.add("major");
    ticks.appendChild(l);
  }

  // angle en degrés, 0 = haut, sens horaire. -45° = début mars.
  let angle = 0, current = -1, anim;

  // démarre sur la saison réelle
  const m = new Date().getMonth();
  angle = ((((m - 2 + 12) % 12) * 30 + 15 - 45) + 360) % 360;

  const norm = a => ((a % 360) + 360) % 360;

  function render() {
    const rad = angle * Math.PI / 180;
    knob.setAttribute("transform", `translate(${Math.sin(rad) * R} ${-Math.cos(rad) * R})`);

    const start = -45 * Math.PI / 180;
    const sweep = norm(angle + 45);
    const large = sweep > 180 ? 1 : 0;
    const sx = Math.sin(start) * R, sy = -Math.cos(start) * R;
    const ex = Math.sin(rad) * R, ey = -Math.cos(rad) * R;
    arc.setAttribute("d", sweep < 0.5 ? "" : `M ${sx} ${sy} A ${R} ${R} 0 ${large} 1 ${ex} ${ey}`);

    const pos = norm(angle + 45);
    const month = (Math.floor(pos / 30) + 2) % 12;
    const season = Math.floor(pos / 90) % 4;
    document.getElementById("dialMonth").textContent = MONTHS[month];
    if (season !== current) setSeason(season);
  }

  function setSeason(i) {
    const first = current === -1;
    current = i;
    const s = SEASONS[i];
    document.documentElement.style.setProperty("--season", s.color);
    labels.forEach(l => l.classList.toggle("on", +l.dataset.s === i));
    dial.setAttribute("aria-valuenow", i);
    dial.setAttribute("aria-valuetext", s.name);
    document.getElementById("dialRange").textContent = s.range;
    const fill = () => {
      document.getElementById("seasonIdx").textContent = "0" + (i + 1);
      document.getElementById("seasonTitle").textContent = s.title;
      document.getElementById("seasonText").textContent = s.text;
      document.getElementById("seasonTasks").innerHTML = s.tasks
        .map(([k, v]) => `<li><b>${k.toUpperCase()}</b><span>${v}</span></li>`).join("");
      panel.classList.remove("is-swapping");
    };
    if (first) return fill();
    panel.classList.add("is-swapping");
    setTimeout(fill, 300);
  }

  function pointerAngle(e) {
    const r = svg.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    return norm(Math.atan2(x, -y) * 180 / Math.PI);
  }

  function animateTo(target) {
    cancelAnimationFrame(anim);
    let diff = norm(target - angle);
    if (diff > 180) diff -= 360;
    const from = angle, t0 = performance.now(), dur = 700;
    const step = t => {
      const p = Math.min((t - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      angle = norm(from + diff * e);
      render();
      if (p < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  let dragging = false;
  dial.addEventListener("pointerdown", e => {
    if (e.target.classList.contains("dial-label")) return;
    dragging = true;
    dial.classList.add("dragging");
    dial.setPointerCapture(e.pointerId);
    cancelAnimationFrame(anim);
    angle = pointerAngle(e); render();
  });
  dial.addEventListener("pointermove", e => { if (dragging) { angle = pointerAngle(e); render(); } });
  const end = () => { dragging = false; dial.classList.remove("dragging"); };
  dial.addEventListener("pointerup", end);
  dial.addEventListener("pointercancel", end);

  labels.forEach(l => l.addEventListener("click", () => animateTo(+l.dataset.s * 90)));

  dial.addEventListener("keydown", e => {
    if (["ArrowRight", "ArrowUp"].includes(e.key)) { e.preventDefault(); animateTo(angle + 30); }
    if (["ArrowLeft", "ArrowDown"].includes(e.key)) { e.preventDefault(); animateTo(angle - 30); }
  });

  render();
})();
