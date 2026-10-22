// Visuels « vitrine » pour la fiche Google Business Profile de Lullin Web.
// Même système graphique que le film : symbole officiel, couleurs et polices du site, courbes de niveau.
// Chaque visuel est choisi par ?img=<id> ; la page signale window.__ready quand le rendu est prêt.
import { h } from '../src/engine/dom.js';
import { loadLogo, logoSVG, wordmark } from '../src/components/BrandLogo.js';
import { contourField } from '../src/components/AnimatedGrid.js';
import { buildSite, SITE_W } from '../src/components/SiteMock.js';
import { arrowSVG, cartSVG, searchSVG, playSVG, heartSVG, sendSVG, menuSVG, lockCorners } from '../src/components/UIComponents.js';

const LOCATION = 'Six-Fours-les-Plages · Toulon · Var';

// Formats exportés (px CSS ; rendu ×2) : logo carré, couverture 16:9, visuels 4:3.
export const IMAGES = {
  logo: { w: 540, h: 540 },
  couverture: { w: 1024, h: 576 },
  'sites-vitrines': { w: 800, h: 600 },
  'boutiques-en-ligne': { w: 800, h: 600 },
  refonte: { w: 800, h: 600 },
  maintenance: { w: 800, h: 600 },
  seo: { w: 800, h: 600 },
  'reseaux-sociaux': { w: 800, h: 600 },
  'photo-video': { w: 800, h: 600 },
  automatisations: { w: 800, h: 600 },
  devis: { w: 800, h: 600 },
};

