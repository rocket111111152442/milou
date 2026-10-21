import { h, css } from '../engine/dom.js';
import { E, prog, lerp, clamp } from '../engine/ease.js';
import { b } from '../engine/time.js';
import { Scene, cue } from '../components/TransitionController.js';

// SCÈNE 07 — LA DÉCISION (45 → 51 temps, 21 → 23,8 s)
// Les interfaces s'éloignent, un grand noir s'ouvre. Un filet lime se trace ; les lignes de texte montent de derrière
// ce filet (masque + déplacement de lignes). Rythme volontairement plus lent : respiration avant le CTA.

const START = b(45), END = b(51);
const RULE_Y = 1010;
const L1 = b(46), L2 = b(46.5), OUT = b(48.6), D1 = b(49.1), VIE = b(49.75);

export class Scene07_FinalMessage extends Scene {
  constructor(stage, ctx) {
    super(stage, 'Scene07_FinalMessage', { pre: 0, post: 0.05, z: 11 });
    this.ambient = h('div', { class: 'layer', style: { background: 'radial-gradient(70% 38% at 50% 100%, rgba(194,249,58,0.14), rgba(194,249,58,0) 100%)', opacity: 0 } });
    this.root.append(this.ambient);
    this.rule = h('div', { class: 'abs', style: { left: '86px', top: `${RULE_Y}px`, width: '908px', height: '4px', background: 'var(--lime)', transformOrigin: '0 50%' } });
    this.root.append(this.rule);
    // Masque : tout ce qui est sous le filet est invisible.
    this.mask = h('div', { class: 'abs', style: { left: 0, top: '0px', width: '1080px', height: `${RULE_Y - 8}px`, overflow: 'hidden' } });
    this.root.append(this.mask);
    const line = (txt, size, color = 'var(--paper)') => {
      const el = h('div', { class: 'abs', style: { left: '84px', font: `700 ${size}px/0.9 var(--heading)`, letterSpacing: '-0.05em', textTransform: 'uppercase', color, whiteSpace: 'nowrap' } }, txt);
      this.mask.append(el); return el;
    };
    this.a1 = line('VOTRE PROJET', 128);
    this.a2 = h('div', { class: 'abs', style: { left: '84px', font: '700 128px/0.9 var(--heading)', letterSpacing: '-0.05em', color: 'var(--paper)', whiteSpace: 'nowrap' } }, 'MÉRITE ', h('span', { style: { color: 'var(--paper)' } }, 'MIEUX.'));
    this.mask.append(this.a2);
    this.b1 = line('DONNONS-LUI', 128);
    this.b2 = line('VIE.', 380, 'var(--accent)');

    cue(START + 0.08, 'rule_draw', { dur: 0.4 });
    cue(L1, 'line_rise', { gain: 0.8 }); cue(L2, 'line_rise', { gain: 0.7 });
    cue(OUT, 'line_drop');
    cue(D1, 'line_rise', { gain: 0.8 });
    cue(VIE, 'vie_hit');
    cue(END - 0.28, 'suck', { dur: 0.28 });
  }

  init() {
    // Ajuste les deux lignes du premier message à la largeur utile, place les lignes au-dessus du filet.
    for (const el of [this.a1, this.a2, this.b1]) {
      const w = el.scrollWidth; if (w > 850) el.style.fontSize = `${128 * 850 / w}px`; // reste hors de la colonne d'icônes
    }
    const hA = this.a1.offsetHeight;
    this.posA = [RULE_Y - 26 - hA * 2 - 6, RULE_Y - 26 - hA];
    this.hA = hA;
    const hV = this.b2.offsetHeight;
    this.posB = [RULE_Y - 22 - hV - this.b1.offsetHeight + 10, RULE_Y - 22 - hV];
    this.hV = hV;
  }

  render(t) {
    const draw = E.inOutExpo(prog(t, START + 0.05, START + 0.5));
    const collapse = E.inOutCubic(prog(t, END - 0.3, END));
    css(this.rule, 'transform', `translateX(${(collapse * 454).toFixed(1)}px) scaleX(${(draw * (1 - collapse)).toFixed(4)})`);
    css(this.ambient, 'opacity', (clamp(prog(t, START + 0.2, START + 1.2)) * 0.7 + 0.3 * Math.exp(-Math.max(0, t - VIE) * 3) * (t > VIE ? 1 : 0)).toFixed(3) * (1 - collapse));

    // Message 1 : chaque ligne monte depuis le filet (la 1re parcourt deux hauteurs de ligne)
    const rise = (el, y, t0, dur, travel) => {
      const p = E.outExpo(prog(t, t0, t0 + dur));
      return y + (1 - p) * travel;
    };
    const drop = E.inCubic(prog(t, OUT, OUT + 0.22));
    const [y1, y2] = this.posA;
    css(this.a1, 'transform', `translateY(${(rise(this.a1, y1, L1 - 0.16, 0.42, this.hA * 2 + 40) + drop * (this.hA * 2 + 60)).toFixed(2)}px)`);
    css(this.a2, 'transform', `translateY(${(rise(this.a2, y2, L2 - 0.16, 0.42, this.hA + 40) + drop * (this.hA + 60)).toFixed(2)}px)`);
    // « MIEUX. » s'allume brièvement en lime après la pose
    const glow = clamp(prog(t, L2 + 0.25, L2 + 0.45)) * (1 - clamp(prog(t, OUT - 0.2, OUT)));
    css(this.a2.lastChild, 'color', `color-mix(in srgb, var(--accent) ${(glow * 100).toFixed(1)}%, var(--paper))`);

    // Message 2 : « DONNONS-LUI » puis « VIE. » géant en lime
    const exitUp = E.inCubic(prog(t, END - 0.32, END - 0.04));
    const [yb1, yb2] = this.posB;
    css(this.b1, 'transform', `translateY(${(rise(this.b1, yb1, D1 - 0.16, 0.45, this.hV + 160) - exitUp * 900).toFixed(2)}px)`);
    const pv = E.outExpo(prog(t, VIE - 0.14, VIE + 0.12));
    css(this.b2, 'transform', `translateY(${(yb2 + (1 - pv) * (this.hV + 40) - exitUp * 900).toFixed(2)}px) scale(${lerp(1.08, 1, pv).toFixed(4)})`);
    css(this.b2, 'transform-origin', '0% 100%');
  }
}
