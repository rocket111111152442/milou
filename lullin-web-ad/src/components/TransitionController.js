import { h, show, css } from '../engine/dom.js';
import { scene } from '../engine/time.js';

/** Liste des repères sonores déclarés par les scènes (lue par le script audio : un seul référentiel temporel). */
export const CUES = [];
export function cue(time, type, params = {}) { CUES.push({ time: +time.toFixed(5), type, ...params }); }

/** Classe de base : une scène possède une fenêtre active (avec recouvrements avant/après pour les transitions). */
export class Scene {
  constructor(stage, id, { pre = 0, post = 0, z = 1 } = {}) {
    const s = scene(id);
    this.id = id; this.start = s.start; this.end = s.end; this.pre = pre; this.post = post;
    this.root = h('section', { class: 'scene', id });
    this.root.style.zIndex = z;
    stage.append(this.root);
  }
  active(t) { return t >= this.start - this.pre && t < this.end + this.post; }
  update(t) {
    const a = this.active(t);
    show(this.root, a);
    if (a) this.render(t, t - this.start);
  }
  render() {}
}

/** Effets globaux : flash crème, vignettage, vibration. */
export class GlobalFX {
  constructor(stage) {
    this.el = h('div', { id: 'fx' }, h('div', { id: 'vignette' }), h('div', { id: 'flash' }));
    stage.append(this.el);
    this.flashEl = this.el.querySelector('#flash');
    this.flashes = [];
  }
  addFlash(time, peak = 0.9, decay = 0.22, color = 'var(--cream)') { this.flashes.push({ time, peak, decay, color }); }
  update(t) {
    let o = 0, col = 'var(--cream)';
    for (const f of this.flashes) {
      const d = t - f.time;
      if (d >= -1 / 60 && d < f.decay) {
        const v = d < 0 ? f.peak * 0.5 : f.peak * Math.pow(1 - d / f.decay, 2.4);
        if (v > o) { o = v; col = f.color; }
      }
    }
    css(this.flashEl, 'opacity', o.toFixed(3));
    css(this.flashEl, 'background', col);
  }
}