const at = (el, x, y, style = {}) => { Object.assign(el.style, { position: 'absolute', left: `${x}px`, top: `${y}px`, ...style }); return el; };
const div = (cls, style = {}, ...c) => { const d = h('div', cls ? { class: cls } : {}, ...c); Object.assign(d.style, style); return d; };
const checkIcon = (size = 26) => div('check', { width: `${size}px`, height: `${size}px` },
  h('svg', { viewBox: '0 0 24 24', width: size * 0.62, height: size * 0.62, fill: 'none', stroke: '#111211', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, h('path', { d: 'M5 12.5 L10 17 L19 7.5' })));

function background(root, w, hh, { seed = 5, glow = [0.72, 0.5], opacity = 0.32 } = {}) {
  root.append(at(div('', { width: `${w}px`, height: `${hh}px`, opacity }), 0, 0));
  root.lastChild.append(contourField(w, hh, { seed, cell: 10, scale: 260, opacity: 1, width: 1 }));
  root.append(at(div('', { width: `${w * 1.1}px`, height: `${w * 1.1}px`, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(194,249,58,0.13), rgba(194,249,58,0.04) 50%, rgba(194,249,58,0) 100%)' }), w * glow[0] - w * 0.55, hh * glow[1] - w * 0.55));
}

function lockup(markSize = 34, wmSize = 26) {
  const l = div('', { display: 'flex', alignItems: 'center', gap: `${markSize * 0.28}px` }, logoSVG(markSize * 1237 / 918), wordmark(wmSize));
  l.firstChild.style.margin = `${-(markSize * 1237 / 918 - markSize) / 2}px`;
  return l;
}

/** Gabarit commun des visuels de service : intitulé, titre, phrase, signature. */
function serviceFrame(root, { index, title, text }) {
  background(root, 800, 600, { seed: 5 + index });
  root.append(at(div('k', {}, `${String(index).padStart(2, '0')} — Lullin Web`), 48, 46));
  const t = at(div('t', { width: '336px' }), 46, 74); t.innerHTML = title; root.append(t);
  // Un mot long (« Référencement », « Automatisations ») ne doit pas déborder sur le visuel.
  const probe = div('t', { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap' }); root.append(probe);
  const widest = Math.max(...t.textContent.split(/\s+/).map((w) => { probe.textContent = w; return probe.offsetWidth; }));
  probe.remove();
  if (widest > 330) t.style.fontSize = `${(52 * 330 / widest).toFixed(1)}px`;
  root.append(at(div('s', { width: '320px' }, text), 48, 204));
  root.append(at(lockup(30, 24), 48, 520));
  root.append(at(div('', { font: '500 15px var(--body)', color: 'var(--muted)', letterSpacing: '0.02em' }, `lullin-web.com · ${LOCATION}`), 48, 558));
  const stage = at(div('', { width: '380px', height: '470px' }), 392, 64);
  root.append(stage);
  return stage;
}

// ---------- éléments d'interface réutilisés
function browser(w, hh, content, { url = 'lullin-web.com', light = false } = {}) {
  const f = div('card shadow', { width: `${w}px`, height: `${hh}px`, borderRadius: '14px', background: light ? '#e9e7df' : '#111211', borderColor: light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.14)' });
  const bar = at(div('', { width: '100%', height: '22px', background: light ? '#d9d7ce' : '#181a17', borderBottom: `1px solid ${light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}` }), 0, 0);
  [0, 1, 2].forEach((k) => bar.append(at(div('', { width: '7px', height: '7px', borderRadius: '50%', background: light ? 'rgba(0,0,0,0.2)' : 'rgba(240,240,232,0.25)' }), 10 + k * 11, 7.5)));
  bar.append(at(div('', { width: '120px', height: '12px', borderRadius: '6px', background: light ? 'rgba(0,0,0,0.08)' : 'rgba(240,240,232,0.07)', font: '500 7px/12px var(--body)', color: light ? '#6b6b66' : 'var(--muted)', textAlign: 'center' }, url), w / 2 - 60, 5));
  f.append(bar);
  const view = at(div('', { width: `${w}px`, height: `${hh - 22}px`, overflow: 'hidden' }), 0, 22);
  view.append(content); f.append(view);
  return f;
}

function desktopSite(width) {
  const s = buildSite();
  const k = width / SITE_W;
  Object.assign(s.page.style, { transform: `scale(${k})`, transformOrigin: '0 0', position: 'absolute', left: 0, top: 0 });
  return s.page;
}

/** Version mobile de la page d'accueil (reconstruction, base 390 px de large). */
function mobileSite(width) {
  const k = width / 390;
  const p = div('', { position: 'absolute', left: 0, top: 0, width: '390px', height: '844px', background: '#111211', transform: `scale(${k})`, transformOrigin: '0 0', overflow: 'hidden' });
  p.append(at(div('', { opacity: 0.9 }), 0, 0)); p.lastChild.append(contourField(390, 844, { seed: 5, cell: 12, scale: 200 }));
  const c = at(div('', { width: '390px', height: '844px' }), 0, 40); p.append(c); // sous la barre d'état / l'encoche
  const add = (el) => c.append(el);
  add(at(lockup(30, 25), 20, 24));
  add(at(div('', { width: '42px', height: '42px', borderRadius: '50%', border: '1.5px solid rgba(240,240,232,0.45)', display: 'grid', placeItems: 'center', color: 'var(--paper)' }, menuSVG(20)), 328, 18));
  add(at(div('', { width: '390px', height: '1px', background: 'rgba(255,255,255,0.1)' }), 0, 76));
  add(at(div('row', { gap: '8px', font: '500 9px var(--body)', letterSpacing: '0.12em', color: '#e6e5dc', whiteSpace: 'nowrap' }, div('', { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }), 'CRÉATION DE SITES INTERNET SUR MESURE'), 20, 104));
  add(at(div('', { font: '500 46px/1.02 var(--heading)', letterSpacing: '-0.075em', color: 'var(--paper)', whiteSpace: 'nowrap' }, h('div', {}, 'Votre site'), h('div', {}, 'professionnel,'), h('div', { style: { color: 'var(--accent)' } }, 'simplement.')), 18, 128));
  add(at(div('', { width: '350px', font: '400 15px/23px var(--body)', color: '#c5cbb9' }, 'Un site moderne, rapide et adapté à votre activité, sans devoir investir plusieurs milliers d’euros.'), 20, 296));
  const cta = at(div('', { width: '350px', height: '52px', borderRadius: '26px', background: 'var(--accent)', font: '600 15px/52px var(--body)', color: '#111211', paddingLeft: '22px' }, 'Demander un devis'), 20, 370);
  cta.append(at(div('', { width: '42px', height: '42px', borderRadius: '50%', background: '#111211', display: 'grid', placeItems: 'center' }, arrowSVG(16, 'var(--accent)', 2.4)), 303, 5));
  add(cta);
  add(at(div('', { width: '360px', height: '360px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(194,249,58,0.16), rgba(194,249,58,0))' }), 15, 455));
  add(at(logoSVG(240), 75, 515));
  return p;
}

function phone(w, content) {
  const hh = w * 2.05;
  const f = div('card shadow', { width: `${w}px`, height: `${hh}px`, borderRadius: `${w * 0.14}px`, background: '#111211', border: '2px solid rgba(240,240,232,0.22)' });
  const view = at(div('', { width: `${w}px`, height: `${hh}px`, overflow: 'hidden', borderRadius: `${w * 0.13}px` }), 0, 0);
  view.append(content); f.append(view);
  f.append(at(div('', { width: `${w * 0.3}px`, height: `${w * 0.075}px`, borderRadius: '99px', background: '#000' }), w * 0.35, w * 0.035));
  return f;
}

function productCard(w, { vase = true, tone = 0 } = {}) {
  const hh = w * 1.42;
  const c = div('card shadow', { width: `${w}px`, height: `${hh}px`, borderRadius: `${w * 0.07}px`, background: '#1d201b' });
  const img = at(div('', { width: `${w - 20}px`, height: `${w * 0.82}px`, borderRadius: `${w * 0.05}px`, background: ['radial-gradient(120% 90% at 50% 20%, #2f3529 0%, #1a1d18 70%)', 'radial-gradient(120% 90% at 50% 20%, #34392c 0%, #1b1e19 70%)', 'radial-gradient(120% 90% at 50% 20%, #2b3128 0%, #191c17 70%)'][tone] }), 10, 10);
  const iw = w - 20, ih = w * 0.82;
  const shape = vase
    ? h('path', { d: `M${iw * 0.42} ${ih * 0.18} H${iw * 0.58} V${ih * 0.26} C${iw * 0.58} ${ih * 0.32} ${iw * 0.72} ${ih * 0.4} ${iw * 0.72} ${ih * 0.6} C${iw * 0.72} ${ih * 0.8} ${iw * 0.62} ${ih * 0.88} ${iw * 0.5} ${ih * 0.88} C${iw * 0.38} ${ih * 0.88} ${iw * 0.28} ${ih * 0.8} ${iw * 0.28} ${ih * 0.6} C${iw * 0.28} ${ih * 0.4} ${iw * 0.42} ${ih * 0.32} ${iw * 0.42} ${ih * 0.26} Z`, fill: 'var(--cream)' })
    : h('rect', { x: iw * 0.3, y: ih * 0.28, width: iw * 0.4, height: ih * 0.52, rx: iw * 0.06, fill: tone === 1 ? 'var(--accent)' : 'var(--cream)' });
  img.append(h('svg', { viewBox: `0 0 ${iw} ${ih}`, width: iw, height: ih, style: { position: 'absolute', left: 0, top: 0 } }, h('ellipse', { cx: iw / 2, cy: ih * 0.9, rx: iw * 0.25, ry: ih * 0.035, fill: 'rgba(0,0,0,0.35)' }), shape));
  c.append(img);
  c.append(at(div('', { width: `${w * 0.55}px`, height: `${w * 0.05}px`, borderRadius: '4px', background: 'rgba(240,240,232,0.85)' }), 14, w * 0.92 + 4));
  c.append(at(div('', { width: `${w * 0.35}px`, height: `${w * 0.04}px`, borderRadius: '4px', background: 'rgba(240,240,232,0.28)' }), 14, w * 1.0 + 4));
  c.append(at(div('', { width: `${w * 0.18}px`, height: `${w * 0.05}px`, borderRadius: '4px', background: 'var(--accent)' }), w - 14 - w * 0.18, w * 0.92 + 4));
  return c;
}

function socialCard(w, kind, liked = false) {
  const hh = w * 1.78;
  const c = div('card shadow', { width: `${w}px`, height: `${hh}px`, borderRadius: `${w * 0.08}px`, background: '#1d201b' });
  const m = at(div('', { width: `${w}px`, height: `${hh * 0.72}px`, background: kind === 'photo' ? 'linear-gradient(160deg,#323a2a,#1b1e18)' : 'radial-gradient(90% 70% at 30% 30%,#3a4330,#1b1e18)' }), 0, 0);
  if (kind === 'video') m.append(at(div('', { width: `${w * 0.28}px`, height: `${w * 0.28}px`, borderRadius: '50%', background: 'rgba(17,18,17,0.7)', display: 'grid', placeItems: 'center' }, playSVG(w * 0.13, 'var(--accent)')), w * 0.36, hh * 0.36 - w * 0.14));
  if (kind === 'photo') m.append(h('svg', { viewBox: '0 0 100 128', width: w, height: hh * 0.72, preserveAspectRatio: 'none', style: { position: 'absolute', left: 0, top: 0 } }, h('path', { d: 'M0 104 L30 70 L52 92 L70 74 L100 104 V128 H0 Z', fill: 'rgba(240,240,232,0.16)' }), h('circle', { cx: 74, cy: 34, r: 9, fill: 'rgba(210,253,121,0.6)' })));
  if (kind === 'post') { [0.82, 0.64, 0.42].forEach((ww, i) => m.append(at(div('', { width: `${w * ww * 0.8}px`, height: `${w * 0.07}px`, borderRadius: '5px', background: i === 2 ? 'var(--accent)' : 'rgba(240,240,232,0.85)' }), w * 0.1, hh * 0.25 + i * w * 0.12))); }
  c.append(m);
  const row = at(div('row', { gap: `${w * 0.06}px`, color: 'var(--paper)' }, heartSVG(w * 0.12, liked ? 'var(--lime)' : 'currentColor'), sendSVG(w * 0.12)), w * 0.07, hh * 0.75);
  c.append(row);
  c.append(at(div('', { width: `${w * 0.62}px`, height: `${w * 0.045}px`, borderRadius: '4px', background: 'rgba(240,240,232,0.45)' }), w * 0.07, hh * 0.87));
  c.append(at(div('', { width: `${w * 0.42}px`, height: `${w * 0.04}px`, borderRadius: '4px', background: 'rgba(240,240,232,0.2)' }), w * 0.07, hh * 0.92));
  return c;
}

// ---------- compositions
const BUILD = {
  logo(root) {
    root.append(at(div('', { width: '540px', height: '540px', background: 'radial-gradient(closest-side, rgba(194,249,58,0.12), rgba(194,249,58,0) 100%)' }), 0, 0));
    // Symbole dans un cercle de 70 % : reste entier si Google recadre le logo en rond.
    const k = 300 / 918; // 300 px de largeur visible ; centre visuel du tracé ≈ (606, 547) dans la viewBox 1237
    root.append(at(logoSVG(1237 * k), 270 - 606 * k, 270 - 547 * k));
  },

  couverture(root) {
    background(root, 1024, 576, { seed: 5, glow: [0.72, 0.52], opacity: 0.4 });
    root.append(at(div('k', { color: '#c5cbb9' }, 'Agence web · Six-Fours-les-Plages · Toulon'), 56, 64));
    const t = at(div('t', { fontSize: '60px', width: '480px', fontWeight: 500, letterSpacing: '-0.07em', lineHeight: '1.02' }), 54, 96);
    t.innerHTML = 'Votre site<br>professionnel,<br><em>simplement.</em>';
    root.append(t);
    root.append(at(div('s', { width: '400px', fontSize: '17px' }, 'Création de sites internet, référencement, réseaux sociaux et solutions digitales pour les professionnels du Var.'), 56, 306));
    const cta = at(div('pill', { background: 'var(--accent)', color: '#111211', font: '600 15px var(--body)', padding: '10px 10px 10px 22px' }, 'lullin-web.com', div('', { width: '30px', height: '30px', borderRadius: '50%', background: '#111211', display: 'grid', placeItems: 'center' }, arrowSVG(14, 'var(--accent)', 2.4))), 56, 412);
    root.append(cta);
    root.append(at(lockup(30, 24), 56, 500));
    root.append(at(browser(430, 300, desktopSite(430)), 530, 110));
    root.append(at(phone(124, mobileSite(124)), 880, 236));
  },

  'sites-vitrines'(root) {
    const s = serviceFrame(root, { index: 1, title: 'Création de sites <em>vitrines</em>', text: 'Un site clair, moderne et adapté à mobile, qui présente votre activité.' });
    s.append(at(browser(372, 262, desktopSite(372)), 4, 40));
    s.append(at(phone(112, mobileSite(112)), 262, 196));
  },

  'boutiques-en-ligne'(root) {
    const s = serviceFrame(root, { index: 2, title: 'Boutiques <em>en ligne</em>', text: 'Catalogue, panier et paiement en ligne pour vendre vos produits.' });
    const b1 = at(productCard(150, { vase: false, tone: 2 }), 6, 70, { transform: 'rotate(-6deg)', opacity: 0.85 }); s.append(b1);
    const b2 = at(productCard(150, { vase: false, tone: 1 }), 226, 70, { transform: 'rotate(6deg)', opacity: 0.85 }); s.append(b2);
    const main = at(productCard(196, { vase: true }), 92, 40); s.append(main);
    const btn = at(div('pill', { background: 'var(--accent)', color: '#111211', font: '600 15px var(--body)', padding: '12px 20px', justifyContent: 'center', width: '176px' }, cartSVG(18, '#111211'), 'Ajouter au panier'), 10, 228);
    main.append(btn);
    const cart = at(div('', { width: '62px', height: '62px', borderRadius: '50%', border: '2px solid var(--lime)', background: '#151714', display: 'grid', placeItems: 'center', color: 'var(--paper)' }, cartSVG(30, 'var(--paper)')), 300, 6);
    cart.append(at(div('', { width: '24px', height: '24px', borderRadius: '50%', background: 'var(--lime)', color: '#111211', font: '700 14px/24px var(--body)', textAlign: 'center' }, '1'), 42, -4));
    s.append(cart);
  },

  refonte(root) {
    const s = serviceFrame(root, { index: 3, title: 'Refonte de <em>site</em>', text: 'On modernise un site existant : design, contenu, mobile et référencement.' });
    const old = div('', { position: 'absolute', inset: 0, background: '#e9e7df' });
    old.append(at(div('', { width: '100%', height: '30px', background: '#5c6b7a' }), 0, 0));
    [0, 1, 2, 3].forEach((k) => old.append(at(div('', { width: '40px', height: '6px', background: '#d9dee3' }), 120 + k * 50, 12)));
    old.append(at(div('', { width: '140px', height: '100px', background: '#c9c6bb' }), 14, 44));
    [0, 1, 2, 3, 4].forEach((k) => old.append(at(div('', { width: `${140 - k * 12}px`, height: '6px', background: '#a9a69c' }), 166, 50 + k * 14)));
    old.append(at(div('', { width: '70px', height: '20px', background: '#5c6b7a' }), 166, 128));
    s.append(at(browser(250, 180, old, { url: 'ancien site', light: true }), 0, 34, { transform: 'rotate(-4deg)', opacity: 0.9 }));
    s.append(at(div('pill', { background: 'rgba(240,240,232,0.12)', color: '#d0d3c8', font: '600 12px var(--body)', padding: '6px 12px', letterSpacing: '0.08em' }, 'AVANT'), 12, 6));
    const arrow = at(div('', { width: '56px', height: '56px', borderRadius: '50%', background: 'var(--lime)', display: 'grid', placeItems: 'center', zIndex: 3 }, arrowSVG(26, '#111211', 2.6)), 196, 196);
    s.append(at(browser(330, 230, desktopSite(330)), 50, 236));
    s.append(arrow);
    s.append(at(div('pill', { background: 'var(--accent)', color: '#111211', font: '600 12px var(--body)', padding: '6px 12px', letterSpacing: '0.08em' }, 'APRÈS'), 290, 210));
  },

  maintenance(root) {
    const s = serviceFrame(root, { index: 4, title: 'Maintenance <em>&amp; gestion</em>', text: 'Mises à jour, sauvegardes et modifications de votre site, sans vous en occuper.' });
    const panel = at(div('card shadow', { width: '360px', height: '400px', borderRadius: '22px' }), 10, 34);
    panel.append(at(div('row', { gap: '10px' }, div('', { width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(210,253,121,0.14)', display: 'grid', placeItems: 'center' }, h('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-linecap': 'round' }, h('path', { d: 'M12 3 L19 6 V11 C19 15.5 16 19 12 21 C8 19 5 15.5 5 11 V6 Z' }))),
      div('', { font: '600 18px var(--heading)', letterSpacing: '-0.03em', color: 'var(--paper)' }, 'Suivi de votre site')), 22, 22));
    panel.append(at(div('', { width: '316px', height: '1px', background: 'rgba(255,255,255,0.08)' }), 22, 74));
    ['Mises à jour', 'Sauvegardes', 'Sécurité', 'Modifications de contenu', 'Vérification sur mobile'].forEach((label, i) => {
      const r = at(div('row', { width: '316px', height: '50px', padding: '0 14px', borderRadius: '14px', background: '#20231e', border: '1px solid rgba(255,255,255,0.06)', font: '500 15px var(--body)', color: 'var(--paper)', justifyContent: 'space-between' }, label, checkIcon(24)), 22, 92 + i * 60);
      panel.append(r);
    });
    s.append(panel);
  },

  seo(root) {
    const s = serviceFrame(root, { index: 5, title: 'Référencement <em>SEO</em>', text: 'Optimisation technique, contenus et référencement local pour être trouvé sur Google.' });
    const bar = at(div('row', { width: '370px', height: '56px', borderRadius: '28px', border: '2px solid rgba(240,240,232,0.55)', background: '#1a1c19', padding: '0 18px', font: '500 17px var(--body)', color: 'var(--paper)' }, searchSVG(24, 'var(--accent)', 2.4), 'création site internet var', div('', { width: '2px', height: '22px', background: 'var(--accent)' })), 4, 30);
    s.append(bar);
    [0, 1, 2].forEach((k) => {
      const hi = k === 0;
      const r = at(div('card', { width: '370px', height: '74px', borderRadius: '16px', background: '#1d201b', borderColor: hi ? 'var(--lime)' : 'rgba(255,255,255,0.08)', borderWidth: hi ? '2px' : '1.5px' }), 4, 108 + k * 88);
      r.append(at(div('', { width: '34px', height: '34px', borderRadius: '50%', background: hi ? 'var(--accent)' : 'rgba(240,240,232,0.2)' }), 16, 20));
      r.append(at(div('', { width: `${[200, 170, 220][k]}px`, height: '11px', borderRadius: '5px', background: hi ? 'rgba(240,240,232,0.92)' : 'rgba(240,240,232,0.45)' }), 64, 22));
      r.append(at(div('', { width: `${[140, 190, 150][k]}px`, height: '9px', borderRadius: '5px', background: hi ? 'rgba(210,253,121,0.7)' : 'rgba(240,240,232,0.18)' }), 64, 44));
      s.append(r);
    });
    const pin = at(div('', { width: '0px', height: '0px' }), 300, 400);
    [140, 96, 52].forEach((d, i) => pin.append(at(div('', { width: `${d}px`, height: `${d}px`, borderRadius: '50%', border: `2px solid rgba(194,249,58,${0.25 + i * 0.25})` }), -d / 2, -d / 2)));
    pin.append(at(h('svg', { viewBox: '0 0 24 24', width: 52, height: 52 }, h('path', { d: 'M12 22 C7 16.5 4.5 12.8 4.5 9.6 A7.5 7.5 0 0 1 19.5 9.6 C19.5 12.8 17 16.5 12 22 Z', fill: 'var(--lime)' }), h('circle', { cx: 12, cy: 9.6, r: 2.8, fill: '#111211' })), -26, -50));
    s.append(pin);
    s.append(at(div('', { font: '500 13px var(--body)', color: 'var(--muted)', letterSpacing: '0.04em' }, 'Exemple de recherche locale'), 4, 380));
  },

  'reseaux-sociaux'(root) {
    const s = serviceFrame(root, { index: 6, title: 'Réseaux <em>sociaux</em>', text: 'Création de publications, de vidéos courtes et gestion de vos comptes.' });
    s.append(at(socialCard(140, 'photo'), 10, 92, { transform: 'rotate(-9deg)' }));
    s.append(at(socialCard(140, 'post'), 230, 92, { transform: 'rotate(9deg)' }));
    s.append(at(socialCard(160, 'video', true), 110, 40));
  },

  'photo-video'(root) {
    const s = serviceFrame(root, { index: 7, title: 'Photo <em>&amp; vidéo</em>', text: 'Photos et vidéos professionnelles de votre activité, pour votre site et vos réseaux.' });
    const vf = at(div('card shadow', { width: '370px', height: '270px', borderRadius: '20px', background: 'linear-gradient(165deg,#3a4330 0%,#262b22 55%,#1b1e18 100%)' }), 4, 30);
    vf.append(h('svg', { viewBox: '0 0 370 270', width: 370, height: 270, style: { position: 'absolute', left: 0, top: 0 } },
      h('path', { d: 'M0 210 L90 130 L150 180 L215 120 L370 230 V270 H0 Z', fill: 'rgba(240,240,232,0.14)' }),
      h('path', { d: 'M0 240 L120 190 L230 230 L370 200 V270 H0 Z', fill: 'rgba(17,18,17,0.35)' }),
      h('circle', { cx: 285, cy: 70, r: 26, fill: 'rgba(210,253,121,0.55)' }),
      h('path', { d: 'M123.3 0 V270 M246.6 0 V270 M0 90 H370 M0 180 H370', stroke: 'rgba(240,240,232,0.18)', 'stroke-width': 1 })));
    const corners = at(div('', { width: '120px', height: '90px' }), 125, 90); corners.append(lockCorners(120, 90, 18, 3)); vf.append(corners);
    vf.append(at(div('row', { gap: '6px', font: '600 12px var(--body)', color: 'var(--paper)', letterSpacing: '0.08em' }, div('', { width: '9px', height: '9px', borderRadius: '50%', background: 'var(--lime)' }), 'REC'), 16, 14));
    s.append(vf);
    const strip = at(div('card', { width: '370px', height: '96px', borderRadius: '16px' }), 4, 322);
    strip.append(at(div('', { width: '44px', height: '44px', borderRadius: '50%', background: 'var(--accent)', display: 'grid', placeItems: 'center' }, playSVG(22, '#111211')), 14, 26));
    [0, 1, 2, 3, 4].forEach((k) => strip.append(at(div('', { width: '52px', height: '52px', borderRadius: '9px', background: ['#2f3529', '#3a4330', '#262b22', '#34392c', '#2b3128'][k], border: k === 2 ? '2px solid var(--lime)' : '1px solid rgba(255,255,255,0.06)' }), 74 + k * 58, 22)));
    s.append(strip);
  },

  automatisations(root) {
    const s = serviceFrame(root, { index: 8, title: 'Automatisations <em>&amp; IA</em>', text: 'Formulaires, e-mails, relances et outils connectés pour gagner du temps au quotidien.' });
    const node = (label, sub, x, y, hi = false) => {
      const n = at(div('card shadow', { width: '240px', height: '70px', borderRadius: '16px', background: hi ? '#22261e' : '#1d201b', borderColor: hi ? 'var(--lime)' : 'rgba(255,255,255,0.1)', borderWidth: hi ? '2px' : '1.5px' }), x, y);
      n.append(at(div('', { width: '34px', height: '34px', borderRadius: '10px', background: hi ? 'var(--accent)' : 'rgba(240,240,232,0.12)' }), 16, 18));
      n.append(at(div('', { font: '600 15px var(--heading)', letterSpacing: '-0.02em', color: 'var(--paper)', whiteSpace: 'nowrap' }, label), 62, 16));
      n.append(at(div('', { font: '400 12px var(--body)', color: 'var(--muted)', whiteSpace: 'nowrap' }, sub), 62, 38));
      return n;
    };
    const pts = [[10, 20], [130, 128], [10, 236], [130, 344]];
    const svg = h('svg', { viewBox: '0 0 380 470', width: 380, height: 470, style: { position: 'absolute', left: 0, top: 0 } });
    for (let i = 0; i < 3; i++) {
      const [x1, y1] = [pts[i][0] + 120, pts[i][1] + 70], [x2, y2] = [pts[i + 1][0] + 120, pts[i + 1][1]];
      svg.append(h('path', { d: `M${x1} ${y1} C${x1} ${y1 + 30} ${x2} ${y2 - 30} ${x2} ${y2}`, fill: 'none', stroke: 'var(--lime)', 'stroke-width': 2.5, 'stroke-dasharray': '6 6' }));
      svg.append(h('circle', { cx: x2, cy: y2, r: 5, fill: 'var(--lime)' }));
    }
    s.append(svg);
    s.append(node('Nouveau contact', 'Formulaire du site', ...pts[0]));
    s.append(node('E-mail de confirmation', 'Envoyé automatiquement', ...pts[1], true));
    s.append(node('Relance programmée', 'Si pas de réponse', ...pts[2]));
    s.append(node('Tableau de suivi', 'Tout au même endroit', ...pts[3]));
  },

  devis(root) {
    background(root, 800, 600, { seed: 9, glow: [0.5, 0.36], opacity: 0.35 });
    root.append(at(logoSVG(150 * 1237 / 918), 400 - 75 * 1237 / 918, 150 - 75 * 1237 / 918));
    const t = at(div('t', { width: '800px', textAlign: 'center', fontSize: '54px', fontWeight: 500, letterSpacing: '-0.07em', lineHeight: '1.04' }), 0, 262);
    t.innerHTML = 'Votre site professionnel,<br><em>simplement.</em>';
    root.append(t);
    const cta = div('pill', { background: 'var(--accent)', color: '#111211', font: '600 19px var(--body)', padding: '12px 12px 12px 28px' }, 'Demander un devis', div('', { width: '40px', height: '40px', borderRadius: '50%', background: '#111211', display: 'grid', placeItems: 'center' }, arrowSVG(18, 'var(--accent)', 2.4)));
    root.append(at(div('', { width: '800px', display: 'flex', justifyContent: 'center' }, cta), 0, 410));
    root.append(at(div('', { width: '800px', textAlign: 'center', font: '600 22px var(--heading)', letterSpacing: '-0.03em', color: 'var(--paper)' }, 'lullin-web.com'), 0, 500));
    root.append(at(div('k', { width: '800px', textAlign: 'center', color: '#a4a79d' }, LOCATION), 0, 538));
  },
};

async function boot() {
  const faces = ['400', '500', '600', '700'].flatMap((w) => [`${w} 100px "Space Grotesk"`, `${w} 100px "DM Sans"`]);
  await Promise.all(faces.map((f) => document.fonts.load(f, 'AÉÀazé.,•&’')));
  await loadLogo();
  const id = new URLSearchParams(location.search).get('img') || 'logo';
  const { w, h: hh } = IMAGES[id];
  const root = document.getElementById('canvas');
  Object.assign(root.style, { width: `${w}px`, height: `${hh}px` });
  BUILD[id](root);
  await document.fonts.ready;
  window.__size = { w, h: hh };
  window.__ready = true;
}
window.__images = Object.keys(IMAGES);
boot().catch((e) => { window.__error = String(e && e.stack || e); });
