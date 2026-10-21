import { h, css, tr3 } from '../engine/dom.js';
import { E, prog, kf, lerp, clamp } from '../engine/ease.js';
import { b } from '../engine/time.js';
import { Scene, cue } from '../components/TransitionController.js';
import { Headline } from '../components/TypographySystem.js';
import { logoSVG, wordmark } from '../components/BrandLogo.js';
import { contourField } from '../components/AnimatedGrid.js';
import { arrowSVG, menuSVG } from '../components/UIComponents.js';
import { SERVICES } from '../components/SiteMock.js';
import { S6_LOGO } from './shared.js';

// SCÈNE 06 — UN SITE À VOTRE IMAGE (36 → 45 temps, 16,8 → 21 s)
// Le symbole se pose dans l'en-tête ; la page d'accueil réelle se construit dans un navigateur.
// Morphing continu desktop → mobile (les composants se réorganisent), une version desktop reste à gauche,
// le mobile à droite défile. Deux messages séparés par une transition.

const START = b(36), END = b(45);
const DESK = { x: 90, y: 720, w: 900, h: 570 };
const PHONE = { x: 520, y: 560, w: 420, h: 860 };
const MINI = { x: 70, y: 860, w: 400, h: 400 * 570 / 900 };
const MORPH = [17.78, 18.9];
const MSG2 = b(41);

// Mises en page desktop / mobile (repère local du cadre, en px)
const L = {
  lock:   { d: [43, 60, 1], m: [22, 62, 0.88] },
  nav:    { d: [318, 73, 1], m: [318, 73, 1] },
  pill:   { d: [716, 61, 1], m: [716, 61, 1] },
  menu:   { d: [810, 58, 1], m: [354, 58, 1] },
  kicker: { d: [56, 150, 1], m: [22, 146, 0.86] },
  h1:     { d: [52, 172, 1], m: [18, 170, 0.74] },
  para:   { d: [56, 400, 1], m: [22, 352, 1] },
  cta:    { d: [252, 402, 1], m: [22, 432, 1] },
  visual: { d: [700, 300, 1], m: [210, 640, 0.95] },
};

export class Scene06_ResponsiveDemo extends Scene {
  constructor(stage, ctx) {
    super(stage, 'Scene06_ResponsiveDemo', { pre: 0, post: 0.65, z: 5 });
    this.view = h('div', { class: 'layer', style: { perspective: '1600px', perspectiveOrigin: '540px 1000px' } });
    this.world = h('div', { class: 'layer p3d', style: { transformOrigin: '540px 1000px' } });
    this.view.append(this.world);
    this.root.append(this.view);

    // Version desktop miniature (reste à gauche) : copie statique de la mise en page desktop
    this.mini = this.buildFrame(true);
    this.world.append(this.mini.frame);
    // Cadre principal (se transforme en smartphone)
    this.main = this.buildFrame(false);
    this.world.append(this.main.frame);
    // Lien entre les deux versions
    this.link = h('div', { class: 'abs', style: { left: `${MINI.x + MINI.w + 8}px`, top: `${PHONE.y + PHONE.h / 2 - 1}px`, width: `${PHONE.x - MINI.x - MINI.w - 16}px`, height: '3px', background: 'var(--lime)', transformOrigin: '0 50%' } });
    this.world.append(this.link);
    this.labels = ['DESKTOP', 'MOBILE'].map((t, i) => { const l = h('div', { class: 'label abs', style: { color: 'var(--muted)', fontSize: '22px' } }, t); this.world.append(l); return l; });

    this.m1 = new Headline(this.root, { lines: [['UN', 'SITE', 'À'], ['VOTRE', { t: 'IMAGE.', accent: true }]], size: 124, x: 86, y: 262, maxWidth: 900 });
    this.m2 = new Headline(this.root, { lines: [['PENSÉ', 'POUR'], ['VOS', { t: 'CLIENTS.', accent: true }]], size: 124, x: 86, y: 262, maxWidth: 900 });
    this.rule = h('div', { class: 'abs', style: { left: '86px', top: '520px', width: '560px', height: '4px', background: 'var(--lime)', transformOrigin: '0 50%' } });
    this.root.append(this.rule);

    cue(START + 0.1, 'build', { dur: 0.4 });
    cue(b(37), 'word_hit', { gain: 0.7 });
    cue(MORPH[0], 'morph', { dur: MORPH[1] - MORPH[0] });
    cue(MSG2 - 0.18, 'swish_soft');
    cue(MSG2, 'word_hit', { gain: 0.7 });
    cue(19.45, 'scroll_tick', { dur: 0.5 }); cue(20.05, 'scroll_tick', { dur: 0.45 });
  }

