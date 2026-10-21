// Courbes d'animation. Aucune interpolation linéaire par défaut : chaque mouvement choisit sa courbe.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Progression normalisée de t entre a et b, bornée à [0,1]. */
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const mix = (a, b, t) => Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], t)) : lerp(a, b, t);

/** Équivalent exact de cubic-bezier() CSS. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(u) - x;
      if (Math.abs(e) < 1e-6) break;
      const d = dx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    let lo = 0, hi = 1;
    for (let i = 0; i < 30 && Math.abs(sx(u) - x) > 1e-6; i++) {
      if (sx(u) < x) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return sy(u);
  };
}

export const E = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) => t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outCirc: (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  /** Léger dépassement de la cible puis retour (objets importants). */
  outBack: (t, s = 1.2) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.4) => (s + 1) * t * t * t - s * t * t,
  /** Courbe maison du site lullin-web.com (--ease). */
  brand: bezier(0.22, 1, 0.36, 1),
  /** Accélération courte, déplacement contrôlé, décélération rapide. */
  snap: bezier(0.7, 0, 0.12, 1),
  whip: bezier(0.83, 0, 0.17, 1),
};

/** Stabilisation amortie : dépasse légèrement puis se pose (pas de rebond excessif). */
export function settle(t, overshoot = 0.08, cycles = 1.15) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const base = E.outExpo(t);
  const wobble = Math.sin(t * Math.PI * 2 * cycles) * overshoot * Math.pow(1 - t, 2.2) * (t < 0.12 ? t / 0.12 : 1);
  return base + wobble;
}

/**
 * Interpolation par images-clés. keys = [[temps, valeur, easeVersCetteClé?], ...]
 * La valeur peut être un nombre ou un tableau de nombres.
 */
export function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, ease = E.inOutCubic] = keys[i];
    const [t0, v0] = keys[i - 1];
    if (t <= t1) return mix(v0, v1, ease(prog(t, t0, t1)));
  }
  return keys[keys.length - 1][1];
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même image à chaque rendu. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
