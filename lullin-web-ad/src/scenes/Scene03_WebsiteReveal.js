import { h, css, tr3 } from '../engine/dom.js';
import { E, prog, kf, lerp, clamp } from '../engine/ease.js';
import { b } from '../engine/time.js';
import { Scene, cue } from '../components/TransitionController.js';
import { MotionCamera } from '../components/MotionCamera.js';
import { Headline } from '../components/TypographySystem.js';
import { buildSite, SITE_MARK, SITE_W, SITE_H } from '../components/SiteMock.js';
import { columnGrid } from '../components/AnimatedGrid.js';

// SCÈNE 03 — RÉVÉLATION DU SITE (10 → 18 temps, 4,67 → 8,4 s)
// On sort de la carte image : c'est le héros de lullin-web.com. La caméra recule et bascule, la page devient une surface
// survolée. DESIGN : la page se décompose en calques + repères de mise en page. PERFORMANCE : saut de section instantané.
// VISIBILITÉ : éléments SEO symboliques. Puis la page redevient une carte frontale qui va se diviser en modules.

const START = b(10), END = b(18);
const P = 1600;
const Z0 = P / (670 / SITE_MARK.size) - P; // raccord exact avec la fin de la scène 2 (symbole à 670 px)
const D = b(11), PF = b(13), V = b(15);
const ANCHOR = { x: 720, y: 450 }; // centre du héros = pivot des rotations caméra
const MX = SITE_MARK.x - ANCHOR.x, MY = SITE_MARK.y - ANCHOR.y; // décalage caméra pour cadrer le symbole au départ
export const CARD = { w: 900, h: 1125, cx: 540, cy: 1000 }; // carte finale (reprise par la scène 4)

