import { h } from '../engine/dom.js';
import { logoSVG, wordmark } from './BrandLogo.js';
import { contourField } from './AnimatedGrid.js';
import { arrowSVG } from './UIComponents.js';

// Reconstruction vectorielle de la page d'accueil réelle de lullin-web.com (textes, polices, couleurs et mise en page
// relevés sur le site le 21/10/2026). Repère : 1440 px de large, héros 900 px + section « Nos expertises » 900 px.
// Chaque bloc est un calque séparé pour permettre la décomposition en profondeur.

export const SITE_W = 1440, SITE_H = 1800;
export const SITE_MARK = { x: 1150, y: 500, size: 300 };
export const SERVICES = ['Création de sites', 'Référencement SEO', 'Réseaux sociaux', 'Photographie', 'Vidéo'];

const T = (text, style) => { const d = h('div', { class: 'abs' }, text); Object.assign(d.style, { whiteSpace: 'nowrap', ...style }); return d; };

export function buildSite({ contourSeed = 5 } = {}) {
  const page = h('div', { class: 'node site', style: { width: `${SITE_W}px`, height: `${SITE_H}px` } });
  const layer = (name) => { const l = h('div', { class: 'node', 'data-layer': name, style: { width: `${SITE_W}px`, height: `${SITE_H}px` } }); page.append(l); return l; };

  // 0 — fond + courbes de niveau
  const bg = layer('bg');
  bg.append(h('div', { class: 'abs', style: { width: `${SITE_W}px`, height: '900px', background: '#111211' } }));
  bg.append(h('div', { class: 'abs', style: { top: '900px', width: `${SITE_W}px`, height: '900px', background: '#161815' } }));
  bg.append(contourField(SITE_W, 900, { seed: contourSeed }));
  bg.append(h('div', { class: 'abs', style: { top: '899px', width: `${SITE_W}px`, height: '2px', background: 'rgba(255,255,255,0.08)' } }));

  // 1 — en-tête
  const header = layer('header');
  const lock = h('div', { class: 'abs', style: { left: '62px', top: '27px', display: 'flex', alignItems: 'center', gap: '12px' } }, logoSVG(44), wordmark(36));
  header.append(lock);
  ['Expertises', 'Réalisations', 'L’agence', 'Offres', 'Blog'].forEach((n, i) => header.append(T(n, { left: `${493 + [0, 119, 228, 317, 389][i]}px`, top: '40px', font: '500 15px var(--body)', color: '#e6e5dc' })));
  header.append(h('div', { class: 'abs', style: { left: '1166px', top: '28px', width: '216px', height: '44px', borderRadius: '22px', border: '1.5px solid rgba(240,240,232,0.45)' } }));
  header.append(T('Parlons de votre projet', { left: '1186px', top: '40px', font: '500 14px var(--body)', color: '#f0f0e8' }));
  const ha = arrowSVG(16, '#f0f0e8', 2); Object.assign(ha.style, { position: 'absolute', left: '1344px', top: '42px' }); header.append(ha);
  header.append(h('div', { class: 'abs', style: { top: '99px', width: `${SITE_W}px`, height: '1.5px', background: 'rgba(255,255,255,0.12)' } }));

  // 2 — accroche + titre
  const title = layer('title');
  title.append(h('div', { class: 'abs', style: { left: '89px', top: '177px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' } }));
  title.append(T('CRÉATION DE SITES INTERNET SUR MESURE   |   DESIGN & DÉVELOPPEMENT', { left: '106px', top: '173px', font: '500 12px var(--body)', letterSpacing: '0.12em', color: '#e6e5dc', whiteSpace: 'pre' }));
  const h1 = h('div', { class: 'abs', style: { left: '88px', top: '236px', font: '500 112px/1.02 var(--heading)', letterSpacing: '-0.075em', color: 'var(--paper)' } },
    h('div', {}, 'Votre site'), h('div', {}, 'professionnel,'), h('div', { style: { color: 'var(--accent)' } }, 'simplement.'));
  title.append(h1);

  // 3 — paragraphe + bouton
  const cta = layer('cta');
  cta.append(h('div', { class: 'abs', style: { left: '89px', top: '618px', width: '260px', font: '400 16px/27px var(--body)', color: '#c5cbb9' } }, 'Un site moderne, rapide et adapté à votre activité, sans devoir investir plusieurs milliers d’euros.'));
  const btn = h('div', { class: 'abs', style: { left: '378px', top: '636px', width: '224px', height: '58px', borderRadius: '29px', background: 'var(--accent)' } });
  btn.append(T('Demander un devis', { left: '24px', top: '18px', font: '600 15px var(--body)', color: '#111211' }));
  const bc = h('div', { class: 'abs', style: { left: '172px', top: '6px', width: '46px', height: '46px', borderRadius: '50%', background: '#111211', display: 'grid', placeItems: 'center' } }, arrowSVG(18, 'var(--accent)', 2.2));
  btn.append(bc); cta.append(btn);

  // 4 — visuel (symbole officiel)
  const visual = layer('visual');
  visual.append(h('div', { class: 'abs', style: { left: `${SITE_MARK.x - 330}px`, top: `${SITE_MARK.y - 330}px`, width: '660px', height: '660px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(194,249,58,0.16), rgba(194,249,58,0) 100%)' } }));
  const mark = logoSVG(SITE_MARK.size); Object.assign(mark.style, { position: 'absolute', left: `${SITE_MARK.x - SITE_MARK.size / 2}px`, top: `${SITE_MARK.y - SITE_MARK.size / 2}px` });
  visual.append(mark);
  visual.append(T('SUR MESURE, JUSQU’AU DÉTAIL', { left: '958px', top: '680px', font: '500 11px var(--body)', letterSpacing: '0.1em', color: '#c5cbb9' }));

  // 5 — bas du héros
  const foot = layer('foot');
  foot.append(T('DÉCOUVRIR NOS OFFRES', { left: '89px', top: '777px', font: '500 12px var(--body)', letterSpacing: '0.12em', color: '#e6e5dc' }));
  foot.append(T('[ L / W — 2026 ]', { left: '1262px', top: '777px', font: '400 11px var(--body)', letterSpacing: '0.14em', color: '#a4a79d' }));

  // 6 — section « Nos expertises » (intitulés réels des services)
  const sec = layer('section');
  sec.append(T('01 — NOS EXPERTISES', { left: '89px', top: '1010px', font: '500 13px var(--body)', letterSpacing: '0.16em', color: '#a4a79d' }));
  sec.append(h('div', { class: 'abs', style: { left: '88px', top: '1050px', font: '500 92px/1.02 var(--heading)', letterSpacing: '-0.06em', color: 'var(--paper)' } }, h('div', {}, 'Nos expertises'), h('div', { style: { color: 'var(--accent)' } }, 'digitales.')));
  const cards = [];
  SERVICES.forEach((name, i) => {
    const x = 89 + (i % 3) * 430, y = 1300 + Math.floor(i / 3) * 230;
    const c = h('div', { class: 'abs', style: { left: `${x}px`, top: `${y}px`, width: '410px', height: '210px', borderRadius: '22px', background: '#1d201b', border: '1.5px solid rgba(255,255,255,0.1)' } });
    c.append(T(`0${i + 1}`, { left: '28px', top: '26px', font: '500 14px var(--body)', letterSpacing: '0.1em', color: 'var(--accent)' }));
    c.append(T(name, { left: '28px', top: '120px', font: '500 34px var(--heading)', letterSpacing: '-0.04em', color: 'var(--paper)' }));
    const a = arrowSVG(22, '#f0f0e8', 2); Object.assign(a.style, { position: 'absolute', right: '26px', top: '26px' }); c.append(a);
    sec.append(c); cards.push(c);
  });

  return { page, layers: { bg, header, title, cta, visual, foot, section: sec }, cards, h1 };
}
