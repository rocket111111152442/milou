import { h, css, tr3 } from '../engine/dom.js';
import { E, prog, kf, lerp, clamp, rng, settle } from '../engine/ease.js';
import { b } from '../engine/time.js';
import { Scene, cue } from '../components/TransitionController.js';
import { MotionCamera } from '../components/MotionCamera.js';
import { logoSVG } from '../components/BrandLogo.js';
import { contourField, columnGrid } from '../components/AnimatedGrid.js';
import { arrowSVG } from '../components/UIComponents.js';
import { SITE_MARK } from '../components/SiteMock.js';

// SCÈNE 02 — DU CHAOS À LA STRUCTURE (4 → 10 temps, 1,87 → 4,67 s)
// Des composants d'interface flottent sans ordre ; travelling latéral rapide ; ils se verrouillent un à un sur une grille
// (un son par verrouillage) ; le titre s'écrit de gauche à droite ; la carte image grandit jusqu'à remplir l'écran.

const START = b(4), END = b(10);
const ASM = 2.28; // début du verrouillage
const PAGE = { x: 70, y: 250, w: 940, h: 1440 };
const ELS = [
  { id: 'panel', x: 70, y: 250, w: 940, h: 1440, kind: 'panel' },
  { id: 'logo', x: 110, y: 300, w: 48, h: 48, kind: 'logoSq' },
  ...[0, 1, 2, 3].map((k) => ({ id: `link${k}`, x: 470 + k * 88, y: 319, w: 66, h: 10, kind: 'navBar' })),
  { id: 'cta', x: 830, y: 298, w: 140, h: 52, kind: 'pillOutline' },
  { id: 'kdot', x: 110, y: 423, w: 12, h: 12, kind: 'dot' },
  { id: 'kicker', x: 138, y: 424, w: 300, h: 10, kind: 'navBar' },
  { id: 't1', x: 110, y: 480, w: 840, h: 86, kind: 'titleBar' },
  { id: 't2', x: 110, y: 594, w: 560, h: 86, kind: 'titleBar' },
  { id: 'p1', x: 110, y: 752, w: 620, h: 16, kind: 'bar' },
  { id: 'p2', x: 110, y: 782, w: 500, h: 16, kind: 'bar' },
  { id: 'b1', x: 110, y: 836, w: 270, h: 76, kind: 'pillLime' },
  { id: 'b2', x: 400, y: 836, w: 210, h: 76, kind: 'pillOutline' },
  { id: 'img', x: 110, y: 956, w: 860, h: 428, kind: 'image' },
  { id: 'c1', x: 110, y: 1418, w: 270, h: 230, kind: 'card' },
  { id: 'c2', x: 405, y: 1418, w: 270, h: 230, kind: 'card' },
  { id: 'c3', x: 700, y: 1418, w: 270, h: 230, kind: 'card' },
];

export class Scene02_GridAssembly extends Scene {
  constructor(stage, ctx) {
    super(stage, 'Scene02_GridAssembly', { pre: START - 1.5, post: 0.02, z: 9 });
    this.cam = new MotionCamera(this.root, { perspective: 1600 });
    const W = this.cam.world;
    const rand = rng(21);

    this.grid = columnGrid(110, 250, 860, 1440, 12, 20);
    this.grid.style.opacity = 0;
    W.append(this.grid);

    this.els = ELS.map((spec, k) => {
      const el = h('div', { class: 'node', style: { width: `${spec.w}px`, height: `${spec.h}px` } });
      this.fill(el, spec);
      const glow = h('div', { class: 'abs', style: { inset: '-3px', borderRadius: spec.kind.startsWith('pill') || spec.kind === 'bar' || spec.kind === 'titleBar' ? '999px' : '24px', border: '3px solid var(--lime)', opacity: 0, width: `${spec.w + 6}px`, height: `${spec.h + 6}px` } });
      el.append(glow);
      W.append(el);
      const big = spec.kind === 'panel';
      return { ...spec, el, glow,
        cx: big ? 560 : -520 + rand() * 1800, cy: big ? 1000 : 60 + rand() * 1800, cz: big ? -2600 : -1350 + rand() * 1150,
        rx: (rand() - 0.5) * 80, ry: (rand() - 0.5) * 100, rz: (rand() - 0.5) * 50, phase: rand() * 6.28, order: 0 };
    });
    // Ordre de verrouillage : de haut en bas ; le panneau (fond de page) se pose en dernier, derrière.
    const sorted = this.els.filter((e) => e.kind !== 'panel').sort((a, c) => a.y - c.y || a.x - c.x);
    sorted.forEach((e, i) => { e.t0 = ASM + i * 0.042; e.dur = 0.4; cue(e.t0 + 0.13, 'lock', { idx: i }); });
    const panel = this.els.find((e) => e.kind === 'panel');
    panel.t0 = ASM + sorted.length * 0.042 - 0.05; panel.dur = 0.55;
    cue(panel.t0 + 0.2, 'lock_panel');
    this.img = this.els.find((e) => e.id === 'img');
    this.imgEl = this.img.el;

    // Titre réel intégré à la page : « DES SITES QUI MARQUENT. »
    this.title = h('div', { class: 'node', style: { left: '110px', top: '462px', fontFamily: 'var(--heading)', fontWeight: 700, fontSize: '124px', lineHeight: 0.93, letterSpacing: '-0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', color: 'var(--paper)' } });
    this.tl1 = h('div', { style: { display: 'block' } }, 'DES SITES QUI');
    this.tl2 = h('div', { style: { display: 'block', color: 'var(--accent)' } }, 'MARQUENT.');
    this.title.append(this.tl1, this.tl2);
    this.caret = h('div', { class: 'abs', style: { width: '7px', background: 'var(--lime)', borderRadius: '3px' } });
    this.title.append(this.caret);
    W.append(this.title);

    cue(START - 0.05, 'whoosh', { dur: 0.6, dir: 1 });
    cue(3.08, 'wipe', { dur: 0.6 });
  }

