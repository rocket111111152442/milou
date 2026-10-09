// Courbes en SVG, sans librairie : une série par graphique (jamais deux axes), ligne 2 px,
// grille discrète, réticule + infobulle au survol/toucher.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

function niceTicks(min, max, count = 4) {
  // Série plate : on ouvre l'échelle autour de la valeur pour éviter des graduations en double.
  if (max - min < Math.max(1, Math.abs(max) * 0.02)) { const pad = Math.max(2, Math.abs(max) * 0.1); min = Math.max(0, min - pad); max += pad; }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return ticks;
}

export function lineChart(container, points, { format = (v) => String(v), dateFormat, height = 200, label = '' } = {}) {
  container.innerHTML = '';
  container.style.position = 'relative';
  if (!points.length) { container.innerHTML = '<div class="empty small">Pas encore de données.</div>'; return; }
  const draw = () => {
    container.querySelectorAll('svg, .chart-tip').forEach((n) => n.remove());
    const W = Math.max(260, container.clientWidth), H = height;
    const pad = { l: 8, r: 8, t: 10, b: 22 };
    const ys = points.map((p) => p.y);
    const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const labelW = Math.max(...ticks.map((t) => format(t).length)) * 7 + 6;
    pad.l = labelW;
    const x0 = points[0].x, x1 = points[points.length - 1].x;
    const X = (x) => pad.l + (x1 === x0 ? (W - pad.l - pad.r) / 2 : ((x - x0) / (x1 - x0)) * (W - pad.l - pad.r));
    const Y = (y) => pad.t + (1 - (y - y0) / (y1 - y0 || 1)) * (H - pad.t - pad.b);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img', 'aria-label': label });
    for (const t of ticks) {
      svg.append(el('line', { x1: pad.l, x2: W - pad.r, y1: Y(t), y2: Y(t), class: 'c-grid' }));
      const tx = el('text', { x: pad.l - 6, y: Y(t) + 4, 'text-anchor': 'end', class: 'c-axis' });
      tx.textContent = format(t);
      svg.append(tx);
    }
    // Deux dates repères en bas (début, fin).
    for (const [x, anchor] of [[x0, 'start'], [x1, 'end']]) {
      const tx = el('text', { x: anchor === 'start' ? pad.l : W - pad.r, y: H - 6, 'text-anchor': anchor, class: 'c-axis' });
      tx.textContent = dateFormat(x);
      svg.append(tx);
    }
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
    if (points.length > 1) {
      svg.append(el('path', { d: `${d}L${X(x1).toFixed(1)},${Y(y0)}L${X(x0).toFixed(1)},${Y(y0)}Z`, class: 'c-area' }));
      svg.append(el('path', { d, class: 'c-line' }));
    }
    const last = points[points.length - 1];
    if (points.length === 1) {
      const note = el('text', { x: (pad.l + W - pad.r) / 2, y: pad.t + 14, 'text-anchor': 'middle', class: 'c-axis' });
      note.textContent = 'La courbe se remplit au fil des heures (un point par heure)';
      svg.append(note);
    }
    svg.append(el('circle', { cx: X(last.x), cy: Y(last.y), r: 4, class: 'c-dot' }));
    const cross = el('line', { y1: pad.t, y2: H - pad.b, class: 'c-cross', visibility: 'hidden' });
    const dot = el('circle', { r: 4.5, class: 'c-dot', visibility: 'hidden' });
    svg.append(cross, dot);
    const tip = document.createElement('div');
    tip.className = 'chart-tip hidden';
    container.append(svg, tip);
    const show = (ev) => {
      const r = svg.getBoundingClientRect();
      const mx = ((ev.clientX - r.left) / r.width) * W;
      let best = points[0];
      for (const p of points) if (Math.abs(X(p.x) - mx) < Math.abs(X(best.x) - mx)) best = p;
      cross.setAttribute('x1', X(best.x)); cross.setAttribute('x2', X(best.x)); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', X(best.x)); dot.setAttribute('cy', Y(best.y)); dot.setAttribute('visibility', 'visible');
      tip.innerHTML = `<b>${format(best.y)}</b><span>${dateFormat(best.x, true)}</span>`;
      tip.classList.remove('hidden');
      const left = (X(best.x) / W) * r.width;
      tip.style.left = Math.min(Math.max(0, left - 60), r.width - 120) + 'px';
    };
    const hide = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.classList.add('hidden'); };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', hide);
  };
  draw();
  const ro = new ResizeObserver(() => draw());
  ro.observe(container);
}
