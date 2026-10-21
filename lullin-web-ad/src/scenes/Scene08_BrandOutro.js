import { h, css } from '../engine/dom.js';
import { E, prog, lerp, clamp, settle } from '../engine/ease.js';
import { b } from '../engine/time.js';
import { Scene, cue } from '../components/TransitionController.js';
import { logoSVG, wordmark } from '../components/BrandLogo.js';
import { contourField } from '../components/AnimatedGrid.js';
import { arrowSVG } from '../components/UIComponents.js';

// SCÈNE 08 — SIGNATURE FINALE (51 → 58 temps, 23,8 → 27,1 s)
// Symbole officiel net, wordmark officiel, promesse, domaine en très grand avec filet lime et flèche, localisation.

const START = b(51), END = b(58);
const URL = b(53);
const MARK_VIS = 330;

export class Scene08_BrandOutro extends Scene {
  constructor(stage, ctx) {
    super(stage, 'Scene08_BrandOutro', { pre: 0, post: 1, z: 12 });
    this.root.style.background = 'var(--bg)';
    this.bg = h('div', { class: 'layer', style: { opacity: 0 } }, contourField(1080, 1920, { seed: 11, cell: 16, scale: 420, opacity: 0.35 }));
    this.root.append(this.bg);
    this.all = h('div', { class: 'layer', style: { transformOrigin: '540px 900px' } });
    this.root.append(this.all);
    const svgSize = MARK_VIS * 1237 / 918;
    this.mark = h('div', { class: 'abs', style: { left: `${540 - svgSize / 2}px`, top: `${590 - svgSize / 2}px`, width: `${svgSize}px`, height: `${svgSize}px`, transformOrigin: '50% 50%' } }, logoSVG(svgSize));
    this.all.append(this.mark);
    const center = (el, top) => { const w = h('div', { class: 'abs', style: { left: 0, top: `${top}px`, width: '1080px', display: 'flex', justifyContent: 'center' } }, el); this.all.append(w); return w; };
    this.wmMask = center(h('div', { style: { overflow: 'hidden', padding: '6px 10px 18px' } }, wordmark(118)), 812);
    this.tag = center(h('div', { style: { font: '500 44px var(--body)', color: 'rgba(240,240,232,0.9)', letterSpacing: '-0.005em' } }, 'Création web & solutions digitales'), 978);
    this.urlText = h('span', { style: { font: '600 128px/1 var(--heading)', letterSpacing: '-0.05em', color: 'var(--paper)', whiteSpace: 'nowrap' } }, 'lullin-web.com');
    this.arrow = h('span', { style: { display: 'inline-block', marginLeft: '14px', color: 'var(--lime)' } }, arrowSVG(78, 'var(--lime)', 2.6));
    this.urlRow = h('div', { style: { display: 'flex', alignItems: 'center', position: 'relative', overflow: 'visible' } }, h('div', { style: { overflow: 'hidden', padding: '8px 4px 16px' } }, this.urlText), this.arrow);
    this.underline = h('div', { style: { position: 'absolute', left: '4px', bottom: '-6px', height: '6px', borderRadius: '3px', background: 'var(--lime)', transformOrigin: '0 50%' } });
    this.urlRow.append(this.underline);
    this.url = center(this.urlRow, 1110);
    this.loc = center(h('div', { class: 'label', style: { fontSize: '33px', letterSpacing: '0.26em', color: 'rgba(240,240,232,0.72)' } }, 'SIX-FOURS  •  TOULON'), 1318);

    cue(START + 0.02, 'mark_in');
    cue(URL, 'final_hit');
    cue(URL + 0.18, 'underline', { dur: 0.35 });
    cue(URL + 0.45, 'tick', { pitch: 5 });
  }

  init() {
    // Le domaine et la flèche doivent tenir dans la zone sûre : ≤ 790 px, donc x ∈ [145, 935].
    const w = this.urlRow.scrollWidth;
    if (w > 790) this.urlText.style.fontSize = `${128 * (790 - 92) / (w - 92)}px`;
    this.underline.style.width = `${this.urlText.offsetWidth - 8}px`;
  }

  render(t) {
    const life = E.inOutQuad(prog(t, START, END + 1));
    css(this.all, 'transform', `scale(${(1 + 0.018 * life).toFixed(4)})`);
    css(this.bg, 'opacity', (0.5 * E.inOutQuad(prog(t, START + 0.4, START + 1.8))).toFixed(3));

    const pm = prog(t, START - 0.02, START + 0.42);
    css(this.mark, 'transform', `scale(${lerp(0.82, 1, settle(pm, 0.05)).toFixed(4)}) rotate(${lerp(-14, 0, E.outExpo(pm)).toFixed(2)}deg)`);
    css(this.mark, 'opacity', clamp(pm * 3).toFixed(3));

    const pw = E.outExpo(prog(t, START + 0.22, START + 0.6));
    css(this.wmMask.firstChild.firstChild, 'transform', `translateY(${((1 - pw) * 120).toFixed(1)}%)`);
    const pt = E.outCubic(prog(t, START + 0.45, START + 0.8));
    css(this.tag, 'opacity', pt.toFixed(3)); css(this.tag, 'transform', `translateY(${((1 - pt) * 24).toFixed(1)}px)`);

    const pu = E.outExpo(prog(t, URL - 0.12, URL + 0.1));
    css(this.urlText, 'transform', `translateY(${((1 - pu) * 115).toFixed(1)}%)`);
    css(this.urlText, 'display', 'inline-block');
    const pl = E.inOutCubic(prog(t, URL + 0.16, URL + 0.5));
    css(this.underline, 'transform', `scaleX(${pl.toFixed(4)})`);
    const pa = E.outBack(prog(t, URL + 0.38, URL + 0.62), 1.6);
    const nudge = Math.sin(clamp(prog(t, 26.0, 26.4)) * Math.PI) * 10;
    css(this.arrow, 'transform', `translate(${((1 - clamp(pa)) * -30 + nudge).toFixed(1)}px, ${(-nudge).toFixed(1)}px) scale(${clamp(pa, 0, 1.2).toFixed(3)})`);
    css(this.arrow, 'opacity', clamp(pa * 2).toFixed(3));
    const pc = E.outCubic(prog(t, URL + 0.55, URL + 0.95));
    css(this.loc, 'opacity', pc.toFixed(3)); css(this.loc, 'transform', `translateY(${((1 - pc) * 20).toFixed(1)}px)`);
  }
}
