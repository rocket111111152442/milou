// Génère le « papier peint fougère » de la Maison : un motif botanique raccordable
// (fougères, violettes, crosses et petites étoiles) dans l'esprit gravure de la carte de visite.
// Usage : node scripts/generate-patterns.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "patterns");
mkdirSync(out, { recursive: true });

const W = 900;
const H = 900;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n) => Math.round(n * 10) / 10;
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/** Fronde de fougère : rachis courbé + pennes lobées alternées. */
function fern({ x, y, angle, length, bend, seed }) {
  const r = rng(seed);
  const paths = [];
  const dir = [Math.cos(angle), Math.sin(angle)];
  const nor = [-dir[1], dir[0]];
  const at = (t) => [
    x + dir[0] * length * t + nor[0] * bend * length * t * t,
    y + dir[1] * length * t + nor[1] * bend * length * t * t,
  ];
  const tangent = (t) => {
    const a = at(Math.max(0, t - 0.01));
    const b = at(Math.min(1, t + 0.01));
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  // rachis
  let d = "";
  for (let i = 0; i <= 40; i++) {
    const p = at(i / 40);
    d += (i === 0 ? "M" : "L") + f(p[0]) + "," + f(p[1]);
  }
  paths.push({ d, w: 1.1 });

  const pairs = 15 + Math.floor(r() * 3);
  for (let i = 0; i < pairs; i++) {
    for (const side of [-1, 1]) {
      const t = 0.07 + (0.88 * (i + (side > 0 ? 0.5 : 0))) / pairs;
      if (t > 0.97) continue;
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.12)), 0.9);
      const l = length * 0.3 * env * (0.92 + r() * 0.12);
      if (l < 6) continue;
      const base = at(t);
      const tg = tangent(t);
      const spread = (62 - 30 * t) * (Math.PI / 180);
      const a = tg + side * spread;
      paths.push(pinna(base, a, l, side, r));
    }
  }
  // petite crosse au sommet
  const tip = at(1);
  paths.push(spiral(tip[0], tip[1], tangent(1), length * 0.035, 2.2));
  return paths;
}

/** Penne lobée (contour festonné + nervure). */
function pinna([px, py], a, l, side, r) {
  const w = l * 0.17;
  const k = Math.max(4, Math.round(l / 9));
  const curve = side * 0.12;
  const pt = (s, off) => {
    const lx = s * l;
    const ly = off + curve * l * s * s;
    const [rx, ry] = rot(lx, ly, a);
    return [px + rx, py + ry];
  };
  const width = (s) => w * Math.pow(1 - s, 0.55) * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, s + 0.25)));
  let d = "M" + f(px) + "," + f(py);
  // côté supérieur
  for (let j = 0; j < k; j++) {
    const s0 = j / k;
    const s1 = (j + 1) / k;
    const sm = (s0 + s1) / 2;
    const c = pt(sm, -width(sm) * 1.55);
    const e = pt(s1, -width(s1) * 0.55);
    d += "Q" + f(c[0]) + "," + f(c[1]) + " " + f(e[0]) + "," + f(e[1]);
  }
  const tipP = pt(1, 0);
  d += "L" + f(tipP[0]) + "," + f(tipP[1]);
  for (let j = k; j > 0; j--) {
    const s0 = j / k;
    const s1 = (j - 1) / k;
    const sm = (s0 + s1) / 2;
    const c = pt(sm, width(sm) * 1.55);
    const e = pt(s1, width(s1) * 0.55);
    d += "Q" + f(c[0]) + "," + f(c[1]) + " " + f(e[0]) + "," + f(e[1]);
  }
  d += "Z";
  // nervure
  const m0 = pt(0.05, 0);
  const m1 = pt(0.85, 0);
  const mc = pt(0.45, 0);
  d += "M" + f(m0[0]) + "," + f(m0[1]) + "Q" + f(mc[0]) + "," + f(mc[1]) + " " + f(m1[0]) + "," + f(m1[1]);
  return { d, w: 0.75 };
}

/** Crosse de fougère (spirale logarithmique). */
function spiral(x, y, a, size, turns) {
  let d = "";
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * turns * Math.PI * 2;
    const rr = size * Math.exp(-0.28 * th) * 1.8;
    const [rx, ry] = rot(Math.cos(th) * rr - size * 1.8, Math.sin(th) * rr, a);
    d += (i === 0 ? "M" : "L") + f(x + rx) + "," + f(y + ry);
  }
  return { d, w: 0.9 };
}

