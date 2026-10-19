// Génère les pages secondaires (mentions légales, confidentialité, cookies, honoraires, espace client)
// à partir de config/agence.js et des gabarits de scripts/pages/, et recopie l'en-tête et le pied de page
// de public/index.html dans toutes les pages (repères <!-- layout:… -->).
// Usage : node scripts/build-pages.mjs   (à relancer après toute modification de la config ou de l'accueil)
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import agence from '../config/agence.js';

const ROOT = new URL('..', import.meta.url).pathname;
const PUB = join(ROOT, 'public');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const index = await readFile(join(PUB, 'index.html'), 'utf8');
const block = (name) => {
  const m = index.match(new RegExp(`<!-- layout:${name} -->[\\s\\S]*?<!-- /layout:${name} -->`));
  if (!m) throw new Error(`Repère layout:${name} introuvable dans index.html`);
  // Depuis une autre page, les ancres de l'accueil deviennent /#…
  return m[0].replace(/href="#(?!top")([\w-]+)"/g, 'href="/#$1"').replace('href="#top" aria-label', 'href="/" aria-label').replace('<a class="logo logo--light" href="#top">', '<a class="logo logo--light" href="/">');
};
const header = block('header');
const footer = block('footer');

// Valeur de la config ; les mentions « À compléter » sont mises en évidence
const val = (path) => {
  const v = path.split('.').reduce((o, k) => o?.[k], agence);
  if (v === undefined) throw new Error(`Clé de configuration inconnue : ${path}`);
  const s = esc(v);
  return /^À compléter/.test(String(v)) ? `<mark class="todo">${s}</mark>` : s;
};
const fill = (tpl) => tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => val(k));

const shell = ({ title, description, body, scripts = '' }) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | ${esc(agence.nomCourt)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#1e146a">
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="/fonts/fonts.css">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/bien.css">
<link rel="stylesheet" href="/pages.css">
</head>
<body class="page-bien page-simple">
<div class="progress" aria-hidden="true"></div>

${header}

<main id="main">
${body}
</main>

${footer}

<script src="/favoris.js" defer></script>
<script src="/forms.js" defer></script>
<script src="/cards.js" defer></script>
<script src="/page.js" defer></script>
${scripts}
</body>
</html>
`;

// 1. Pages générées depuis les gabarits
const dir = join(ROOT, 'scripts/pages');
for (const file of (await readdir(dir)).filter(f => f.endsWith('.html'))) {
  const raw = await readFile(join(dir, file), 'utf8');
  const meta = Object.fromEntries([...raw.matchAll(/^<!--\s*(\w+):\s*(.*?)\s*-->$/gm)].map(m => [m[1], m[2]]));
  const body = fill(raw.replace(/^<!--\s*\w+:.*-->\n/gm, ''));
  await writeFile(join(PUB, file), shell({ title: meta.title, description: meta.description, body, scripts: meta.script ? `<script src="${meta.script}" defer></script>` : '' }));
  console.log('Page générée :', file);
}

// 2. En-tête et pied de page synchronisés dans les pages écrites à la main
for (const file of ['bien.html']) {
  let html = await readFile(join(PUB, file), 'utf8');
  html = html.replace(/<!-- layout:header -->[\s\S]*?<!-- \/layout:header -->/, header).replace(/<!-- layout:footer -->[\s\S]*?<!-- \/layout:footer -->/, footer);
  await writeFile(join(PUB, file), html);
  console.log('Mise en page synchronisée :', file);
}
