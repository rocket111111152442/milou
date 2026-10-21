import { h, css, tr3 } from '../engine/dom.js';
import { E, prog, kf, lerp, clamp, rng, settle } from '../engine/ease.js';
import { b } from '../engine/time.js';
import { Scene, cue } from '../components/TransitionController.js';
import { MotionCamera } from '../components/MotionCamera.js';
import { columnGrid } from '../components/AnimatedGrid.js';
import { cartSVG, searchSVG, playSVG, heartSVG, sendSVG, cursorSVG, lockCorners, arrowSVG } from '../components/UIComponents.js';

// SCÈNE 04 — ÉCOSYSTÈME DIGITAL (18 → 27 temps, 8,4 → 12,6 s)
// La carte centrale se divise en 4 modules. La caméra visite chaque service (≈ 2 temps chacun),
// puis les modules pivotent autour de l'axe central, convergent et déclenchent un flash crème.

const START = b(18), END = b(27);
const P = 1600;
const MW = 870, MH = 1090, GAP = 60;
const GC = { x: 540, y: 1040 }; // centre de la grille (raccord : la carte de la scène 3 est centrée à y = 1000 à l'écran)
const CENTERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([i, j]) => ({ x: GC.x + i * (MW + GAP) / 2, y: GC.y + j * (MH + GAP) / 2 }));
const OVER = P / 0.5 - P; // vue d'ensemble : 2×2 modules = 900 × 1125 px
const NEAR = P / 0.95 - P;
const VISIT = [8.86, 9.80, 10.73, 11.66]; // arrivée de la caméra sur chaque module
const TITLES = [['SITES WEB'], ['E-COMMERCE'], ['SEO'], ['RÉSEAUX', 'SOCIAUX']];