/** Crosse isolée avec tige. */
function fiddlehead({ x, y, angle, size }) {
  const paths = [];
  const [sx, sy] = rot(0, size * 5, angle);
  const [cx, cy] = rot(size * 1.6, size * 2.6, angle);
  paths.push({ d: `M${f(x)},${f(y)}Q${f(x + cx)},${f(y + cy)} ${f(x + sx)},${f(y + sy)}`, w: 1 });
  paths.push(spiral(x, y, angle - Math.PI / 2, size, 2.6));
  return paths;
}

function petal(l, w) {
  return `M0,0C${f(w * 0.7)},${f(-l * 0.1)} ${f(w * 1.15)},${f(-l * 0.92)} 0,${f(-l)}C${f(-w * 1.15)},${f(-l * 0.92)} ${f(-w * 0.7)},${f(-l * 0.1)} 0,0Z`;
}

function transform(d, x, y, a, s) {
  // applique rotation + échelle + translation à un chemin composé de commandes absolues M/C/Q/L/Z
  return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, px, py) => {
    const [rx, ry] = rot(parseFloat(px) * s, parseFloat(py) * s, a);
    return f(x + rx) + "," + f(y + ry);
  });
}

/** Violette : 5 pétales, stries, cœur, tige et feuilles en cœur. */
function violet({ x, y, angle, size, seed }) {
  const r = rng(seed);
  const paths = [];
  const petals = [
    { a: -24, l: 1, w: 0.36 },
    { a: 24, l: 1, w: 0.36 },
    { a: -92, l: 0.86, w: 0.33 },
    { a: 92, l: 0.86, w: 0.33 },
    { a: 180, l: 0.98, w: 0.44 },
  ];
  for (const p of petals) {
    const d = petal(p.l * 100, p.w * 100);
    paths.push({ d: transform(d, x, y, angle + (p.a * Math.PI) / 180, size / 100), w: 0.85 });
  }
  // stries du pétale inférieur
  for (let i = -2; i <= 2; i++) {
    const a = angle + Math.PI + i * 0.16;
    const [x1, y1] = rot(0, -size * 0.18, a);
    const [x2, y2] = rot(0, -size * (0.55 - Math.abs(i) * 0.08), a);
    paths.push({ d: `M${f(x + x1)},${f(y + y1)}L${f(x + x2)},${f(y + y2)}`, w: 0.5 });
  }
  paths.push({ d: `M${f(x + size * 0.09)},${f(y)}a${f(size * 0.09)},${f(size * 0.09)} 0 1,0 ${f(-size * 0.18)},0a${f(size * 0.09)},${f(size * 0.09)} 0 1,0 ${f(size * 0.18)},0`, w: 0.8 });
  // tige
  const stemLen = size * (2.4 + r() * 0.8);
  const sa = angle + Math.PI / 2 + (r() - 0.5) * 0.5;
  const end = [x + Math.cos(sa) * stemLen, y + Math.sin(sa) * stemLen];
  const ctrl = [x + Math.cos(sa + 0.35) * stemLen * 0.6, y + Math.sin(sa + 0.35) * stemLen * 0.6];
  paths.push({ d: `M${f(x)},${f(y)}Q${f(ctrl[0])},${f(ctrl[1])} ${f(end[0])},${f(end[1])}`, w: 0.9 });
  // feuilles en cœur
  for (const s of [-1, 1]) {
    if (r() < 0.25) continue;
    const la = sa + Math.PI + s * (0.9 + r() * 0.4);
    paths.push(...heartLeaf(end[0], end[1], la, size * (1.1 + r() * 0.4)));
  }
  return paths;
}

function heartLeaf(x, y, a, l) {
  const d =
    `M0,-8C-30,5 -62,-20 -50,-55C-40,-80 -10,-90 0,-100C10,-90 40,-80 50,-55C62,-20 30,5 0,-8Z` +
    `M0,-8L0,-92M0,-30Q-18,-38 -36,-30M0,-30Q18,-38 36,-30M0,-55Q-15,-62 -32,-62M0,-55Q15,-62 32,-62M0,-76Q-10,-80 -20,-84M0,-76Q10,-80 20,-84`;
  // orientation : la feuille pointe dans la direction a
  return [{ d: transform(d, x, y, a + Math.PI / 2, l / 100), w: 0.7 }];
}