  init() { this.m1.fit(); this.m2.fit(); this.size2 = this.m2.size; }

  buildFrame(isMini) {
    const frame = h('div', { class: 'abs', style: { overflow: 'hidden', background: '#111211', border: '2.5px solid rgba(240,240,232,0.22)', boxShadow: '0 40px 120px rgba(0,0,0,0.55)' } });
    const bar = h('div', { class: 'abs', style: { left: 0, top: 0, width: '100%', height: '44px', background: '#171916', borderBottom: '1.5px solid rgba(255,255,255,0.08)' } });
    const dots = [0, 1, 2].map((k) => h('div', { class: 'abs', style: { left: `${20 + k * 20}px`, top: '16px', width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(240,240,232,0.25)' } }));
    bar.append(...dots);
    const url = h('div', { class: 'abs', style: { left: '50%', top: '10px', width: '300px', marginLeft: '-150px', height: '24px', borderRadius: '12px', background: 'rgba(240,240,232,0.07)', font: '500 12px/24px var(--body)', color: 'var(--muted)', textAlign: 'center', letterSpacing: '0.02em' } }, 'lullin-web.com');
    bar.append(url);
    const island = h('div', { class: 'abs', style: { left: '50%', top: '14px', width: '110px', marginLeft: '-55px', height: '30px', borderRadius: '15px', background: '#000', opacity: 0 } });
    // Contenu défilant
    const scroller = h('div', { class: 'abs', style: { left: 0, top: 0, width: '100%', height: '2000px' } });
    const bg = h('div', { class: 'abs', style: { left: 0, top: '44px', width: '1440px', height: '900px', transformOrigin: '0 0', transform: 'scale(0.625)', opacity: 0.9 } }, contourField(1440, 900, { seed: 5 }));
    scroller.append(bg);
    frame.append(scroller);
    const C = {};
    const add = (key, el, parent = scroller) => { const w = h('div', { class: 'abs', style: { transformOrigin: '0 0' } }, el); parent.append(w); C[key] = w; return w; };
    // En-tête (fixe)
    const header = h('div', { class: 'abs', style: { left: 0, top: 0, width: '100%', height: '120px', background: '#111211' } });
    header.append(h('div', { class: 'abs', style: { left: 0, top: '119px', width: '1440px', height: '1.5px', background: 'rgba(255,255,255,0.1)' } }));
    frame.append(header, bar, island);
    const lock = h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px' } }, logoSVG(S6_LOGO.svgSize, { cls: 'demo-mark' }), wordmark(29));
    lock.firstChild.style.margin = `${-(S6_LOGO.svgSize - S6_LOGO.svgSize * 918 / 1237) / 2}px`;
    add('lock', lock, header);
    add('nav', h('div', { style: { display: 'flex', gap: '26px', font: '500 13px var(--body)', color: '#e6e5dc', whiteSpace: 'nowrap' } }, ...['Expertises', 'Réalisations', 'L’agence', 'Offres', 'Blog'].map((n) => h('span', {}, n))), header);
    add('pill', h('div', { style: { width: '150px', height: '36px', borderRadius: '18px', border: '1.5px solid rgba(240,240,232,0.45)', font: '500 11px/33px var(--body)', color: 'var(--paper)', paddingLeft: '16px', whiteSpace: 'nowrap' } }, 'Parlons de votre projet'), header);
    add('menu', h('div', { style: { width: '46px', height: '46px', borderRadius: '50%', border: '1.5px solid rgba(240,240,232,0.45)', display: 'grid', placeItems: 'center', color: 'var(--paper)' } }, menuSVG(24)), header);
    // Héros
    add('kicker', h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', font: '500 9.5px var(--body)', letterSpacing: '0.12em', color: '#e6e5dc', whiteSpace: 'nowrap' } }, h('span', { style: { width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' } }), 'CRÉATION DE SITES INTERNET SUR MESURE'));
    add('h1', h('div', { style: { font: '500 66px/1.02 var(--heading)', letterSpacing: '-0.075em', color: 'var(--paper)', whiteSpace: 'nowrap' } }, h('div', {}, 'Votre site'), h('div', {}, 'professionnel,'), h('div', { style: { color: 'var(--accent)' } }, 'simplement.')));
    const pd = h('div', { style: { position: 'absolute', width: '178px', font: '400 10.5px/17px var(--body)', color: '#c5cbb9' } }, 'Un site moderne, rapide et adapté à votre activité, sans devoir investir plusieurs milliers d’euros.');
    const pm = h('div', { style: { position: 'absolute', width: '370px', font: '400 15px/23px var(--body)', color: '#c5cbb9', opacity: 0 } }, 'Un site moderne, rapide et adapté à votre activité, sans devoir investir plusieurs milliers d’euros.');
    add('para', h('div', {}, pd, pm));
    const ctaIn = h('div', { style: { width: '160px', height: '40px', borderRadius: '20px', background: 'var(--accent)', position: 'relative', font: '600 11.5px/40px var(--body)', color: '#111211', paddingLeft: '16px', whiteSpace: 'nowrap' } }, 'Demander un devis',
      h('div', { style: { position: 'absolute', right: '4px', top: '4px', width: '32px', height: '32px', borderRadius: '50%', background: '#111211', display: 'grid', placeItems: 'center' } }, arrowSVG(14, 'var(--accent)', 2.4)));
    add('cta', ctaIn);
    const vis = h('div', { style: { position: 'relative', width: '0px', height: '0px' } },
      h('div', { style: { position: 'absolute', left: '-220px', top: '-220px', width: '440px', height: '440px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(194,249,58,0.16), rgba(194,249,58,0))' } }));
    const vm = logoSVG(250); Object.assign(vm.style, { position: 'absolute', left: '-125px', top: '-125px' }); vis.append(vm);
    add('visual', vis);
    // Section suivante (visible en défilant sur mobile)
    const sec = h('div', { class: 'abs', style: { left: '22px', top: '820px', opacity: 0 } },
      h('div', { style: { font: '500 11px var(--body)', letterSpacing: '0.16em', color: 'var(--muted)' } }, '01 — NOS EXPERTISES'),
      h('div', { style: { marginTop: '12px', font: '500 40px/1.02 var(--heading)', letterSpacing: '-0.06em', color: 'var(--paper)' } }, h('div', {}, 'Nos expertises'), h('div', { style: { color: 'var(--accent)' } }, 'digitales.')),
      ...SERVICES.map((n, i) => h('div', { style: { marginTop: i ? '12px' : '26px', width: '376px', height: '84px', borderRadius: '18px', background: '#1d201b', border: '1.5px solid rgba(255,255,255,0.1)', position: 'relative' } },
        h('div', { style: { position: 'absolute', left: '20px', top: '16px', font: '500 11px var(--body)', color: 'var(--accent)', letterSpacing: '0.1em' } }, `0${i + 1}`),
        h('div', { style: { position: 'absolute', left: '20px', top: '38px', font: '500 24px var(--heading)', letterSpacing: '-0.04em', color: 'var(--paper)' } }, n))));
    scroller.append(sec);
    if (isMini) { C.menu.style.opacity = 0; }
    return { frame, bar, url, island, dots, scroller, bg, C, pd, pm, sec, header };
  }

  place(F, rect, radius, p) {
    css(F.frame, 'left', `${rect.x.toFixed(2)}px`); css(F.frame, 'top', `${rect.y.toFixed(2)}px`);
    css(F.frame, 'width', `${rect.w.toFixed(2)}px`); css(F.frame, 'height', `${rect.h.toFixed(2)}px`);
    css(F.frame, 'border-radius', `${radius.toFixed(1)}px`);
    for (const [k, v] of Object.entries(L)) {
      const [x, y, s] = v.d.map((d, i) => lerp(d, v.m[i], p));
      css(F.C[k], 'transform', `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s.toFixed(4)})`);
    }
  }

  render(t) {
    // Construction de la page autour du symbole posé dans l'en-tête
    const build = E.outExpo(prog(t, START, START + 0.45));
    const m = E.inOutCubic(prog(t, MORPH[0], MORPH[1]));
    const F = this.main;
    const rect = { x: lerp(DESK.x, PHONE.x, m), y: lerp(DESK.y, PHONE.y, m), w: lerp(DESK.w, PHONE.w, m), h: lerp(DESK.h, PHONE.h, m) };
    // Le cadre apparaît depuis le symbole : il se déploie depuis le coin de l'en-tête
    const grow = build;
    const r0 = { x: lerp(S6_LOGO.cx - 40, rect.x, grow), y: lerp(S6_LOGO.cy - 40, rect.y, grow), w: lerp(80, rect.w, grow), h: lerp(80, rect.h, grow) };
    this.place(F, r0, lerp(24, 58, m), m);
    css(F.frame, 'opacity', clamp(prog(t, START - 0.01, START + 0.08)).toFixed(3));
    const content = E.outCubic(prog(t, START + 0.12, START + 0.45));
    for (const k of ['kicker', 'h1', 'para', 'cta', 'visual', 'nav', 'pill']) css(F.C[k], 'opacity', (content * (k === 'nav' || k === 'pill' ? 1 - prog(t, MORPH[0], MORPH[0] + 0.3) : 1)).toFixed(3));
    css(F.C.menu, 'opacity', prog(t, MORPH[0] + 0.25, MORPH[0] + 0.5).toFixed(3));
    css(F.bg, 'opacity', (0.9 * content).toFixed(3));
    css(F.pd, 'opacity', (1 - prog(t, MORPH[0] + 0.2, MORPH[0] + 0.45)).toFixed(3));
    css(F.pm, 'opacity', prog(t, MORPH[0] + 0.45, MORPH[0] + 0.7).toFixed(3));
    css(F.bar, 'opacity', (1 - prog(t, MORPH[0] + 0.2, MORPH[0] + 0.6)).toFixed(3));
    css(F.island, 'opacity', prog(t, MORPH[0] + 0.5, MORPH[1]).toFixed(3));
    css(F.sec, 'opacity', prog(t, MORPH[1] - 0.2, MORPH[1]).toFixed(3));
    // Défilement mobile (deux gestes avec inertie)
    const scroll = kf(t, [[19.42, 0], [19.95, 330, E.outCubic], [20.05, 330], [20.62, 640, E.outCubic]]);
    css(F.scroller, 'transform', `translateY(${(-scroll).toFixed(2)}px)`);

    // Version desktop miniature à gauche + lien
    const sp = E.inOutCubic(prog(t, MORPH[0] + 0.05, MORPH[1] + 0.05));
    const M = this.mini;
    const mr = { x: lerp(DESK.x, MINI.x, sp), y: lerp(DESK.y, MINI.y, sp), w: DESK.w, h: DESK.h };
    const ms = lerp(1, MINI.w / DESK.w, sp);
    this.place(M, { x: 0, y: 0, w: DESK.w, h: DESK.h }, 24, 0);
    css(M.frame, 'transform', `translate(${mr.x.toFixed(2)}px, ${mr.y.toFixed(2)}px) scale(${ms.toFixed(4)})`);
    css(M.frame, 'transform-origin', '0 0');
    css(M.frame, 'left', '0px'); css(M.frame, 'top', '0px');
    css(M.frame, 'opacity', (t > MORPH[0] ? 0.92 : 0).toFixed(3));
    css(this.link, 'transform', `scaleX(${E.outExpo(prog(t, MORPH[1] - 0.05, MORPH[1] + 0.3)).toFixed(4)})`);
    this.labels.forEach((l, i) => {
      const p = E.outCubic(prog(t, MORPH[1] + i * 0.08, MORPH[1] + 0.3 + i * 0.08));
      css(l, 'transform', `translate(${i ? PHONE.x + 4 : MINI.x + 4}px, ${(i ? PHONE.y + PHONE.h + 26 : MINI.y + MINI.h + 26) + (1 - p) * 16}px)`);
      css(l, 'opacity', p.toFixed(3));
    });

    // Recul de la caméra vers la scène 7
    const rec = E.inOutCubic(prog(t, END - 0.2, END + 0.5));
    css(this.world, 'transform', `translateZ(${(-rec * 2600).toFixed(1)}px) rotateX(${(rec * 18).toFixed(2)}deg)`);
    css(this.view, 'opacity', (1 - E.inOutQuad(prog(t, END - 0.05, END + 0.42))).toFixed(3));

    // Messages
    const w = (H, i, t0, t1, out0) => {
      const p = E.outExpo(prog(t, t0, t1));
      H.word(i, { y: 1 - p - E.inQuart(prog(t, out0, out0 + 0.14)), s: lerp(1.1, 1, p) });
    };
    const a = b(37);
    [0, 1, 2, 3, 4].forEach((i) => w(this.m1, i, a - 0.14 + i * 0.045, a + 0.06 + i * 0.045, MSG2 - 0.3 + i * 0.025));
    [0, 1, 2, 3].forEach((i) => w(this.m2, i, MSG2 - 0.1 + i * 0.05, MSG2 + 0.1 + i * 0.05, END - 0.22 + i * 0.025));
    // Filet lime : souligne puis sépare les deux messages
    const r1 = E.outExpo(prog(t, a + 0.15, a + 0.5)), r2 = E.inOutCubic(prog(t, MSG2 - 0.3, MSG2 - 0.05));
    const r3 = E.outExpo(prog(t, MSG2 + 0.2, MSG2 + 0.55)), r4 = E.inCubic(prog(t, END - 0.25, END - 0.05));
    const sx = t < MSG2 - 0.05 ? r1 * (1 - r2) : r3 * (1 - r4);
    css(this.rule, 'transform', `scaleX(${sx.toFixed(4)})`);
    css(this.rule, 'transform-origin', t < MSG2 - 0.3 || (t > MSG2 && t < END - 0.25) ? '0 50%' : '100% 50%');
  }
}
