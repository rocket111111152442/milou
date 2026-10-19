// Pages HTML rendues côté serveur. vercel.json redirige /bien/:id, /immobilier/:slug, /sitemap.xml, /robots.txt vers /api/ssr/…
import { renderBien, renderVille, sitemap, robots } from '../ssr.js';

export default [
  ['GET', '/ssr/bien/:id', ({ params }) => renderBien(params.id), { skipOrigin: true }],
  ['GET', '/ssr/ville/:slug', ({ params }) => renderVille(params.slug), { skipOrigin: true }],
  ['GET', '/ssr/sitemap', () => sitemap(), { skipOrigin: true }],
  ['GET', '/ssr/robots', () => robots(), { skipOrigin: true }],
];