export class Scene03_WebsiteReveal extends Scene {
  constructor(stage, ctx) {
    super(stage, 'Scene03_WebsiteReveal', { pre: 0, post: 0.02, z: 8 });
    this.cam = new MotionCamera(this.root, { perspective: P });
    const site = buildSite();
    this.site = site;
    this.page = site.page;
    this.cam.world.append(this.page);
    this.L = site.layers;

    // Repères de mise en page (DESIGN)
    this.grid = columnGrid(89, 0, 1262, 900, 12, 24);
    this.grid.style.opacity = 0;
    this.L.bg.append(this.grid);
    const sel = (layer, x, y, w, hh, tag) => {
      const el = h('div', { class: 'abs', style: { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px`, border: '2.5px solid var(--lime)', opacity: 0 } });
      for (const [l, t] of [[0, 0], [1, 0], [0, 1], [1, 1]]) el.append(h('div', { class: 'abs', style: { left: `${l * w - 7}px`, top: `${t * hh - 7}px`, width: '14px', height: '14px', background: '#111211', border: '2.5px solid var(--lime)' } }));
      el.append(h('div', { class: 'abs', style: { left: '-2px', top: '-40px', padding: '6px 12px', background: 'var(--lime)', color: '#111211', font: '600 18px var(--body)', borderRadius: '6px', whiteSpace: 'nowrap' } }, tag));
      layer.append(el);
      return el;
    };
    this.sels = [sel(this.L.title, 80, 226, 720, 360, 'Titre · 112 px'), sel(this.L.cta, 370, 628, 240, 74, 'Bouton'), sel(this.L.visual, 990, 340, 320, 320, 'Logo')];

    // Barre de chargement (PERFORMANCE)
    this.loadBar = h('div', { class: 'abs', style: { left: 0, top: '0px', width: `${SITE_W}px`, height: '8px', background: 'var(--lime)', transformOrigin: '0 50%', opacity: 0 } });
    this.L.header.append(this.loadBar);

    // Éléments SEO symboliques (VISIBILITÉ) : vocabulaire repris des pages du site.
    this.chips = ['Métadonnées', 'Référencement local', 'Maillage interne', 'Performances techniques'].map((txt, i) => {
      const c = h('div', { class: 'node', style: { display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 30px 18px 18px', borderRadius: '999px', background: 'rgba(26,28,25,0.96)', border: '2px solid rgba(210,253,121,0.5)', font: '500 40px var(--body)', color: 'var(--paper)', whiteSpace: 'nowrap', transformOrigin: '0 100%' } },
        h('span', { style: { display: 'grid', placeItems: 'center', width: '50px', height: '50px', borderRadius: '50%', background: 'var(--lime)' } },
          h('svg', { viewBox: '0 0 24 24', width: 30, height: 30, fill: 'none', stroke: '#111211', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, h('path', { d: 'M5 12.5 L10 17 L19 7.5' }))),
        txt);
      this.page.append(c);
      return { el: c, x: [90, 640, 140, 520][i], y: [1180, 1290, 1520, 1630][i], t0: V + i * 0.075 };
    });
    // Repère de localisation
    this.pin = h('div', { class: 'node', style: { width: '0px', height: '0px' } });
    this.rings = [0, 1, 2].map(() => { const r = h('div', { class: 'abs', style: { borderRadius: '50%', border: '3px solid var(--lime)', opacity: 0 } }); this.pin.append(r); return r; });
    const pinIcon = h('svg', { viewBox: '0 0 24 24', width: 96, height: 96, style: { position: 'absolute', left: '-48px', top: '-92px' } },
      h('path', { d: 'M12 22 C7 16.5 4.5 12.8 4.5 9.6 A7.5 7.5 0 0 1 19.5 9.6 C19.5 12.8 17 16.5 12 22 Z', fill: 'var(--lime)' }), h('circle', { cx: 12, cy: 9.6, r: 2.8, fill: '#111211' }));
    this.pinIcon = pinIcon;
    this.pin.append(pinIcon);
    this.page.append(this.pin);

    // Carte finale (le contenu s'efface : la page devient l'interface centrale de la scène 4)
    this.endCard = h('div', { class: 'abs', style: { left: 0, top: 0, width: `${SITE_W}px`, height: `${SITE_H}px`, background: 'var(--surface)', border: '3px solid var(--line)', borderRadius: '56px', opacity: 0 } });
    this.page.append(this.endCard);

    // Brume de profondeur en haut (lisibilité des mots) + mots
    this.fog = h('div', { class: 'layer', style: { background: 'linear-gradient(180deg, #111211 0%, #111211 17%, rgba(17,18,17,0.85) 27%, rgba(17,18,17,0) 42%)' } });
    this.root.append(this.fog);
    this.words = [
      new Headline(this.root, { lines: [['DESIGN.']], size: 168, x: 540, y: 270, align: 'center', maxWidth: 920 }),
      new Headline(this.root, { lines: [['PERFORMANCE.']], size: 168, x: 540, y: 270, align: 'center', maxWidth: 920 }),
      new Headline(this.root, { lines: [[{ t: 'VISIBILITÉ.' }]], size: 168, x: 540, y: 270, align: 'center', maxWidth: 920 }),
    ];

    cue(START + 0.02, 'pullback', { dur: 0.7 });
    cue(D, 'word_hit'); cue(D + 0.05, 'layers_lift');
    this.sels.forEach((_, i) => cue(D + 0.2 + i * 0.09, 'tick', { pitch: i }));
    cue(PF - 0.07, 'zip'); cue(PF, 'word_hit'); cue(PF - 0.03, 'swish_fast');
    cue(V, 'word_hit'); this.chips.forEach((c, i) => cue(c.t0 + 0.06, 'pop', { pitch: i }));
    cue(V + 0.32, 'ping');
    cue(b(17) - 0.05, 'gate'); // court silence rythmique avant la scène 4
  }

  init() { this.words.forEach((w) => w.fit()); }

  render(t) {
    // Caméra : raccord frontal → recul + bascule (surface survolée) → retour frontal en carte.
    const fx = (cx) => cx - 540, fy = (cy) => cy - 960;
    const endZ = P / (CARD.w / SITE_W) - P;
    // « Défilement » = la caméra glisse le long de la page (saut de section instantané).
    const scroll = 780 * E.whip(prog(t, PF - 0.05, PF + 0.14)) * (1 - E.inOutCubic(prog(t, 7.62, 8.25)));
    const pageX = 540 - ANCHOR.x, pageY = 960 - ANCHOR.y;
    const k = CARD.w / SITE_W;
    const camEndX = pageX + SITE_W / 2 - 540 - (CARD.cx - 540) / k, camEndY = pageY + SITE_H / 2 - 960 - (CARD.cy - 960) / k;
    const rx = kf(t, [[START, 0], [5.3, 44, E.inOutCubic], [PF, 48, E.inOutQuad], [7.6, 46, E.inOutQuad], [8.25, 0, E.inOutCubic]]);
    const ry = kf(t, [[START, 0], [5.3, 7, E.inOutCubic], [PF, 11, E.inOutQuad], [7.6, 5, E.inOutQuad], [8.25, 0, E.inOutCubic]]);
    const rz = kf(t, [[START, 0], [5.3, -3, E.inOutCubic], [PF, -4, E.inOutQuad], [7.6, -2, E.inOutQuad], [8.25, 0, E.inOutCubic]]);
    const z = kf(t, [[START, Z0], [5.3, 330, E.inOutCubic], [PF, 270, E.inOutQuad], [7.6, 300, E.inOutQuad], [8.25, endZ, E.inOutCubic]]);
    const x = kf(t, [[START, MX], [5.3, 10, E.inOutCubic], [PF, -20, E.inOutQuad], [7.6, -10, E.inOutQuad], [8.25, camEndX, E.inOutCubic]]);
    const y = kf(t, [[START, MY], [5.3, -120, E.inOutCubic], [PF, -60, E.inOutQuad], [7.6, 20, E.inOutQuad], [8.25, camEndY - 780, E.inOutCubic]]) + scroll + 780 * E.inOutCubic(prog(t, 7.62, 8.25));
    this.cam.set({ x, y, z, rx, ry, rz });
    css(this.page, 'transform', tr3({ x: pageX, y: pageY }));

    // DESIGN : calques séparés en profondeur + repères
    const lift = E.outBack(prog(t, D, D + 0.5), 1.1) * (1 - E.inCubic(prog(t, PF - 0.22, PF - 0.06)));
    const Z = { header: 90, title: 210, cta: 150, visual: 300, foot: 50, section: 0, bg: 0 };
    for (const [k, el] of Object.entries(this.L)) css(el, 'transform', tr3({ z: Z[k] * lift }));
    css(this.grid, 'opacity', (0.55 * kf(t, [[D, 0], [D + 0.2, 1, E.outCubic], [PF - 0.25, 1], [PF - 0.08, 0]])).toFixed(3));
    this.sels.forEach((el, i) => {
      const p = E.outExpo(prog(t, D + 0.18 + i * 0.09, D + 0.4 + i * 0.09));
      css(el, 'opacity', (p * (1 - prog(t, PF - 0.2, PF - 0.08))).toFixed(3));
      css(el, 'transform', `scale(${lerp(1.12, 1, p).toFixed(4)})`);
    });

    // PERFORMANCE : barre de chargement éclair + saut de section
    const lb = prog(t, PF - 0.09, PF + 0.02);
    css(this.loadBar, 'transform', `scaleX(${E.outCubic(lb).toFixed(4)})`);
    css(this.loadBar, 'opacity', (lb > 0 ? 1 - prog(t, PF + 0.05, PF + 0.25) : 0).toFixed(3));
    this.site.cards.forEach((c, i) => {
      const p = t < PF - 0.2 ? 1 : E.outBack(prog(t, PF + 0.06 + i * 0.035, PF + 0.3 + i * 0.035));
      css(c, 'transform', `translateY(${lerp(40, 0, clamp(p)).toFixed(1)}px) scale(${lerp(0.92, 1, p).toFixed(4)})`);
      css(c, 'opacity', clamp(p * 1.4).toFixed(3));
      css(c, 'border-color', i === 1 && t > V + 0.1 ? `rgba(194,249,58,${(0.9 * E.outCubic(prog(t, V + 0.1, V + 0.3))).toFixed(3)})` : 'rgba(255,255,255,0.1)');
    });

    // VISIBILITÉ : pastilles SEO debout face caméra + repère local
    const out = E.inCubic(prog(t, 7.58, 7.85));
    this.chips.forEach((c) => {
      const p = E.outBack(prog(t, c.t0, c.t0 + 0.32), 1.3);
      const on = t >= c.t0;
      css(c.el, 'display', on ? 'flex' : 'none');
      if (!on) return;
      css(c.el, 'transform', tr3({ x: c.x, y: c.y, z: 60 + 200 * clamp(p) + out * 500, rx: -rx * 0.95, s: lerp(0.6, 1, p) }));
      css(c.el, 'opacity', (clamp(p * 2) * (1 - out)).toFixed(3));
    });
    const pinOn = t >= V + 0.22;
    css(this.pin, 'display', pinOn ? 'block' : 'none');
    if (pinOn) {
      const p = E.outBack(prog(t, V + 0.22, V + 0.5), 1.4);
      css(this.pin, 'transform', tr3({ x: 1120, y: 1110, z: 4 }));
      css(this.pinIcon, 'transform', `translateZ(0) rotateX(${(-rx * 0.9).toFixed(2)}deg) scale(${p.toFixed(4)})`);
      css(this.pinIcon, 'transform-origin', '48px 92px');
      css(this.pinIcon, 'opacity', (1 - out).toFixed(3));
      this.rings.forEach((r, i) => {
        const q = prog(t, V + 0.3 + i * 0.16, V + 0.95 + i * 0.16);
        const s = 40 + E.outCubic(q) * 360;
        css(r, 'width', `${s}px`); css(r, 'height', `${s}px`); css(r, 'left', `${-s / 2}px`); css(r, 'top', `${-s / 2}px`);
        css(r, 'opacity', (q > 0 && q < 1 ? (1 - q) * 0.9 : 0).toFixed(3));
      });
    }

    // Retour à une carte neutre (interface centrale)
    css(this.endCard, 'opacity', E.inOutQuad(prog(t, 7.85, 8.28)).toFixed(3));
    css(this.fog, 'opacity', (1 - E.inOutQuad(prog(t, 7.6, 8.0))).toFixed(3));

    // Mots
    const [wd, wp, wv] = this.words;
    const rise = (t0, t1) => 1 - E.outExpo(prog(t, t0, t1));
    const exit = (t0, t1) => -E.inQuart(prog(t, t0, t1));
    wd.word(0, { y: rise(D - 0.13, D + 0.02) + exit(PF - 0.13, PF - 0.04), s: lerp(1.15, 1, E.outExpo(prog(t, D - 0.13, D + 0.05))) });
    const pw = E.outQuart(prog(t, PF - 0.04, PF + 0.06));
    wp.word(0, { y: exit(V - 0.17, V - 0.08), x: lerp(-90, 0, pw) });
    css(wp.el, 'clip-path', `inset(-30% ${(100 - pw * 100).toFixed(2)}% -30% 0)`);
    wv.word(0, { y: rise(V - 0.08, V + 0.05) + exit(7.56, 7.68), s: lerp(1.15, 1, E.outExpo(prog(t, V - 0.08, V + 0.08))) });
  }
}