  init() {
    // Ajuste le titre à la largeur utile de la page.
    const w = Math.max(this.tl1.scrollWidth, this.tl2.scrollWidth);
    const size = 124 * Math.min(1, 850 / w);
    this.title.style.fontSize = `${size}px`;
    this.titleSize = size;
    this.lw = [this.tl1.scrollWidth, this.tl2.scrollWidth];
    this.lh = this.tl1.offsetHeight;
    // Les barres du squelette prennent exactement la place des lignes du titre.
    ['t1', 't2'].forEach((id, i) => {
      const e = this.els.find((x) => x.id === id);
      e.w = this.lw[i]; e.y = 462 + i * this.lh + this.lh * 0.16; e.h = this.lh * 0.7;
      e.el.style.width = `${e.w}px`; e.el.style.height = `${e.h}px`;
      Object.assign(e.el.firstChild.style, { width: `${e.w}px`, height: `${e.h}px` });
      Object.assign(e.glow.style, { width: `${e.w + 6}px`, height: `${e.h + 6}px` });
    });
  }

  fill(el, s) {
    const add = (style, ...c) => { const d = h('div', { class: 'abs' }, ...c); Object.assign(d.style, style); el.append(d); return d; };
    switch (s.kind) {
      case 'panel':
        add({ inset: 0, width: `${s.w}px`, height: `${s.h}px`, background: 'var(--surface)', border: '2px solid var(--line)', borderRadius: '36px' });
        add({ left: '2px', top: '92px', width: `${s.w - 4}px`, height: '2px', background: 'var(--line)' });
        break;
      case 'navBar': add({ width: `${s.w}px`, height: `${s.h}px`, borderRadius: '5px', background: 'rgba(240,240,232,0.5)' }); break;
      case 'dot': add({ width: `${s.w}px`, height: `${s.h}px`, borderRadius: '50%', background: 'var(--lime)' }); break;
      case 'logoSq': add({ width: `${s.w}px`, height: `${s.h}px`, borderRadius: '14px', background: 'var(--cream)' }); break;
      case 'links': [0, 1, 2, 3].forEach((k) => add({ left: `${k * 88}px`, top: '5px', width: '66px', height: '10px', borderRadius: '5px', background: 'rgba(240,240,232,0.45)' })); break;
      case 'pillOutline': add({ width: `${s.w}px`, height: `${s.h}px`, borderRadius: '999px', border: '2.5px solid rgba(240,240,232,0.6)' }); add({ left: `${s.h * 0.42}px`, top: `${s.h / 2 - 5}px`, width: `${s.w - s.h * 0.84}px`, height: '10px', borderRadius: '5px', background: 'rgba(240,240,232,0.6)' }); break;
      case 'pillLime': {
        add({ width: `${s.w}px`, height: `${s.h}px`, borderRadius: '999px', background: 'var(--accent)' });
        add({ left: '34px', top: `${s.h / 2 - 6}px`, width: '120px', height: '12px', borderRadius: '6px', background: '#111211' });
        const c = add({ left: `${s.w - s.h + 8}px`, top: '8px', width: `${s.h - 16}px`, height: `${s.h - 16}px`, borderRadius: '50%', background: '#111211', display: 'grid', placeItems: 'center', color: 'var(--accent)' }, arrowSVG(30, 'var(--accent)'));
        c.style.display = 'grid';
        break;
      }
      case 'kicker': add({ left: 0, top: '5px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--lime)' }); add({ left: '28px', top: '6px', width: '300px', height: '10px', borderRadius: '5px', background: 'rgba(240,240,232,0.55)' }); break;
      case 'titleBar': add({ width: `${s.w}px`, height: `${s.h}px`, borderRadius: '14px', background: 'rgba(240,240,232,0.9)' }); break;
      case 'bar': add({ width: `${s.w}px`, height: `${s.h}px`, borderRadius: '8px', background: 'rgba(240,240,232,0.24)' }); break;
      case 'image': {
        const frame = add({ width: `${s.w}px`, height: `${s.h}px`, borderRadius: '26px', overflow: 'hidden', background: '#111211', border: '2px solid var(--line)' });
        this.imgFrame = frame;
        this.imgContent = h('div', { class: 'abs', style: { width: '1440px', height: '1800px', transformOrigin: '0 0' } });
        this.imgContent.append(contourField(1440, 1800, { seed: 5 }));
        const glow = h('div', { class: 'abs', style: { left: `${SITE_MARK.x - 330}px`, top: `${SITE_MARK.y - 330}px`, width: '660px', height: '660px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(194,249,58,0.16), rgba(194,249,58,0) 100%)' } });
        const mark = logoSVG(SITE_MARK.size);
        Object.assign(mark.style, { position: 'absolute', left: `${SITE_MARK.x - SITE_MARK.size / 2}px`, top: `${SITE_MARK.y - SITE_MARK.size / 2}px` });
        this.imgContent.append(glow, mark);
        frame.append(this.imgContent);
        break;
      }
      case 'card':
        add({ width: `${s.w}px`, height: `${s.h}px`, borderRadius: '24px', background: '#20231e', border: '2px solid var(--line)' });
        add({ left: '28px', top: '28px', width: '56px', height: '56px', borderRadius: '16px', border: '2.5px solid var(--accent)' });
        add({ left: '28px', top: '122px', width: `${s.w - 90}px`, height: '14px', borderRadius: '7px', background: 'rgba(240,240,232,0.7)' });
        add({ left: '28px', top: '154px', width: `${s.w - 130}px`, height: '11px', borderRadius: '6px', background: 'rgba(240,240,232,0.25)' });
        add({ left: '28px', top: '178px', width: `${s.w - 160}px`, height: '11px', borderRadius: '6px', background: 'rgba(240,240,232,0.25)' });
        break;
    }
  }

