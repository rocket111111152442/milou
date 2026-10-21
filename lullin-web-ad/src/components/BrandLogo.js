import { h } from '../engine/dom.js';

/**
 * Symbole officiel Lullin Web. Les tracés sont lus dans le fichier fourni par le site (assets/logo/lullin-mark.svg),
 * jamais redessinés. Ordre des pièces dans le fichier :
 *  0 : colonne en Z (crème)  1 : branche haute droite (lime)  2 : branche basse gauche (crème)
 *  3 : branche verticale haute (crème)  4 : branche verticale basse (crème)
 */
export const LOGO_VIEWBOX = 1237;
export let LOGO_PATHS = [];

export async function loadLogo() {
  const txt = await (await fetch('/assets/logo/lullin-mark.svg')).text();
  const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
  LOGO_PATHS = [...doc.querySelectorAll('path')].map((p) => ({
    d: p.getAttribute('d'),
    fill: p.getAttribute('fill'),
    transform: p.getAttribute('transform'),
  }));
  return LOGO_PATHS;
}

/** Symbole complet en SVG vectoriel (couleurs exactes du fichier). */
export function logoSVG(size, { cls = '', only = null } = {}) {
  const svg = h('svg', { viewBox: `0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`, width: size, height: size, class: `logo ${cls}` });
  LOGO_PATHS.forEach((p, i) => {
    if (only && !only.includes(i)) return;
    svg.append(h('path', { d: p.d, fill: p.fill, transform: p.transform, 'data-piece': i }));
  });
  return svg;
}

/** Une pièce isolée, dans le repère complet du logo (permet de la réassembler au pixel près). */
export function logoPieceSVG(i, size, fill = null) {
  const p = LOGO_PATHS[i];
  const svg = h('svg', { viewBox: `0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`, width: size, height: size, class: 'logo-piece' });
  svg.append(h('path', { d: p.d, fill: fill || p.fill, transform: p.transform }));
  return svg;
}

/** Wordmark officiel tel qu'utilisé sur lullin-web.com : « lullin » 600 crème + « web » 400 accent, Space Grotesk. */
export function wordmark(fontSize) {
  return h('span', { class: 'wordmark', style: { fontSize: `${fontSize}px` } }, 'lullin', h('span', {}, 'web'));
}
