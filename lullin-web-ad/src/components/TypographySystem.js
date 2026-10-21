import { h, css } from '../engine/dom.js';

/**
 * Titre composé de lignes et de mots, chaque mot dans son propre masque.
 * lines : [['VOTRE', 'SITE'], [{ t: 'MIEUX.', accent: true }]]
 */
export class Headline {
  constructor(parent, { lines, size = 140, weight = 700, tracking = -0.045, lineHeight = 0.94, align = 'left',
    x = 80, y = 400, maxWidth = 900, color = 'var(--paper)', font = 'var(--heading)', upper = true }) {
    this.el = h('div', { class: 'headline' });
    Object.assign(this.el.style, {
      left: `${x}px`, top: `${y}px`, fontSize: `${size}px`, fontWeight: weight, letterSpacing: `${tracking}em`,
      lineHeight, textAlign: align, color, fontFamily: font, textTransform: upper ? 'uppercase' : 'none',
    });
    this.size = size; this.align = align; this.x = x; this.maxWidth = maxWidth;
    this.words = [];
    this.lines = lines.map((ln, li) => {
      const lineEl = h('div', { class: 'line' });
      ln.forEach((w, wi) => {
        const spec = typeof w === 'string' ? { t: w } : w;
        const inner = h('span', { class: 'w-inner' }, spec.t);
        const mask = h('span', { class: 'w-mask' }, inner);
        if (spec.accent) inner.style.color = 'var(--accent)';
        if (wi > 0) lineEl.append(document.createTextNode(' '));
        lineEl.append(mask);
        this.words.push({ mask, inner, spec, line: li });
      });
      this.el.append(lineEl);
      return lineEl;
    });
    parent.append(this.el);
  }
  /** Réduit la taille si une ligne dépasse la largeur utile (polices déjà chargées). */
  fit() {
    const w = Math.max(...this.lines.map((l) => l.scrollWidth));
    if (w > this.maxWidth) {
      this.size = this.size * this.maxWidth / w;
      this.el.style.fontSize = `${this.size}px`;
    }
    if (this.align === 'center') {
      this.el.style.left = `${this.x - this.el.offsetWidth / 2}px`;
    }
    return this;
  }
  /** État d'un mot : y en fraction de la hauteur du masque (1 = caché dessous, -1 = sorti dessus). */
  word(i, { y = 0, x = 0, s = 1, o = 1, color = null, skew = 0 } = {}) {
    const w = this.words[i];
    css(w.inner, 'transform', `translate3d(${x.toFixed(2)}px, ${(y * 135).toFixed(3)}%, 0) scale(${s.toFixed(4)}) skewX(${skew.toFixed(2)}deg)`);
    // Fondu sur les 30 % extrêmes de la course (≈ 1 image) : aucune lettre ne dépasse du masque.
    css(w.inner, 'opacity', (o * Math.min(1, Math.max(0, (1 - Math.abs(y)) / 0.3))).toFixed(3));
    if (color !== null) css(w.inner, 'color', color);
  }
  set(props) { for (const [k, v] of Object.entries(props)) css(this.el, k, v); }
}

/** Ligne de texte simple (labels techniques, sous-titres). */
export function label(parent, text, style = {}, cls = 'label') {
  const el = h('div', { class: `${cls} abs` }, text);
  Object.assign(el.style, style);
  parent.append(el);
  return el;
}
