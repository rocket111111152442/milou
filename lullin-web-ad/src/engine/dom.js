// Petits utilitaires DOM : création d'éléments et écriture de styles sans réallocation inutile.
export function h(tag, props = {}, ...children) {
  const svgTags = new Set(['svg', 'path', 'g', 'rect', 'circle', 'line', 'polyline', 'polygon', 'defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'stop', 'text', 'use', 'filter', 'feGaussianBlur']);
  const el = svgTags.has(tag) ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

/** Écrit un style seulement s'il a changé (le navigateur recalcule moins). */
export function css(el, prop, value) {
  const key = '__' + prop;
  if (el[key] === value) return;
  el[key] = value;
  if (prop.startsWith('--')) el.style.setProperty(prop, value);
  else el.style[prop] = value;
}

export const px = (v) => `${v.toFixed(2)}px`;
export const tr3 = ({ x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sx = 1, sy = 1 } = {}) =>
  `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) rotateZ(${rz.toFixed(3)}deg) scale3d(${(s * sx).toFixed(4)},${(s * sy).toFixed(4)},1)`;
export const tr2 = ({ x = 0, y = 0, rz = 0, s = 1, sx = 1, sy = 1 } = {}) =>
  `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${rz.toFixed(3)}deg) scale(${(s * sx).toFixed(4)},${(s * sy).toFixed(4)})`;

export function show(el, visible) { css(el, 'display', visible ? '' : 'none'); }