const box = (parent, x, y, w, hh, style = {}, ...c) => {
  const d = h('div', { class: 'abs' }, ...c);
  Object.assign(d.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px`, ...style });
  parent.append(d); return d;
};

export class Scene04_Services extends Scene {
  constructor(stage, ctx) {
    super(stage, 'Scene04_Services', { pre: 0, post: 0, z: 7 });
    this.ctx = ctx;
    this.cam = new MotionCamera(this.root, { perspective: P });
    this.group = h('div', { class: 'node', style: { transformOrigin: `${GC.x}px ${GC.y}px`, width: '1080px', height: '1920px' } });
    this.cam.world.append(this.group);
    this.mods = CENTERS.map((c, i) => {
      const el = h('div', { class: 'node', style: { width: `${MW}px`, height: `${MH}px`, transformOrigin: '50% 50%' } });
      const card = box(el, 0, 0, MW, MH, { background: 'var(--surface)', border: '3px solid var(--line)', borderRadius: '44px', overflow: 'hidden' });
      const content = box(card, 0, 0, MW, MH, { opacity: 0 });
      box(content, 64, 70, 200, 40, { font: '500 30px var(--body)', letterSpacing: '0.18em', color: 'var(--accent)' }).textContent = `0${i + 1} / 04`;
      const title = box(content, 60, 118, 760, 220, { font: '700 100px/0.92 var(--heading)', letterSpacing: '-0.05em', color: 'var(--paper)', textTransform: 'uppercase', whiteSpace: 'nowrap' });
      TITLES[i].forEach((ln) => title.append(h('div', {}, ln)));
      const stageEl = box(content, 0, 0, MW, MH);
      const cream = box(card, 0, 0, MW, MH, { background: 'var(--cream)', opacity: 0 });
      this.group.append(el);
      return { el, card, content, stage: stageEl, cream, c, i };
    });
    this.buildSites(this.mods[0].stage);
    this.buildShop(this.mods[1].stage);
    this.buildSEO(this.mods[2].stage);
    this.buildSocial(this.mods[3].stage);

    cue(START, 'split');
    VISIT.forEach((v, i) => cue(v - 0.26, i === 0 ? 'dolly_in' : 'pan_whoosh', { dur: 0.3, idx: i }));
    cue(12.08, 'pullback', { dur: 0.3 });
    cue(12.25, 'riser_short', { dur: END - 12.25 });
    cue(END, 'flash_hit');
    ctx.fx.addFlash(END, 0.88, 0.17);
  }

  // ---------- Module 1 : SITES WEB ----------
  buildSites(s) {
    const F = { x: 75, y: 330, w: 720, h: 640 };
    this.m1 = { frame: box(s, F.x, F.y, F.w, F.h, { border: '3px solid rgba(240,240,232,0.55)', borderRadius: '26px' }) };
    box(this.m1.frame, 0, 52, F.w - 6, 3, { background: 'rgba(240,240,232,0.25)' });
    [0, 1, 2].forEach((k) => box(this.m1.frame, 24 + k * 26, 18, 14, 14, { borderRadius: '50%', border: '2.5px solid rgba(240,240,232,0.55)' }));
    this.m1.grid = columnGrid(F.x + 30, F.y + 70, F.w - 60, F.h - 100, 6, 18);
    this.m1.grid.style.opacity = 0; s.append(this.m1.grid);
    const r = rng(41);
    const blocks = [
      { x: 30, y: 78, w: 660, h: 46, c: 'rgba(240,240,232,0.14)', zone: 0 },
      { x: 30, y: 150, w: 380, h: 60, c: 'rgba(240,240,232,0.9)', zone: 1 },
      { x: 30, y: 222, w: 300, h: 60, c: 'rgba(240,240,232,0.9)', zone: 1 },
      { x: 30, y: 302, w: 200, h: 46, c: 'var(--accent)', zone: 1, round: 1 },
      { x: 440, y: 150, w: 250, h: 198, c: 'linear-gradient(150deg,#2c3226,#1d201b)', zone: 1, border: 1 },
      { x: 30, y: 384, w: 206, h: 220, c: '#242720', zone: 2, border: 1 },
      { x: 257, y: 384, w: 206, h: 220, c: '#242720', zone: 2, border: 1 },
      { x: 484, y: 384, w: 206, h: 220, c: '#242720', zone: 2, border: 1 },
    ];
    this.m1.blocks = blocks.map((bk, k) => ({ ...bk, el: box(s, F.x + bk.x, F.y + bk.y, bk.w, bk.h, { background: bk.c, borderRadius: bk.round ? '999px' : '12px', border: bk.border ? '2px solid rgba(240,240,232,0.14)' : 'none' }),
      fx: (r() - 0.5) * 700, fy: (r() - 0.5) * 500, fr: (r() - 0.5) * 50, t0: 8.5 + k * 0.045 }));
    this.m1.locks = [[0, 70, 720, 62], [0, 140, 720, 220], [0, 374, 720, 240]].map(([x, y, w, hh], k) => {
      const l = box(s, F.x + x - 10 + 10, F.y + y, w - 20 + 10, hh, {}); l.style.left = `${F.x + 12}px`; l.style.width = `${F.w - 24}px`;
      l.append(lockCorners(F.w - 24, hh, 30, 5)); l.style.opacity = 0;
      return { el: l, t0: 9.0 + k * 0.09 };
    });
    this.m1.locks.forEach((l, k) => cue(l.t0 + 0.04, 'lock_click', { pitch: k }));
  }

  // ---------- Module 2 : E-COMMERCE ----------
  buildShop(s) {
    const card = box(s, 215, 330, 440, 640, { transformStyle: 'preserve-3d' });
    const front = box(card, 0, 0, 440, 640, { background: '#20231e', border: '2.5px solid rgba(240,240,232,0.14)', borderRadius: '30px', backfaceVisibility: 'hidden', overflow: 'hidden' });
    const img = box(front, 20, 20, 400, 360, { borderRadius: '20px', background: 'radial-gradient(120% 90% at 50% 20%, #2f3529 0%, #1a1d18 70%)' });
    // Objet produit générique (vase stylisé, pas de marque)
    img.append(h('svg', { viewBox: '0 0 400 360', width: 400, height: 360, style: { position: 'absolute', left: 0, top: 0 } },
      h('ellipse', { cx: 200, cy: 318, rx: 92, ry: 12, fill: 'rgba(0,0,0,0.35)' }),
      h('path', { d: 'M168 70 H232 V96 C232 116 282 140 282 214 C282 282 246 316 200 316 C154 316 118 282 118 214 C118 140 168 116 168 96 Z', fill: 'var(--cream)' }),
      h('path', { d: 'M232 96 C232 116 282 140 282 214 C282 282 246 316 200 316 C236 300 252 268 252 214 C252 150 214 124 214 96 Z', fill: 'rgba(17,18,17,0.14)' }),
      h('rect', { x: 162, y: 62, width: 76, height: 14, rx: 7, fill: '#d9d6ca' })));
    box(front, 30, 410, 260, 26, { borderRadius: '8px', background: 'rgba(240,240,232,0.85)' });
    box(front, 30, 452, 180, 18, { borderRadius: '8px', background: 'rgba(240,240,232,0.25)' });
    box(front, 330, 410, 80, 26, { borderRadius: '8px', background: 'var(--accent)' });
    const btn = box(front, 30, 520, 380, 84, { borderRadius: '999px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', font: '600 30px var(--body)', color: '#111211' }, cartSVG(36, '#111211'), 'Ajouter au panier');
    btn.style.display = 'flex';
    const back = box(card, 0, 0, 440, 640, { background: 'var(--accent)', borderRadius: '30px', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '26px', color: '#111211', font: '600 40px/1.1 var(--heading)', letterSpacing: '-0.03em', textAlign: 'center' },
      h('div', { style: { width: '120px', height: '120px', borderRadius: '50%', background: '#111211', display: 'grid', placeItems: 'center' } },
        h('svg', { viewBox: '0 0 24 24', width: 70, height: 70, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, h('path', { d: 'M5 12.5 L10 17 L19 7.5' }))),
      h('div', {}, 'Ajouté', h('br'), 'au panier'));
    back.style.display = 'flex';
    // Panier en haut à droite
    const cart = box(s, 700, 70, 110, 110, { borderRadius: '50%', border: '2.5px solid rgba(240,240,232,0.3)', display: 'grid', placeItems: 'center', color: 'var(--paper)' }, cartSVG(54, 'var(--paper)'));
    cart.style.display = 'grid';
    const badge = box(cart, 70, -6, 46, 46, { borderRadius: '50%', background: 'var(--lime)', color: '#111211', font: '700 26px/46px var(--body)', textAlign: 'center' }); badge.textContent = '1';
    const cur = box(s, 0, 0, 0, 0, {}, cursorSVG(150));
    this.m2 = { card, btn, cart, badge, cur, click: 9.95 };
    cue(9.95, 'click'); cue(10.0, 'pop', { pitch: 3 }); cue(10.08, 'flip', { dur: 0.3 });
  }

  // ---------- Module 3 : SEO ----------
  buildSEO(s) {
    const bar = box(s, 60, 330, 750, 110, { borderRadius: '999px', border: '3px solid rgba(240,240,232,0.6)', background: '#20231e' });
    const icon = searchSVG(52, 'var(--accent)', 2.4); Object.assign(icon.style, { position: 'absolute', left: '34px', top: '26px' }); bar.append(icon);
    const q = box(bar, 110, 32, 600, 50, { font: '500 38px var(--body)', color: 'var(--paper)', whiteSpace: 'pre', overflow: 'hidden' });
    const caret = box(bar, 110, 30, 4, 50, { background: 'var(--accent)' });
    const results = [0, 1, 2, 3].map((k) => {
      const r = box(s, 60, 480 + k * 130, 750, 112, { borderRadius: '22px', background: '#20231e', border: '2.5px solid rgba(240,240,232,0.12)' });
      box(r, 26, 28, 56, 56, { borderRadius: '50%', background: k === 2 ? 'var(--accent)' : 'rgba(240,240,232,0.22)' });
      box(r, 104, 30, [380, 300, 420, 340][k], 20, { borderRadius: '8px', background: k === 2 ? 'rgba(240,240,232,0.92)' : 'rgba(240,240,232,0.5)' });
      box(r, 104, 66, [240, 280, 200, 260][k], 14, { borderRadius: '7px', background: k === 2 ? 'rgba(210,253,121,0.7)' : 'rgba(240,240,232,0.2)' });
      return r;
    });
    const lens = box(s, 0, 0, 0, 0, {}, searchSVG(220, 'var(--cream)', 1.6));
    this.m3 = { bar, q, caret, results, lens, text: 'site internet artisan var' };
    cue(10.42, 'typing', { dur: 0.36, n: 10 });
    cue(10.9, 'reorder', { dur: 0.3 });
  }

  // ---------- Module 4 : RÉSEAUX SOCIAUX ----------
  buildSocial(s) {
    const view = box(s, 0, 300, MW, 760, { perspective: '1100px', perspectiveOrigin: '435px 200px', transformStyle: 'preserve-3d' });
    this.m4 = { cards: [] };
    const kinds = ['video', 'photo', 'post', 'video', 'photo'];
    kinds.forEach((kind, k) => {
      const c = box(view, 255, 40, 360, 640, { borderRadius: '30px', background: '#20231e', border: '2.5px solid rgba(240,240,232,0.14)', overflow: 'hidden' });
      const media = box(c, 0, 0, 360, 470, { background: k % 2 ? 'linear-gradient(160deg,#323a2a,#1b1e18)' : 'radial-gradient(90% 70% at 30% 30%,#3a4330,#1b1e18)' });
      if (kind === 'video') { const p = box(media, 130, 185, 100, 100, { borderRadius: '50%', background: 'rgba(17,18,17,0.65)', display: 'grid', placeItems: 'center' }, playSVG(46, 'var(--accent)')); p.style.display = 'grid'; }
      if (kind === 'photo') media.append(h('svg', { viewBox: '0 0 360 470', width: 360, height: 470, style: { position: 'absolute', left: 0, top: 0 } }, h('path', { d: 'M0 380 L110 250 L190 330 L250 270 L360 380 V470 H0 Z', fill: 'rgba(240,240,232,0.16)' }), h('circle', { cx: 270, cy: 130, r: 34, fill: 'rgba(210,253,121,0.6)' })));
      if (kind === 'post') { box(media, 40, 150, 280, 30, { borderRadius: '10px', background: 'rgba(240,240,232,0.85)' }); box(media, 40, 200, 220, 30, { borderRadius: '10px', background: 'rgba(240,240,232,0.85)' }); box(media, 40, 250, 160, 30, { borderRadius: '10px', background: 'var(--accent)' }); }
      const row = box(c, 26, 494, 300, 50, { display: 'flex', gap: '22px', color: 'var(--paper)' }, heartSVG(44), sendSVG(44));
      row.style.display = 'flex';
      box(c, 26, 566, 230, 16, { borderRadius: '8px', background: 'rgba(240,240,232,0.45)' });
      box(c, 26, 596, 160, 14, { borderRadius: '7px', background: 'rgba(240,240,232,0.2)' });
      this.m4.cards.push({ el: c, row, k });
    });
    cue(11.45, 'swipe', { dur: 0.15 }); cue(11.7, 'swipe', { dur: 0.15 }); cue(11.95, 'swipe', { dur: 0.15 });
  }

  render(t) {
    // ---- caméra
    const camFor = (i) => ({ x: CENTERS[i].x - 540, y: CENTERS[i].y - 960 });
    const keys = (f) => [[START, f(null)], [START + 0.12, f(null)], ...VISIT.flatMap((v, i) => [[v, f(i), i === 0 ? E.inOutCubic : E.whip], [v + (i < 3 ? 0.66 : 0.4), f(i), E.linear]]), [12.32, f('far'), E.inOutCubic]];
    const cx = kf(t, keys((i) => (i === null || i === 'far' ? GC.x - 540 : camFor(i).x)));
    const cy = kf(t, keys((i) => (i === null || i === 'far' ? GC.y - 960 - 80 : camFor(i).y)));
    const cz = kf(t, keys((i) => (i === null ? OVER : i === 'far' ? OVER + 500 : NEAR)));
    const crz = kf(t, keys((i) => (i === null || i === 'far' ? 0 : [-2, 1.5, -1.5, 2][i])));
    this.cam.set({ x: cx, y: cy, z: cz, rz: crz });

    // ---- division de la carte centrale puis convergence finale
    const split = E.outExpo(prog(t, START, START + 0.35));
    const conv = E.inCubic(prog(t, 12.22, END));
    css(this.group, 'transform', `rotateZ(${(conv * 140).toFixed(2)}deg)`);
    this.mods.forEach((m) => {
      const dx = (m.c.x - GC.x), dy = (m.c.y - GC.y);
      const gap = lerp(0.5 * MW / (MW + GAP / 1), 1, split); // joint fermé → écarté
      const x = GC.x + dx * gap * (1 - conv) - MW / 2, y = GC.y + dy * lerp(0.5 * MH / (MH + GAP / 1), 1, split) * (1 - conv) - MH / 2;
      css(m.el, 'transform', tr3({ x, y, z: conv * 120, ry: conv * 70 * Math.sign(dx), rx: -conv * 50 * Math.sign(dy), s: 1 - conv * 0.55 }));
      css(m.content, 'opacity', E.outCubic(prog(t, START + 0.08, START + 0.4)).toFixed(3));
      css(m.cream, 'opacity', E.inQuad(prog(t, 12.3, END)).toFixed(3));
      css(m.card, 'border-radius', `${lerp(44, 140, conv).toFixed(1)}px`);
    });

    this.renderSites(t); this.renderShop(t); this.renderSEO(t); this.renderSocial(t);
  }

  renderSites(t) {
    const m = this.m1;
    css(m.frame, 'opacity', E.outCubic(prog(t, 8.45, 8.7)).toFixed(3));
    css(m.grid, 'opacity', (0.45 * kf(t, [[8.7, 0], [8.85, 1], [9.15, 1], [9.4, 0.25]])).toFixed(3));
    for (const bk of m.blocks) {
      const p = settle(prog(t, bk.t0, bk.t0 + 0.42), 0.05);
      css(bk.el, 'transform', `translate(${(bk.fx * (1 - p)).toFixed(1)}px, ${(bk.fy * (1 - p)).toFixed(1)}px) rotate(${(bk.fr * (1 - clamp(p))).toFixed(2)}deg)`);
      css(bk.el, 'opacity', clamp(prog(t, bk.t0, bk.t0 + 0.12)).toFixed(3));
    }
    m.locks.forEach((l) => {
      const p = prog(t, l.t0, l.t0 + 0.18);
      css(l.el, 'opacity', (p > 0 ? 1 : 0).toFixed(3));
      css(l.el, 'transform', `scale(${lerp(1.08, 1, E.outBack(p)).toFixed(4)})`);
    });
  }

  renderShop(t) {
    const m = this.m2;
    const c = m.click;
    const press = kf(t, [[c - 0.01, 1], [c + 0.04, 0.94, E.outQuad], [c + 0.18, 1, E.outBack]]);
    css(m.btn, 'transform', `scale(${press.toFixed(4)})`);
    const flip = E.inOutCubic(prog(t, 10.08, 10.4));
    css(m.card, 'transform', `rotateY(${(flip * 180).toFixed(2)}deg)`);
    const pop = E.outBack(prog(t, c + 0.05, c + 0.25), 2.2);
    css(m.badge, 'transform', `scale(${pop.toFixed(4)})`);
    css(m.cart, 'transform', `rotate(${(Math.sin(clamp(prog(t, c + 0.05, c + 0.4)) * Math.PI * 3) * 9 * (1 - prog(t, c + 0.05, c + 0.4))).toFixed(2)}deg)`);
    css(m.cart, 'border-color', t > c + 0.05 ? 'var(--lime)' : 'rgba(240,240,232,0.3)');
    const from = { x: 760, y: 1020 }, to = { x: 330, y: 885 };
    const pc = E.inOutCubic(prog(t, 9.62, c - 0.02));
    const away = E.inCubic(prog(t, 10.1, 10.4));
    css(m.cur, 'transform', `translate(${lerp(from.x, to.x, pc) + away * 300}px, ${lerp(from.y, to.y, pc) + away * 200}px) scale(${(t > c ? press : 1).toFixed(3)})`);
    css(m.cur, 'opacity', (prog(t, 9.55, 9.65) * (1 - away)).toFixed(3));
  }

  renderSEO(t) {
    const m = this.m3;
    const draw = E.outCubic(prog(t, 10.2, 10.45));
    css(m.bar, 'clip-path', `inset(0 ${(100 - draw * 100).toFixed(2)}% 0 0 round 999px)`);
    const n = Math.round(clamp(prog(t, 10.42, 10.78)) * m.text.length);
    if (m.q.textContent !== m.text.slice(0, n)) m.q.textContent = m.text.slice(0, n);
    const qw = m.q.scrollWidth;
    css(m.caret, 'transform', `translateX(${Math.min(qw, 600) + 4}px)`);
    css(m.caret, 'opacity', ((Math.floor(t * 6) % 2 === 0 || (t > 10.42 && t < 10.8)) && t > 10.35 ? 1 : 0).toFixed(3));
    // Réorganisation : le résultat surligné (3e) passe en tête
    const ro = E.inOutCubic(prog(t, 10.9, 11.18));
    const order = [[0, 1], [1, 2], [2, 0], [3, 3]]; // [index initial, position finale]
    order.forEach(([k, pos]) => {
      const appear = E.outCubic(prog(t, 10.5 + k * 0.05, 10.75 + k * 0.05));
      const y = lerp(k, pos, ro) * 130 - k * 130;
      css(m.results[k], 'transform', `translate(${(k === 2 ? Math.sin(ro * Math.PI) * 40 : 0).toFixed(1)}px, ${(y + (1 - appear) * 40).toFixed(1)}px) scale(${(k === 2 ? 1 + Math.sin(ro * Math.PI) * 0.04 : 1).toFixed(4)})`);
      css(m.results[k], 'opacity', appear.toFixed(3));
      if (k === 2) css(m.results[k], 'border-color', `rgba(194,249,58,${(0.25 + 0.75 * ro).toFixed(3)})`);
      if (k === 2) css(m.results[k], 'z-index', '2');
    });
    const lp = E.inOutCubic(prog(t, 10.62, 11.3));
    css(m.lens, 'transform', `translate(${lerp(560, 120, lp).toFixed(1)}px, ${(kf(t, [[10.62, 820], [11.0, 470, E.inOutCubic], [11.3, 450]])).toFixed(1)}px) rotate(${lerp(-10, 6, lp).toFixed(2)}deg)`);
    css(m.lens, 'opacity', (prog(t, 10.55, 10.7) * (1 - prog(t, 11.4, 11.55))).toFixed(3));
  }

  renderSocial(t) {
    const m = this.m4;
    // Défilement rapide en profondeur : chaque carte avance vers la caméra puis sort, la suivante prend sa place.
    const flow = kf(t, [[11.2, 0], [11.45, 1, E.inOutCubic], [11.7, 2, E.inOutCubic], [11.95, 3, E.inOutCubic], [12.15, 3.25, E.outQuad]]);
    m.cards.forEach((c) => {
      const d = c.k - flow; // 0 = carte au premier plan
      const z = d < 0 ? -d * 1100 : -d * 300;
      const x = d < 0 ? d * 60 : d * 70;
      const y = d < 0 ? d * 520 : d * 34;
      css(c.el, 'transform', tr3({ x, y, z, rx: d < 0 ? d * 28 : 0, ry: d > 0 ? -d * 6 : 0 }));
      css(c.el, 'opacity', (d < -0.75 ? 0 : d < -0.35 ? (d + 0.75) / 0.4 : clamp(1 - (d - 2.4))).toFixed(3));
      css(c.el, 'z-index', String(10 - c.k));
      css(c.row.firstChild, 'transform', `scale(${(1 + 0.35 * Math.max(0, Math.sin(clamp((-d + 0.3) * 3.2) * Math.PI))).toFixed(3)})`);
      css(c.row.firstChild, 'color', d < 0.2 && d > -0.6 ? 'var(--lime)' : 'var(--paper)');
    });
  }
}
