// Pages rendues côté serveur (SEO) : fiche d'un bien, pages communes, plan du site, robots.txt.
// Les gabarits viennent de lib/templates.generated.js (généré par scripts/build-pages.mjs).
import '../public/cards.js';
import templates from './templates.generated.js';
import { robots as robotsMeta } from './layout.generated.js';
import { readBiens, publicBien, publicBiens, slug } from './biens.js';
import { readCommunes } from './communes.js';
import agence from '../config/agence.js';

const { esc, cardHTML, isClosed } = globalThis.AEICards;
const SITE = agence.siteUrl.replace(/\/$/, '');
const HTML = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600' };
const NOT_FOUND = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' };

// JSON placé dans une balise <script> : « < » échappé pour ne jamais fermer la balise
const jsonScript = (type, id, data) => `<script type="${type}"${id ? ` id="${id}"` : ''}>${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
const abs = (p) => (/^https?:/.test(p) ? p : `${SITE}/${String(p).replace(/^\//, '')}`);
const num = (s) => Number(String(s ?? '').replace(/[^\d,.]/g, '').replace(/\s/g, '').replace(',', '.')) || 0;

function head(html, { title, description, canonical, image, ld, extra = '' }) {
  const tags = [
    `<link rel="canonical" href="${esc(canonical)}">`,
    `<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(agence.nomCourt)}">`,
    `<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}">`,
    image ? `<meta property="og:image" content="${esc(abs(image))}"><meta name="twitter:card" content="summary_large_image">` : '',
    ld ? jsonScript('application/ld+json', '', ld) : '',
    extra,
  ].join('\n');
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`)
    .replace('</head>', `${tags}\n</head>`);
}

export async function renderBien(id) {
  const list = await readBiens();
  const b = list.find(x => x.id === id && x.publie);
  if (!b) {
    const html = head(templates.bien, { title: `Bien introuvable | ${agence.nomCourt}`, description: 'Ce bien n’est plus disponible.', canonical: `${SITE}/biens` })
      .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex, nofollow">');
    return new Response(html, { status: 404, headers: NOT_FOUND });
  }
  const pub = publicBien(b);
  const closed = isClosed(pub);
  const photos = pub.photos?.length ? pub.photos : pub.photo ? [pub.photo] : [];
  const title = `${pub.titre} – ${pub.ville} | ${agence.nomCourt}`;
  const description = `${pub.type || 'Bien'} à ${pub.ville}${pub.surface ? `, ${pub.surface} m²` : ''}${pub.prix && !closed ? `, ${pub.prix} €` : ''}. ${String(pub.description || '').replace(/\s+/g, ' ').slice(0, 130)}`.trim();
  const price = num(pub.prix);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: pub.titre,
    description: pub.description,
    url: `${SITE}/bien/${pub.id}`,
    image: photos.map(abs),
    price: price || undefined,
    priceCurrency: 'EUR',
    availability: closed ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
    seller: { '@type': 'RealEstateAgent', name: agence.nom, telephone: agence.telephone, address: { '@type': 'PostalAddress', streetAddress: agence.adresse, postalCode: agence.codePostal, addressLocality: agence.ville, addressCountry: 'FR' } },
    itemOffered: {
      '@type': pub.type === 'Appartement' ? 'Apartment' : 'SingleFamilyResidence',
      address: { '@type': 'PostalAddress', addressLocality: pub.ville, postalCode: pub.cp, addressCountry: 'FR' },
      floorSize: pub.surface ? { '@type': 'QuantitativeValue', value: num(pub.surface), unitCode: 'MTK' } : undefined,
      numberOfRooms: num(pub.pieces) || undefined,
    },
  };
  // Biens similaires fournis avec la fiche : une seule requête côté navigateur (pas besoin de /api/biens)
  const similar = publicBiens(list).filter(x => x.id !== pub.id);
  const html = head(templates.bien, {
    title, description, canonical: `${SITE}/bien/${pub.id}`, image: photos[0], ld,
    extra: jsonScript('application/json', 'bien-data', { bien: pub, all: similar }),
  });
  return new Response(html, { headers: HTML });
}

export async function renderVille(slugIn) {
  const { communes } = await readCommunes();
  const c = communes.find(x => x.slug === slugIn);
  if (!c) return new Response(head(templates.ville.replace('__BODY__', '<article class="container legal"><h1 class="h2">Page introuvable</h1><p><a href="/biens">Voir tous nos biens</a></p></article>'), { title: 'Page introuvable', description: '', canonical: `${SITE}/biens` }), { status: 404, headers: NOT_FOUND });
  const norm = (s) => slug(s);
  const biens = publicBiens(await readBiens()).filter(b => norm(b.ville) === c.slug);
  const dispo = biens.filter(b => !isClosed(b)), vendus = biens.filter(isClosed);
  const intro = String(c.intro || '').split(/\n{2,}|\n/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
  const body = `<article class="container ville">
  <nav class="crumbs" aria-label="Fil d'Ariane"><a href="/">Accueil</a><span>›</span><a href="/biens">Nos biens</a><span>›</span><span>${esc(c.nom)}</span></nav>
  <h1 class="h2">Immobilier à ${esc(c.nom)}</h1>
  ${intro || `<p>${esc(agence.nom)} vous accompagne pour acheter, vendre ou louer à ${esc(c.nom)}.</p>`}
  ${c.quartiers ? `<p><strong>Quartiers et secteurs :</strong> ${esc(c.quartiers)}</p>` : ''}
  <h2 class="block__title">${dispo.length ? `${dispo.length} bien${dispo.length > 1 ? 's' : ''} à ${esc(c.nom)}` : `Aucun bien disponible à ${esc(c.nom)} pour le moment`}</h2>
  ${dispo.length ? `<div class="grid-biens">${dispo.map(cardHTML).join('')}</div>` : '<p>Créez une <a href="/#alertes">alerte</a> pour être prévenu(e) dès qu’un bien est publié, ou <a href="/#estimation">faites estimer</a> votre bien.</p>'}
  ${vendus.length ? `<h2 class="block__title">Récemment vendus ou loués</h2><div class="grid-biens">${vendus.slice(0, 6).map(cardHTML).join('')}</div>` : ''}
  <p class="ville__cta"><a class="btn btn--gold" href="/#estimation">Estimer mon bien à ${esc(c.nom)}</a> <a class="btn btn--outline" href="/#contact">Contacter l’agence</a></p>
</article>`;
  const title = `Immobilier à ${c.nom} – agence immobilière | ${agence.nomCourt}`;
  const description = `Achat, vente, location et estimation à ${c.nom}${c.cp ? ` (${c.cp})` : ''} avec ${agence.nom}. ${dispo.length} bien${dispo.length > 1 ? 's' : ''} disponible${dispo.length > 1 ? 's' : ''}.`;
  const html = head(templates.ville.replace('__BODY__', body).replace(/__[A-Z]+__/g, ''), { title, description, canonical: `${SITE}/immobilier/${c.slug}` });
  return new Response(html, { headers: HTML });
}

export async function sitemap() {
  const biens = publicBiens(await readBiens());
  const { communes } = await readCommunes();
  const urls = [
    ['/', 1], ['/biens', .9], ['/agences.html', .5], ['/honoraires.html', .4], ['/espace-client.html', .3],
    ...communes.map(c => [`/immobilier/${c.slug}`, .7]),
    ...biens.map(b => [`/bien/${b.id}`, isClosed(b) ? .3 : .8]),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, p]) => `<url><loc>${SITE}${u}</loc><priority>${p}</priority></url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=3600' } });
}

export function robots() {
  const body = agence.indexable
    ? `User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${SITE}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
