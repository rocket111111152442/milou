import { h } from '../engine/dom.js';
import { rng } from '../engine/ease.js';

/**
 * Courbes de niveau procédurales (motif topographique présent sur lullin-web.com), calculées par marching squares
 * sur un bruit de valeur déterministe. Retourne un <svg> vectoriel.
 */
export function contourField(w, hh, { cell = 14, levels = 11, seed = 3, color = '#5c6b45', opacity = 0.55, width = 1.3, scale = 340 } = {}) {
  const r = rng(seed);
  const G = 64; const grid = Array.from({ length: G * G }, () => r());
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const g = (i, j) => grid[((j % G + G) % G) * G + ((i % G + G) % G)];
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  const f = (x, y) => noise(x / scale, y / scale) * 0.62 + noise(x / scale * 2.1 + 17, y / scale * 2.1 + 9) * 0.28 + noise(x / scale * 4.3 + 3, y / scale * 4.3 + 31) * 0.1;
  const nx = Math.ceil(w / cell) + 1, ny = Math.ceil(hh / cell) + 1;
  const v = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = f(i * cell, j * cell);
  let d = '';
  for (let L = 1; L <= levels; L++) {
    const iso = 0.18 + (L / (levels + 1)) * 0.64;
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = v[j * nx + i], b = v[j * nx + i + 1], c = v[(j + 1) * nx + i + 1], e = v[(j + 1) * nx + i];
      const idx = (a > iso) | ((b > iso) << 1) | ((c > iso) << 2) | ((e > iso) << 3);
      if (idx === 0 || idx === 15) continue;
      const x0 = i * cell, y0 = j * cell;
      const top = [x0 + cell * (iso - a) / (b - a), y0];
      const right = [x0 + cell, y0 + cell * (iso - b) / (c - b)];
      const bottom = [x0 + cell * (iso - e) / (c - e), y0 + cell];
      const left = [x0, y0 + cell * (iso - a) / (e - a)];
      const seg = { 1: [left, top], 2: [top, right], 3: [left, right], 4: [right, bottom], 5: [left, top, right, bottom], 6: [top, bottom], 7: [left, bottom],
        8: [left, bottom], 9: [top, bottom], 10: [left, bottom, top, right], 11: [right, bottom], 12: [left, right], 13: [top, right], 14: [left, top] }[idx];
      for (let k = 0; k < seg.length; k += 2) d += `M${seg[k][0].toFixed(1)} ${seg[k][1].toFixed(1)}L${seg[k + 1][0].toFixed(1)} ${seg[k + 1][1].toFixed(1)}`;
    }
  }
  return h('svg', { width: w, height: hh, viewBox: `0 0 ${w} ${hh}`, style: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' } },
    h('path', { d, fill: 'none', stroke: color, 'stroke-width': width, opacity, 'stroke-linecap': 'round' }));
}

/** Grille de colonnes (guides de mise en page). */
export function columnGrid(x, y, w, hh, cols = 12, gutter = 20, color = 'var(--lime)') {
  const el = h('div', { class: 'abs', style: { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px` } });
  const cw = (w - gutter * (cols - 1)) / cols;
  for (let i = 0; i < cols; i++) {
    el.append(h('div', { class: 'abs', style: { left: `${i * (cw + gutter)}px`, top: 0, width: `${cw}px`, height: '100%', borderLeft: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}`, background: 'rgba(194,249,58,0.035)' } }));
  }
  return el;
}