  render(t) {
    // Caméra : travelling latéral rapide puis recentrage sur la page.
    const camX = kf(t, [[1.5, -400], [1.88, -340, E.outQuad], [2.42, 250, E.whip], [3.15, 0, E.inOutCubic]]);
    const camRy = kf(t, [[1.5, -18], [1.88, -15], [2.42, 9, E.whip], [3.15, 0, E.inOutCubic]]);
    const camZ = kf(t, [[1.5, 260], [1.88, 140, E.outCubic], [2.42, 70, E.inOutQuad], [3.15, 0, E.inOutCubic], [4.18, -36, E.linear], [END, -220, E.inCubic]]);
    const camRx = kf(t, [[1.5, 6], [2.42, 3], [3.15, 0, E.inOutCubic]]);
    this.cam.set({ x: camX, z: camZ, ry: camRy, rx: camRx });
    const k = 1600 / (1600 + 220);

    // Grille de colonnes visible pendant le verrouillage
    css(this.grid, 'opacity', (0.3 * kf(t, [[ASM + 0.15, 0], [ASM + 0.4, 1, E.outCubic], [3.2, 1], [3.6, 0, E.inOutQuad]])).toFixed(3));

    const expand = E.inOutExpo(prog(t, 4.2, END - 0.03));
    for (const e of this.els) {
      const p = settle(prog(t, e.t0, e.t0 + e.dur), 0.06, 1.1);
      const pin = clamp(p);
      const fl = 1 - pin;
      const drift = Math.sin(t * 1.6 + e.phase) * 26 * fl;
      const x = lerp(e.cx - e.w / 2, e.x, p) + drift;
      const y = lerp(e.cy - e.h / 2, e.y, p) + Math.cos(t * 1.3 + e.phase) * 22 * fl;
      let z = lerp(e.cz, 0, p);
      let tf;
      if (e === this.img && expand > 0) {
        const tx = 540 - 540 / k, ty = 960 - 960 / k;
        const rx = lerp(e.x, tx, expand), ry = lerp(e.y, ty, expand), rw = lerp(e.w, 1080 / k, expand), rh = lerp(e.h, 1920 / k, expand);
        css(e.el, 'width', `${rw}px`); css(e.el, 'height', `${rh}px`);
        css(this.imgFrame, 'width', `${rw}px`); css(this.imgFrame, 'height', `${rh}px`);
        css(this.imgFrame, 'border-radius', `${lerp(26, 0, expand)}px`);
        tf = tr3({ x: rx, y: ry, z: 2 + expand * 40 });
        this.layoutImg(rw, rh);
      } else {
        if (e === this.img) { this.layoutImg(e.w, e.h); css(e.el, 'width', `${e.w}px`); css(e.el, 'height', `${e.h}px`); css(this.imgFrame, 'width', `${e.w}px`); css(this.imgFrame, 'height', `${e.h}px`); css(this.imgFrame, 'border-radius', '26px'); }
        const push = expand * (e.kind === 'panel' ? 0 : 1);
        tf = tr3({ x: x + push * (e.x + e.w / 2 - 540) * 0.9, y: y + push * (e.y + e.h / 2 - 1170) * 0.9, z: z - push * 200, rx: e.rx * fl, ry: e.ry * fl, rz: e.rz * fl });
      }
      css(e.el, 'transform', tf);
      const vis = e.kind === 'panel' ? E.outCubic(prog(t, e.t0, e.t0 + 0.3)) : kf(t, [[1.5, 0], [1.75, 1, E.outCubic]]);
      css(e.el, 'opacity', (vis * (1 - (e === this.img ? 0 : expand * 0.9))).toFixed(3));
      // Éclair lime au verrouillage
      const lock = prog(t, e.t0 + e.dur * 0.32, e.t0 + e.dur * 0.32 + 0.24);
      css(e.glow, 'opacity', (lock > 0 && lock < 1 && e.kind !== 'panel' ? (1 - lock) * 0.9 : 0).toFixed(3));
      if (e.kind === 'titleBar') e.el.firstChild.style.clipPath = this.barClip(t, e.id === 't1' ? 0 : 1, e.w);
    }

    // Titre : révélation de gauche à droite, curseur lime en tête.
    const show = t >= 2.95;
    css(this.title, 'display', show ? 'block' : 'none');
    if (show) {
      const pushT = expand;
      css(this.title, 'transform', tr3({ y: -pushT * 900, z: 1 }));
      css(this.title, 'opacity', (1 - pushT).toFixed(3));
      const w1 = this.wipe(t, 0), w2 = this.wipe(t, 1);
      css(this.tl1, 'clip-path', `inset(-20% ${(100 - w1 * 100).toFixed(2)}% -20% 0)`);
      css(this.tl2, 'clip-path', `inset(-20% ${(100 - w2 * 100).toFixed(2)}% -20% 0)`);
      const active = w2 > 0 ? 1 : 0;
      const wv = active ? w2 : w1;
      css(this.caret, 'left', `${(wv * this.lw[active] + 6).toFixed(1)}px`);
      css(this.caret, 'top', `${(active * this.lh + this.lh * 0.14).toFixed(1)}px`);
      css(this.caret, 'height', `${(this.lh * 0.74).toFixed(1)}px`);
      css(this.caret, 'opacity', (w1 > 0 ? 1 - prog(t, 3.7, 3.82) : 0).toFixed(3));
    }
  }

  wipe(t, line) { const t0 = 3.08 + line * 0.2; return E.inOutCubic(prog(t, t0, t0 + 0.4)); }
  barClip(t, line, w) {
    const wv = this.wipe(t, line) * (this.lw ? this.lw[line] : w);
    return `inset(0 0 0 ${Math.min(w, wv + 8).toFixed(1)}px round 14px)`;
  }

  /** Contenu de la carte image : le symbole reste centré et proportionnel à la carte (raccord avec la scène 3). */
  layoutImg(w, hh) {
    const markSize = 0.62 * Math.min(w, hh);
    const k = markSize / SITE_MARK.size;
    css(this.imgContent, 'transform', `translate(${(w / 2 - SITE_MARK.x * k).toFixed(2)}px, ${(hh / 2 - SITE_MARK.y * k).toFixed(2)}px) scale(${k.toFixed(5)})`);
  }
}