function star(x, y, s) {
  return {
    d: `M${f(x)},${f(y - s)}Q${f(x + s * 0.12)},${f(y - s * 0.12)} ${f(x + s)},${f(y)}Q${f(x + s * 0.12)},${f(y + s * 0.12)} ${f(x)},${f(y + s)}Q${f(x - s * 0.12)},${f(y + s * 0.12)} ${f(x - s)},${f(y)}Q${f(x - s * 0.12)},${f(y - s * 0.12)} ${f(x)},${f(y - s)}Z`,
    w: 0.6,
  };
}

// --- composition du raccord (placement manuel + variations) ---
const deg = (v) => (v * Math.PI) / 180;

const groups = [];
const addGroup = (paths) => {
  // boîte englobante du groupe (coordonnées absolues uniquement)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of paths) {
    const re = /[MLQC ](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
    let m;
    while ((m = re.exec(p.d))) {
      const x = parseFloat(m[1]), y = parseFloat(m[2]);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  groups.push({ paths, box: [x0 - 4, y0 - 4, x1 + 4, y1 + 4] });
};
const fernsDef = [
  { x: 30, y: 890, angle: deg(-52), length: 600, bend: 0.16, seed: 11 },
  { x: 890, y: 520, angle: deg(-152), length: 440, bend: -0.2, seed: 23 },
  { x: 560, y: 905, angle: deg(-98), length: 300, bend: 0.22, seed: 37 },
  { x: 640, y: 300, angle: deg(-58), length: 330, bend: -0.18, seed: 41 },
  { x: 300, y: 250, angle: deg(-150), length: 280, bend: 0.25, seed: 53 },
];
for (const fd of fernsDef) addGroup(fern(fd));

const violetsDef = [
  { x: 700, y: 650, angle: deg(-8), size: 50, seed: 3 },
  { x: 780, y: 600, angle: deg(22), size: 36, seed: 4 },
  { x: 120, y: 120, angle: deg(10), size: 44, seed: 5 },
  { x: 420, y: 80, angle: deg(-14), size: 38, seed: 6 },
  { x: 90, y: 560, angle: deg(-6), size: 40, seed: 8 },
  { x: 360, y: 700, angle: deg(12), size: 34, seed: 9 },
];
for (const v of violetsDef) addGroup(violet(v));

addGroup(fiddlehead({ x: 470, y: 420, angle: deg(20), size: 13 }));
addGroup(fiddlehead({ x: 820, y: 120, angle: deg(-30), size: 11 }));
addGroup(fiddlehead({ x: 230, y: 420, angle: deg(10), size: 12 }));

const sr = rng(99);
for (let i = 0; i < 22; i++) {
  addGroup([star(sr() * W, sr() * H, 2 + sr() * 4.5)]);
}

function svg(stroke, opacity, bg) {
  const offsets = [-1, 0, 1];
  let body = "";
  for (const g of groups) {
    const [x0, y0, x1, y1] = g.box;
    for (const ox of offsets) {
      for (const oy of offsets) {
        // ne duplique que les groupes qui débordent du raccord
        if (x1 + ox * W < 0 || x0 + ox * W > W || y1 + oy * H < 0 || y0 + oy * H > H) continue;
        const tr = ox || oy ? ` transform="translate(${ox * W},${oy * H})"` : "";
        body += `<g${tr}>` + g.paths.map((el) => `<path d="${el.d}" stroke-width="${el.w}"/>`).join("") + `</g>`;
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    (bg ? `<rect width="${W}" height="${H}" fill="${bg}"/>` : "") +
    `<g fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`
  );
}

const variants = {
  "fougere-nuit.svg": svg("#B9A2CF", 0.55),
  "fougere-papier.svg": svg("#2A1735", 0.5),
  "fougere-or.svg": svg("#D9BC7E", 0.6),
};
for (const [name, content] of Object.entries(variants)) {
  writeFileSync(join(out, name), content);
  console.log(name, (content.length / 1024).toFixed(1) + " kB");
}
