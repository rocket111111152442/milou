import { h, css, tr3 } from '../engine/dom.js';
import { E, prog, kf, lerp, clamp, rng } from '../engine/ease.js';
import { b } from '../engine/time.js';
import { Scene, cue } from '../components/TransitionController.js';
import { Headline } from '../components/TypographySystem.js';
import { cursorSVG } from '../components/UIComponents.js';

// SCÈNE 01 — L'ACCROCHE (0 → 4 temps, 0 → 1,87 s)
// Image 0 déjà composée : maquette filaire en cours de tracé + curseur lime + premier mot qui frappe.
// Clic → contraction, impulsion géométrique, lignes de construction, désassemblage. « MIEUX » se fragmente en rectangles d'interface.

const WIN = { x: 150, y: 780, w: 780, h: 560 };
const CLICK = 0.40;
const MIEUX_LAND = b(2);
const FRAG = 1.40;
const END = b(4);

function svgBox(w, hh, ...children) {
  return h('svg', { width: w, height: hh, viewBox: `0 0 ${w} ${hh}`, style: { overflow: 'visible', position: 'absolute', left: 0, top: 0 } }, ...children);
}
const stroke = (extra = {}) => ({ fill: 'none', stroke: 'var(--cream)', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': '1 1', ...extra });

export class Scene01_Hook extends Scene {
  constructor(stage, ctx) {
    super(stage, 'Scene01_Hook', { pre: 0, post: 0.1, z: 10 });
    this.ctx = ctx;
    this.zoom = h('div', { class: 'layer', style: { transformOrigin: '540px 980px' } });
    this.root.append(this.zoom);

    // Monde 3D (maquette filaire)
    this.view = h('div', { class: 'layer', style: { perspective: '1500px', perspectiveOrigin: '540px 1000px', transformStyle: 'preserve-3d' } });
    this.world = h('div', { class: 'layer p3d', style: { transformOrigin: '540px 1060px', transform: 'scale(1.08)' } });
    this.view.append(this.world);
    this.zoom.append(this.view);
    this.buildConstructionLines();
    this.buildWireframe();
    this.buildPulse();

    // Typographie (2D, au-dessus)
    this.textLayer = h('div', { class: 'layer', style: { perspective: '1200px', perspectiveOrigin: '540px 500px' } });
    this.zoom.append(this.textLayer);
    this.h1 = new Headline(this.textLayer, { lines: [['VOTRE', 'SITE']], size: 176, x: 86, y: 360, maxWidth: 908 });
    this.h2 = new Headline(this.textLayer, { lines: [['PEUT', 'FAIRE'], ['MIEUX.']], size: 176, x: 86, y: 360, maxWidth: 908 });

    this.cursorWrap = h('div', { class: 'abs', style: { transformOrigin: '0 0' } }, cursorSVG(250));
    this.zoom.append(this.cursorWrap);

    cue(0, 'impact_open');
    cue(0.14, 'word_tick', { gain: 0.5 }); cue(0.24, 'word_tick', { gain: 0.45 });
    cue(CLICK, 'click');
    cue(0.72, 'word_tick', { gain: 0.45 }); cue(0.79, 'word_tick', { gain: 0.5 });
    cue(MIEUX_LAND, 'bass_hit');
    cue(FRAG, 'shatter');
    cue(1.47, 'suck', { dur: END - 1.47 });
  }

  init() {
    this.h1.fit(); this.h2.fit();
    // Fragments de « MIEUX. » : tuiles qui deviennent des rectangles d'interface.
    const word = this.h2.words[2];
    const r = word.inner.getBoundingClientRect();
    this.mieuxRect = { x: r.left, y: r.top, w: r.width, h: r.height };
    this.tiles = [];
    const rand = rng(7);
    const cols = 6, rows = 2;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const tw = r.width / cols, th = r.height / rows;
      const tile = h('div', { class: 'abs', style: { left: `${r.left + i * tw}px`, top: `${r.top + j * th}px`, width: `${tw + 0.5}px`, height: `${th + 0.5}px`, overflow: 'hidden', borderRadius: '0px', transformStyle: 'flat' } });
      const copy = word.inner.cloneNode(true);
      Object.assign(copy.style, { position: 'absolute', left: `${-i * tw}px`, top: `${-j * th}px`, fontSize: `${this.h2.size}px`, fontFamily: 'var(--heading)', fontWeight: 700, letterSpacing: '-0.045em', lineHeight: 0.94, whiteSpace: 'nowrap', transform: 'none', color: 'var(--paper)' });
      const ui = h('div', { class: 'abs', style: { inset: 0, borderRadius: '14px', background: 'var(--surface)', border: '2px solid var(--line-strong)', opacity: 0 } },
        h('div', { class: 'bar strong', style: { left: '14%', top: '24%', width: '52%', height: '12%' } }),
        h('div', { class: 'bar', style: { left: '14%', top: '50%', width: '70%', height: '8%' } }),
        h('div', { class: 'bar', style: { left: '14%', top: '66%', width: '46%', height: '8%' } }));
      tile.append(copy, ui);
      this.textLayer.append(tile);
      const cx = r.left + (i + 0.5) * tw - (r.left + r.width / 2), cy = r.top + (j + 0.5) * th - (r.top + r.height / 2);
      this.tiles.push({ el: tile, copy, ui, i, j, cx, cy,
        delay: (Math.abs(i - 2.5) / 2.5) * 0.05 + rand() * 0.04,
        rx: (rand() - 0.5) * 70, ry: (rand() - 0.5) * 80, rz: (rand() - 0.5) * 30,
        spread: 2.4 + rand() * 2.2, grow: 0.5 + rand() * 0.6, z: 420 + rand() * 330 });
    }
  }

  buildWireframe() {
    const W = WIN;
    const g = h('div', { class: 'node', style: { left: `${W.x}px`, top: `${W.y}px`, width: `${W.w}px`, height: `${W.h}px` } });
    this.world.append(g);
    this.wire = g;
    const parts = [];
    const add = (x, y, w, hh, svgChildren, opts = {}) => {
      const el = h('div', { class: 'node', style: { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px` } }, svgBox(w, hh, ...svgChildren));
      g.append(el);
      parts.push({ el, x, y, w, h: hh, ...opts, draws: [...el.querySelectorAll('[pathLength]')], fills: [...el.querySelectorAll('[data-fill]')] });
      return el;
    };
    // Fenêtre de navigateur
    add(0, 0, W.w, W.h, [
      h('rect', { x: 1, y: 1, width: W.w - 2, height: W.h - 2, rx: 26, ...stroke({ 'stroke-width': 2.4 }) }),
      h('path', { d: `M1 54 H${W.w - 1}`, ...stroke({ opacity: 0.6 }) }),
      h('circle', { cx: 30, cy: 27, r: 6.5, ...stroke() }), h('circle', { cx: 54, cy: 27, r: 6.5, ...stroke() }), h('circle', { cx: 78, cy: 27, r: 6.5, ...stroke() }),
      h('rect', { x: 250, y: 15, width: 280, height: 24, rx: 12, ...stroke({ opacity: 0.5 }) }),
    ], { start: -0.32, dur: 0.42, dir: [0, 0], depth: -60 });
    // Navigation
    add(36, 78, 708, 40, [
      h('rect', { x: 0, y: 4, width: 30, height: 30, rx: 8, ...stroke() }),
      ...[0, 1, 2, 3].map((k) => h('path', { d: `M${330 + k * 72} 19 H${378 + k * 72}`, ...stroke({ opacity: 0.55, 'stroke-width': 6 }) })),
      h('rect', { x: 618, y: 2, width: 90, height: 34, rx: 17, ...stroke() }),
    ], { start: -0.24, dur: 0.36, dir: [0, -1.2], depth: 120 });
    // Titre (barres pleines)
    add(36, 150, 400, 132, [
      h('rect', { x: 0, y: 0, width: 400, height: 32, rx: 9, fill: 'var(--cream)', 'data-fill': 1 }),
      h('rect', { x: 0, y: 48, width: 330, height: 32, rx: 9, fill: 'var(--cream)', 'data-fill': 1 }),
      h('rect', { x: 0, y: 96, width: 250, height: 32, rx: 9, fill: 'var(--cream)', 'data-fill': 1 }),
    ], { start: -0.16, dur: 0.34, dir: [-1.3, -0.4], depth: 260 });
    // Paragraphe
    add(36, 306, 330, 52, [
      h('path', { d: 'M0 4 H330', ...stroke({ 'stroke-width': 8, opacity: 0.32 }) }),
      h('path', { d: 'M0 25 H300', ...stroke({ 'stroke-width': 8, opacity: 0.32 }) }),
      h('path', { d: 'M0 46 H230', ...stroke({ 'stroke-width': 8, opacity: 0.32 }) }),
    ], { start: -0.1, dur: 0.3, dir: [-1.4, 0.3], depth: 80 });
    // Bouton (cible du clic)
    this.btn = add(36, 388, 200, 58, [
      h('rect', { x: 1, y: 1, width: 198, height: 56, rx: 28, ...stroke({ 'stroke-width': 2.6 }) }),
      h('path', { d: 'M32 29 H128', ...stroke({ 'stroke-width': 7, opacity: 0.7 }) }),
      h('circle', { cx: 170, cy: 29, r: 12, ...stroke() }),
    ], { start: -0.05, dur: 0.3, dir: [-1.0, 1.1], depth: 340, isBtn: true });
    this.btnFill = h('div', { class: 'abs', style: { left: 0, top: 0, width: '200px', height: '58px', borderRadius: '29px', background: 'var(--accent)', opacity: 0 } });
    this.btn.prepend(this.btnFill);
    // Image
    add(470, 150, 274, 296, [
      h('rect', { x: 1, y: 1, width: 272, height: 294, rx: 16, ...stroke() }),
      h('path', { d: 'M18 250 L96 160 L150 214 L188 176 L256 250', ...stroke({ opacity: 0.8 }) }),
      h('circle', { cx: 206, cy: 78, r: 22, ...stroke({ opacity: 0.8 }) }),
    ], { start: -0.2, dur: 0.38, dir: [1.4, -0.2], depth: 180 });
    // Cartes
    [[36, 220], [276, 220], [516, 228]].forEach(([x, w], k) => add(x, 474, w, 64, [
      h('rect', { x: 1, y: 1, width: w - 2, height: 62, rx: 14, ...stroke({ opacity: 0.75 }) }),
      h('circle', { cx: 32, cy: 32, r: 11, ...stroke({ opacity: 0.75 }) }),
      h('path', { d: `M58 26 H${w - 40}`, ...stroke({ 'stroke-width': 6, opacity: 0.4 }) }),
      h('path', { d: `M58 41 H${w - 80}`, ...stroke({ 'stroke-width': 6, opacity: 0.25 }) }),
    ], { start: -0.02 + k * 0.05, dur: 0.3, dir: [(k - 1) * 1.2, 1.5], depth: 60 + k * 90 }));
    this.parts = parts;
  }

  buildConstructionLines() {
    // Lignes de construction qui partent des bords de la fenêtre jusqu'aux bords de l'image.
    const W = WIN;
    const L = [];
    const mk = (x, y, w, hh, origin) => {
      const el = h('div', { class: 'abs', style: { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px`, background: 'var(--cream)', opacity: 0, transformOrigin: origin } });
      this.world.append(el); L.push(el); return el;
    };
    for (const y of [W.y, W.y + 54, W.y + W.h]) { mk(-200, y - 1, W.x + 200, 2, '100% 50%'); mk(W.x + W.w, y - 1, 1080 - W.x - W.w + 200, 2, '0% 50%'); }
    for (const x of [W.x, W.x + W.w, W.x + 36]) { mk(x - 1, -200, 2, W.y + 200, '50% 100%'); mk(x - 1, W.y + W.h, 2, 1920 - W.y - W.h + 200, '50% 0%'); }
    this.lines = L;
  }

  buildPulse() {
    this.pulses = [0, 1].map((k) => {
      const el = h('div', { class: 'abs', style: { borderRadius: '28%', border: `${k ? 2 : 5}px solid ${k ? 'var(--lime)' : 'var(--cream)'}`, opacity: 0 } });
      this.world.append(el);
      return el;
    });
  }

  render(t) {
    // Zoom avant continu + coup de caméra sur « MIEUX » + accélération finale.
    const kick = t > MIEUX_LAND ? 0.022 * Math.exp(-(t - MIEUX_LAND) * 14) : 0;
    const zIn = 1 + 0.035 * clamp(t / END) + kick + 0.55 * E.inExpo(prog(t, 1.5, END + 0.1));
    css(this.zoom, 'transform', `scale(${zIn.toFixed(4)})`);

    // Tracé de la maquette (déjà à moitié dessinée à l'image 0)
    const clickC = t >= CLICK ? kf(t, [[CLICK, 1], [CLICK + 0.07, 0.94, E.outQuad], [CLICK + 0.32, 1.015, E.outCubic], [CLICK + 0.6, 1, E.inOutQuad]]) : 1;
    const dis = E.outCubic(prog(t, 0.52, 1.6));
    const disEnd = E.inCubic(prog(t, 1.35, END));
    css(this.wire, 'transform', `translate3d(0,0,0) scale(${clickC.toFixed(4)})`);
    for (const p of this.parts) {
      const dp = E.outCubic(prog(t, p.start, p.start + p.dur));
      for (const d of p.draws) css(d, 'stroke-dashoffset', (1 - dp).toFixed(4));
      for (const f of p.fills) css(f, 'transform', `scaleX(${dp.toFixed(4)})`);
      const amt = dis * 70 + disEnd * 520;
      css(p.el, 'transform', tr3({ x: p.dir[0] * amt, y: p.dir[1] * amt, z: (dis * 0.6 + disEnd * 1.4) * p.depth, rx: (dis + disEnd) * p.dir[1] * -14, ry: (dis + disEnd) * p.dir[0] * 16 }));
      css(p.el, 'opacity', (1 - 0.3 * dis - 0.7 * disEnd).toFixed(3));
    }
    css(this.btnFill, 'opacity', (t >= CLICK ? kf(t, [[CLICK, 0], [CLICK + 0.05, 1, E.outQuad], [1.2, 1], [1.6, 0.6]]) : 0).toFixed(3));

    // Impulsion géométrique au clic
    const tip = this.cursorPos(CLICK);
    this.pulses.forEach((el, k) => {
      const p = prog(t, CLICK + k * 0.06, CLICK + 0.62 + k * 0.08);
      const s = E.outCubic(p) * (k ? 2300 : 2600) + 20;
      css(el, 'width', `${s}px`); css(el, 'height', `${s}px`);
      css(el, 'transform', `translate(${(tip.x - s / 2).toFixed(1)}px, ${(tip.y - s / 2).toFixed(1)}px)`);
      css(el, 'opacity', (p > 0 && p < 1 ? (1 - p) * (k ? 0.9 : 0.75) : 0).toFixed(3));
    });

    // Lignes de construction
    this.lines.forEach((el, k) => {
      const p = E.outExpo(prog(t, CLICK + 0.02 + (k % 6) * 0.018, CLICK + 0.42 + (k % 6) * 0.018));
      css(el, 'transform', el.style.width === '2px' ? `scaleY(${p.toFixed(4)})` : `scaleX(${p.toFixed(4)})`);
      css(el, 'opacity', (p > 0 ? 0.34 * (1 - prog(t, 1.0, 1.5)) : 0).toFixed(3));
    });

    // Curseur
    const c = this.cursorPos(t);
    const press = t >= CLICK ? kf(t, [[CLICK, 1], [CLICK + 0.05, 0.84, E.outQuad], [CLICK + 0.22, 1, E.outBack]]) : 1;
    css(this.cursorWrap, 'transform', `translate(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px) scale(${press.toFixed(4)})`);
    css(this.cursorWrap, 'opacity', (1 - prog(t, 1.0, 1.25)).toFixed(3));

    // Typographie
    const rise = (i, h0, t0, t1, ease = E.outExpo, s0 = 1.12) => {
      const p = ease(prog(t, t0, t1));
      return { y: 1 - p, s: lerp(s0, 1, p) };
    };
    const w0 = rise(0, this.h1, -0.1, 0.14), w1 = rise(1, this.h1, 0.0, 0.24);
    const e0 = E.inOutCubic(prog(t, 0.45, 0.58)), e1 = E.inOutCubic(prog(t, 0.48, 0.61));
    this.h1.word(0, { y: w0.y - e0, s: w0.s });
    this.h1.word(1, { y: w1.y - e1, s: w1.s });
    css(this.h1.el, 'visibility', t < 0.66 ? 'visible' : 'hidden');

    const p0 = rise(0, this.h2, 0.58, 0.74), p1 = rise(1, this.h2, 0.63, 0.79);
    const x0 = E.inQuart(prog(t, 1.32, 1.46)), x1 = E.inQuart(prog(t, 1.35, 1.49));
    this.h2.word(0, { y: p0.y - x0, s: p0.s });
    this.h2.word(1, { y: p1.y - x1, s: p1.s });
    const pm = E.outQuart(prog(t, 0.8, MIEUX_LAND));
    const lime = t < 1.2 ? 1 : 1 - prog(t, 1.2, 1.32);
    const col = `color-mix(in srgb, var(--accent) ${(lime * 100).toFixed(1)}%, var(--paper))`;
    this.h2.word(2, { y: 1 - pm, s: lerp(1.28, 1, pm), color: col, o: t < FRAG ? 1 : 0 });
    css(this.h2.el, 'visibility', t > 0.5 ? 'visible' : 'hidden');

    // Fragmentation de « MIEUX. » en rectangles d'interface qui envahissent l'écran
    for (const tl of this.tiles) {
      const on = t >= FRAG;
      css(tl.el, 'display', on ? 'block' : 'none');
      if (!on) continue;
      const p = prog(t, FRAG + tl.delay, END + 0.08);
      const pe = E.inCubic(p), po = E.outCubic(prog(t, FRAG + tl.delay, FRAG + tl.delay + 0.22));
      css(tl.copy, 'color', col);
      css(tl.el, 'opacity', (1 - prog(t, END - 0.05, END + 0.08)).toFixed(3));
      css(tl.copy, 'opacity', (1 - po).toFixed(3));
      css(tl.ui, 'opacity', po.toFixed(3));
      css(tl.el, 'border-radius', `${(po * 14).toFixed(1)}px`);
      css(tl.el, 'transform', tr3({ x: tl.cx * (po * 0.5 + pe * tl.spread), y: tl.cy * (po * 0.9 + pe * tl.spread * 2.2) + pe * 260, z: pe * tl.z + po * 60,
        rx: tl.rx * (po * 0.4 + pe), ry: tl.ry * (po * 0.4 + pe), rz: tl.rz * po, s: 1 + po * 0.5 + pe * tl.grow }));
    }
  }

  cursorPos(t) {
    // Pointe du curseur : arrive sur le bouton au moment du clic, puis s'écarte.
    const target = { x: WIN.x + 36 + 120, y: WIN.y + 388 + 34 };
    const from = { x: 700, y: 1640 };
    const p = E.inOutCubic(prog(t, -0.12, CLICK - 0.03));
    const away = E.inCubic(prog(t, 0.75, 1.25));
    return { x: lerp(from.x, target.x, p) + away * 120 - 8, y: lerp(from.y, target.y, p) + away * 260 - 6 };
  }
}
