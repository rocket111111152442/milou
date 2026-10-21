import { h } from '../engine/dom.js';

// Pictogrammes et éléments d'interface schématiques. Tout est vectoriel : net à toutes les échelles.

/** Pointeur de souris (forme classique), rempli lime avec contour sombre. */
export function cursorSVG(size = 200) {
  return h('svg', { viewBox: '-2 -2 24 34', width: size * 24 / 34, height: size, class: 'cursor', style: { overflow: 'visible' } },
    h('path', { d: 'M0 0 L0 24.5 L6.2 18.6 L10.4 28.4 L14.6 26.6 L10.5 17 L18.6 17 Z', fill: 'var(--lime)', stroke: '#0b0b0a', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }));
}

/** Flèche diagonale (↗), comme sur les boutons du site. */
export function arrowSVG(size = 40, color = 'currentColor', stroke = 2.4) {
  return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: color, 'stroke-width': stroke, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    h('path', { d: 'M7 17 L17 7' }), h('path', { d: 'M8.5 7 H17 V15.5' }));
}

export function arrowRightSVG(size = 40, color = 'currentColor', stroke = 2.4) {
  return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: color, 'stroke-width': stroke, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    h('path', { d: 'M4 12 H19' }), h('path', { d: 'M13 6 L19 12 L13 18' }));
}

export function cartSVG(size = 48, color = 'currentColor') {
  return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: color, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    h('path', { d: 'M2.5 3.5 H5 L7.4 14.6 A1.6 1.6 0 0 0 9 15.8 H17.6 A1.6 1.6 0 0 0 19.2 14.6 L20.8 7.4 H6' }),
    h('circle', { cx: 9.4, cy: 20, r: 1.4 }), h('circle', { cx: 17.2, cy: 20, r: 1.4 }));
}

export function searchSVG(size = 48, color = 'currentColor', stroke = 2) {
  return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: color, 'stroke-width': stroke, 'stroke-linecap': 'round' },
    h('circle', { cx: 10.5, cy: 10.5, r: 6.5 }), h('path', { d: 'M15.5 15.5 L21 21' }));
}

export function playSVG(size = 48, color = 'currentColor') {
  return h('svg', { viewBox: '0 0 24 24', width: size, height: size },
    h('path', { d: 'M8 5.5 L19 12 L8 18.5 Z', fill: color, 'stroke-linejoin': 'round', stroke: color, 'stroke-width': 1.5 }));
}

export function heartSVG(size = 40, color = 'currentColor') {
  return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: color, 'stroke-width': 1.9, 'stroke-linejoin': 'round' },
    h('path', { d: 'M12 20 C5 15.5 2.5 12 2.5 8.6 A4.6 4.6 0 0 1 12 6.4 A4.6 4.6 0 0 1 21.5 8.6 C21.5 12 19 15.5 12 20 Z' }));
}

export function sendSVG(size = 40, color = 'currentColor') {
  return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: color, 'stroke-width': 1.9, 'stroke-linejoin': 'round' },
    h('path', { d: 'M21 3 L10.5 13.5' }), h('path', { d: 'M21 3 L14.5 21 L10.5 13.5 L3 9.5 Z' }));
}

export function menuSVG(size = 40, color = 'currentColor') {
  return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round' },
    h('path', { d: 'M4 7 H20' }), h('path', { d: 'M4 12 H20' }), h('path', { d: 'M4 17 H20' }));
}

/** Coins de verrouillage (repères de sélection) en lime. */
export function lockCorners(w, hgt, len = 26, stroke = 4, color = 'var(--lime)') {
  const d = `M0 ${len} V0 H${len} M${w - len} 0 H${w} V${len} M${w} ${hgt - len} V${hgt} H${w - len} M${len} ${hgt} H0 V${hgt - len}`;
  return h('svg', { width: w, height: hgt, viewBox: `0 0 ${w} ${hgt}`, style: { overflow: 'visible', position: 'absolute', left: 0, top: 0 } },
    h('path', { d, fill: 'none', stroke: color, 'stroke-width': stroke, 'stroke-linecap': 'square' }));
}

/** Rectangle absolu (div). */
export function box(parent, { x, y, w, h: hh, cls = '', style = {} }, ...children) {
  const el = h('div', { class: cls }, ...children);
  Object.assign(el.style, { position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px`, ...style });
  parent.append(el);
  return el;
}
