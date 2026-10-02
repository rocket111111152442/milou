// PROVISOIRE — génère des logos de remplacement tant que les vrais SVG ne sont pas dans public/.
// Ne s'exécute que si les fichiers n'existent pas (ne JAMAIS écraser les vrais logos).
import fs from 'fs';
import opentype from 'opentype.js';
const ink = '#ECE8E1';
const iconPath = 'public/hors-champ-icone-clair.svg', logoPath = 'public/hors-champ-logo-clair.svg';

// Diaphragme 6 lames (même géométrie que src/Aperture.tsx à ouverture 0.42)
function iris(cx, cy, R, open) {
  const n = 6, r = R * open, parts = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2 - Math.PI / 2;
    const p = [cx + r * Math.cos(th), cy + r * Math.sin(th)];
    const d = [-Math.sin(th), Math.cos(th)], o = [Math.cos(th), Math.sin(th)];
    const a = [p[0] - d[0] * R * 0.15, p[1] - d[1] * R * 0.15];
    const b = [p[0] + d[0] * R * 1.25, p[1] + d[1] * R * 1.25];
    const c = [b[0] + o[0] * R, b[1] + o[1] * R];
    const e = [a[0] + o[0] * R, a[1] + o[1] * R];
    parts.push(`M${a.map(v => v.toFixed(2))}L${b.map(v => v.toFixed(2))}L${c.map(v => v.toFixed(2))}L${e.map(v => v.toFixed(2))}Z`);
  }
  return parts;
}
function iconGroup(cx, cy, R) {
  const id = `clip${Math.round(cx)}`;
  return `<defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath></defs>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${ink}" stroke-width="${R * 0.07}"/>
  <g clip-path="url(#${id})" fill="none" stroke="${ink}" stroke-width="${R * 0.045}" stroke-linejoin="round">
    ${iris(cx, cy, R, 0.42).map(d => `<path d="${d}"/>`).join('\n    ')}
  </g>`;
}
if (!fs.existsSync(iconPath)) {
  fs.writeFileSync(iconPath, `<!-- PLACEHOLDER : remplacer par le vrai fichier hors-champ-icone-clair.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  ${iconGroup(100, 100, 92)}
</svg>`);
  console.log('placeholder icon written');
}
if (!fs.existsSync(logoPath)) {
  const b = fs.readFileSync('.cache/Montserrat-800.ttf'); const font = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const size = 120, word = 'HORS-CHAMP';
  const path = font.getPath(word, 0, 0, size, { letterSpacing: 0.06 });
  const bb = path.getBoundingBox();
  const iconR = 64, gap = 44, tx = iconR * 2 + gap - bb.x1, ty = -bb.y1 + (iconR * 2 - (bb.y2 - bb.y1)) / 2;
  const w = iconR * 2 + gap + (bb.x2 - bb.x1), h = iconR * 2;
  fs.writeFileSync(logoPath, `<!-- PLACEHOLDER : remplacer par le vrai fichier hors-champ-logo-clair.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ${(w + 8).toFixed(1)} ${(h + 8).toFixed(1)}" width="${(w + 8).toFixed(0)}" height="${(h + 8).toFixed(0)}">
  ${iconGroup(iconR, iconR, iconR - 4)}
  <path transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)})" fill="${ink}" d="${path.toPathData(2)}"/>
</svg>`);
  console.log('placeholder logo written');
}
