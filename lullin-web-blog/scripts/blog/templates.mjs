// Gabarits HTML des pages du blog. Ils reprennent le balisage et les classes du
// site React (en-tête, menu mobile, pied de page, bandeau de contact) pour que la
// feuille de style du site s'applique telle quelle, sans charger React.

import { escapeHtml as esc, renderInline } from "./markdown.mjs";

const svg = (name, size, paths) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${name}" aria-hidden="true">${paths}</svg>`;
const arrow = (size) => svg("arrow-up-right", size, '<path d="M7 7h10v10"></path><path d="M7 17 17 7"></path>');
const menuIcon = svg("menu", 24, '<path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path>');
const closeIcon = svg("x", 24, '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>');
const asterisk = svg("asterisk", 24, '<path d="M12 5v14"></path><path d="m18.065 8.496-12.125 7"></path><path d="m5.94 8.504 12.125 7"></path>');

const brand = '<span class="brand-lockup"><img class="brand-emblem" alt="" width="40" height="40" src="/images/lullin-mark.svg"><span class="wordmark">lullin<span>web</span></span></span>';

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const formatDate = (iso) => dateFormatter.format(new Date(`${iso}T00:00:00Z`));

const absolute = (config, path) => new URL(path, config.siteUrl).href;
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
const isCurrent = (href, current) => (href === "/blog" ? current.startsWith("/blog") : href === current);

function header(config, current) {
  const links = config.navigation
    .map((item) => `<a href="${item.href}"${isCurrent(item.href, current) ? ' aria-current="page"' : ""}>${esc(item.label)}<span></span></a>`)
    .join("");
  const mobile = config.mobileNavigation
    .map((item, index) => `<a href="${item.href}"${isCurrent(item.href, current) ? ' aria-current="page"' : ""}><small>${String(index + 1).padStart(2, "0")}</small>${esc(item.label)}${arrow(24)}</a>`)
    .join("");
  return `<header class="header"><a class="home-link" href="/" aria-label="Lullin Web, accueil">${brand}</a><nav class="desktop-nav" aria-label="Navigation principale">${links}</nav><a class="header-contact" href="/contact">Parlons de votre projet ${arrow(17)}</a><button type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="mobile-menu" aria-label="Ouvrir le menu" class="menu-trigger">${menuIcon}</button></header>
<div class="menu-backdrop" data-menu-backdrop hidden></div>
<div class="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-labelledby="mobile-menu-title" tabindex="-1" hidden><h2 id="mobile-menu-title" class="sr-only">Navigation</h2><button type="button" aria-label="Fermer le menu" class="menu-close">${closeIcon}</button>${brand}<nav aria-label="Navigation mobile">${mobile}</nav><a class="menu-email" href="mailto:${config.email}">${config.email}</a></div>`;
}

function footer(config) {
  const year = new Date().getUTCFullYear();
  const links = config.footerNavigation.map((item) => `<a href="${item.href}">${esc(item.label)}</a>`).join("");
  const cookies = config.analytics.gaMeasurementId
    ? '<a href="/confidentialite" data-consent-reset>Cookies</a>'
    : "";
  return `<footer class="footer"><div class="footer-top"><a href="/" aria-label="Lullin Web, accueil">${brand}</a><p>Des idées claires.<br>Des sites qui comptent.</p><div><span>UN PROJET EN TÊTE ?</span><a href="mailto:${config.email}">${config.email} ${arrow(16)}</a></div></div><nav class="footer-nav" aria-label="Liens de bas de page">${links}</nav><div class="footer-signature" aria-hidden="true">lullin<span>web</span><i>${arrow(24)}</i></div><div class="footer-bottom"><span>© ${year} Lullin Web</span><span>Design &amp; développement sur mesure</span><a href="/mentions-legales">Mentions légales</a><a href="/cgv">CGV</a><a href="/confidentialite">Confidentialité</a>${cookies}<a href="#top" aria-label="Retour en haut">Tout en haut ${arrow(14)}</a></div></footer>`;
}

function contactBand() {
  return `<section class="contact-band"><div class="wrap"><div><p class="section-label"><span>UN PROJET ? /</span>CRÉER UN SITE OU MODERNISER VOTRE PRÉSENCE EN LIGNE</p><h2>Un site à la hauteur<br><span>de votre activité.</span></h2></div><div class="contact-band-bottom"><p>Présentez-nous votre projet et recevez<br>une proposition adaptée à vos besoins.</p><a href="/contact" class="action"><span>Demander mon devis</span><i>${arrow(19)}</i></a><span class="availability"><i></i>Sites internet à partir de 349 €</span></div></div><span class="contact-star" aria-hidden="true">${asterisk}</span></section>`;
}

export function inlineCta(config, post) {
  const text = post.cta || config.cta.text;
  const button = post.ctaButton || config.cta.button;
  return `<aside class="blog-cta" aria-label="Demander un devis"><p>${renderInline(text)}</p><a href="${config.cta.href}" class="action"><span>${esc(button)}</span><i>${arrow(19)}</i></a></aside>`;
}

function consentBanner(config) {
  if (!config.analytics.gaMeasurementId) return "";
  return `<div class="blog-consent" id="consent-banner" role="region" aria-label="Mesure d’audience" hidden><p>Nous aimerions mesurer la fréquentation du site avec Google Analytics. Rien n’est déposé sans votre accord, et vous pouvez changer d’avis à tout moment. <a href="/confidentialite">En savoir plus</a></p><div><button type="button" data-consent-choice="refuse">Refuser</button><button type="button" data-consent-choice="accepte">Accepter</button></div></div>`;
}

// Script commun : menu mobile, en-tête compact au défilement et, si la mesure
// d'audience est activée, chargement de Google Analytics après consentement
// uniquement, avec la même clé que src/consent.tsx.
function pageScript(config) {
  const { gaMeasurementId, consentStorageKey, acceptedValue, refusedValue } = config.analytics;
  const analytics = gaMeasurementId
    ? `var K=${JSON.stringify(consentStorageKey)},A=${JSON.stringify(acceptedValue)},R=${JSON.stringify(refusedValue)},ID=${JSON.stringify(gaMeasurementId)};
function readChoice(){try{var v=localStorage.getItem(K);return v===A||v===R?v:null}catch(e){return null}}
function saveChoice(v){try{localStorage.setItem(K,v)}catch(e){}}
function loadAnalytics(){if(document.getElementById("ga-tag"))return;window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};window.gtag("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"granted"});window.gtag("js",new Date());window.gtag("config",ID);var s=document.createElement("script");s.id="ga-tag";s.async=true;s.src="https://www.googletagmanager.com/gtag/js?id="+encodeURIComponent(ID);document.head.appendChild(s)}
var banner=document.getElementById("consent-banner");
function showBanner(){if(banner)banner.hidden=false}
if(banner){banner.addEventListener("click",function(e){var b=e.target.closest("[data-consent-choice]");if(!b)return;var v=b.getAttribute("data-consent-choice")===A?A:R;saveChoice(v);banner.hidden=true;if(v===A)loadAnalytics()})}
var reset=document.querySelector("[data-consent-reset]");
if(reset)reset.addEventListener("click",function(e){e.preventDefault();try{localStorage.removeItem(K)}catch(err){}showBanner()});
var choice=readChoice();if(choice===A)loadAnalytics();else if(choice===null)showBanner();`
    : "";
  return `<script>(function(){
var header=document.querySelector(".header"),trigger=document.querySelector(".menu-trigger"),menu=document.getElementById("mobile-menu"),backdrop=document.querySelector("[data-menu-backdrop]"),closeBtn=menu&&menu.querySelector(".menu-close");
function onScroll(){header.classList.toggle("header-scrolled",window.scrollY>24)}
window.addEventListener("scroll",onScroll,{passive:true});onScroll();
function openMenu(){menu.hidden=false;backdrop.hidden=false;trigger.setAttribute("aria-expanded","true");document.documentElement.style.overflow="hidden";closeBtn.focus()}
function closeMenu(){menu.hidden=true;backdrop.hidden=true;trigger.setAttribute("aria-expanded","false");document.documentElement.style.overflow="";trigger.focus()}
if(trigger&&menu){trigger.addEventListener("click",openMenu);closeBtn.addEventListener("click",closeMenu);backdrop.addEventListener("click",closeMenu);
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!menu.hidden)closeMenu()});
menu.addEventListener("keydown",function(e){if(e.key!=="Tab")return;var f=menu.querySelectorAll("a,button"),first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}})}
${analytics}
})();</script>`;
}

function head(config, assets, page) {
  const url = absolute(config, page.path);
  const image = page.image || config.defaultImage;
  const meta = [
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    assets.themeColor,
    '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />',
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${page.ogType}" />`,
    `<meta property="og:site_name" content="${esc(config.siteName)}" />`,
    `<meta property="og:locale" content="${config.locale}" />`,
    `<meta property="og:title" content="${esc(page.socialTitle || page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${absolute(config, image.path)}" />`,
    `<meta property="og:image:width" content="${image.width}" />`,
    `<meta property="og:image:height" content="${image.height}" />`,
    `<meta property="og:image:alt" content="${esc(image.alt)}" />`,
    ...(page.published
      ? [
          `<meta property="article:published_time" content="${page.published}" />`,
          `<meta property="article:modified_time" content="${page.modified}" />`,
        ]
      : []),
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(page.socialTitle || page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${absolute(config, image.path)}" />`,
    ...assets.icons,
    ...assets.preloads,
    ...assets.stylesheets,
    `<link rel="alternate" type="application/rss+xml" title="Blog ${esc(config.siteName)}" href="${config.blog.path}/rss.xml" />`,
    `<style>${assets.blogCss}</style>`,
    ...page.structuredData.map(jsonLd),
    ...assets.scripts,
  ];
  return meta.filter(Boolean).map((line) => `    ${line}`).join("\n");
}

function layout(config, assets, page, main) {
  return `<!doctype html>
<html lang="fr">
  <head>
${head(config, assets, page)}
  </head>
  <body>
    <div class="site-surface"><div id="top"></div><a href="#main" class="skip-link">Aller au contenu</a>
${header(config, page.path)}
<main id="main">
${main}
${contactBand()}
</main>
${footer(config)}
${consentBanner(config)}
</div>
${pageScript(config)}
  </body>
</html>
`;
}

const organization = (config) => ({
  "@type": "Organization",
  "@id": `${config.siteUrl}/#organization`,
  name: config.siteName,
  url: `${config.siteUrl}/`,
  logo: { "@type": "ImageObject", url: absolute(config, config.logo.path), width: config.logo.width, height: config.logo.height },
});

function breadcrumb(config, items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absolute(config, item.path) })),
  };
}

function postCard(post, headingLevel) {
  return `<article class="blog-card"><a href="${post.path}"><p class="blog-card-meta">${esc(post.category)} · ${post.readingMinutes} min de lecture</p><h${headingLevel}>${esc(post.h1Plain)}</h${headingLevel}><p>${esc(post.excerpt)}</p><span class="blog-card-more">Lire l’article ${arrow(16)}</span></a></article>`;
}

export function renderArticlePage(config, assets, post, related) {
  const toc = post.headings.filter((h) => h.level === 2);
  const updated = post.dateModified !== post.datePublished
    ? ` · Mis à jour le <time datetime="${post.dateModified}">${formatDate(post.dateModified)}</time>`
    : "";
  const main = `<article class="wrap blog-article">
<nav class="blog-breadcrumb" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li><a href="${config.blog.path}">Blog</a></li><li><span aria-current="page">${esc(post.breadcrumbLabel)}</span></li></ol></nav>
<header class="blog-article-head"><p class="section-label"><span>Blog /</span>${esc(post.category)}</p><h1>${renderInline(post.h1)}</h1><p class="blog-meta">Publié le <time datetime="${post.datePublished}">${formatDate(post.datePublished)}</time>${updated} · ${post.readingMinutes} min de lecture · Par l’équipe ${esc(config.siteName)}</p></header>
<div class="blog-article-body">
${toc.length > 2 ? `<details class="blog-toc" id="blog-toc"><summary>Sommaire</summary><nav aria-label="Sommaire"><ol>${toc.map((h) => `<li><a href="#${h.id}">${renderInline(h.text)}</a></li>`).join("")}</ol></nav></details><script>if(window.matchMedia("(min-width: 1101px)").matches)document.getElementById("blog-toc").open=true</script>` : ""}
<div class="blog-content">
${post.html}
</div>
</div>
</article>
${related.length ? `<section class="wrap blog-related" aria-labelledby="blog-related-title"><h2 id="blog-related-title">À lire aussi</h2><div class="blog-grid">${related.map((p) => postCard(p, 3)).join("")}</div></section>` : ""}`;

  const image = post.image || config.defaultImage;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${absolute(config, post.path)}#article`,
      headline: post.h1Plain,
      description: post.description,
      datePublished: post.datePublished,
      dateModified: post.dateModified,
      inLanguage: config.language,
      url: absolute(config, post.path),
      mainEntityOfPage: absolute(config, post.path),
      image: { "@type": "ImageObject", url: absolute(config, image.path), width: image.width, height: image.height },
      author: organization(config),
      publisher: organization(config),
      keywords: [post.keyword, ...post.keywords].filter(Boolean).join(", "),
      wordCount: post.wordCount,
      isPartOf: { "@type": "Blog", "@id": `${absolute(config, config.blog.path)}#blog` },
    },
    breadcrumb(config, [
      { name: "Accueil", path: "/" },
      { name: "Blog", path: config.blog.path },
      { name: post.breadcrumbLabel, path: post.path },
    ]),
  ];

  return layout(config, assets, {
    path: post.path,
    title: post.title,
    socialTitle: post.h1Plain,
    description: post.description,
    ogType: "article",
    published: post.datePublished,
    modified: post.dateModified,
    image: post.image,
    structuredData,
  }, main);
}

export function renderIndexPage(config, assets, posts) {
  const main = `<section class="page-heading wrap blog-heading"><p class="section-label"><span>Blog /</span>${esc(config.blog.label)}</p><h1>${renderInline(config.blog.heading)}</h1><p>${esc(config.blog.intro)}</p></section>
<section class="wrap blog-list" aria-label="Articles"><div class="blog-grid">${posts.map((p) => postCard(p, 2)).join("")}</div></section>`;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      "@id": `${absolute(config, config.blog.path)}#blog`,
      name: `Blog ${config.siteName}`,
      description: config.blog.description,
      url: absolute(config, config.blog.path),
      inLanguage: config.language,
      publisher: organization(config),
      blogPost: posts.map((p) => ({
        "@type": "BlogPosting",
        "@id": `${absolute(config, p.path)}#article`,
        headline: p.h1Plain,
        url: absolute(config, p.path),
        datePublished: p.datePublished,
        dateModified: p.dateModified,
      })),
    },
    breadcrumb(config, [
      { name: "Accueil", path: "/" },
      { name: "Blog", path: config.blog.path },
    ]),
  ];
  return layout(config, assets, {
    path: config.blog.path,
    title: config.blog.title,
    description: config.blog.description,
    ogType: "website",
    structuredData,
  }, main);
}

export function renderRss(config, posts) {
  const items = posts
    .map((p) => `    <item>
      <title>${esc(p.h1Plain)}</title>
      <link>${absolute(config, p.path)}</link>
      <guid isPermaLink="true">${absolute(config, p.path)}</guid>
      <pubDate>${new Date(`${p.datePublished}T08:00:00Z`).toUTCString()}</pubDate>
      <description>${esc(p.description)}</description>
    </item>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog ${esc(config.siteName)}</title>
    <link>${absolute(config, config.blog.path)}</link>
    <atom:link href="${absolute(config, `${config.blog.path}/rss.xml`)}" rel="self" type="application/rss+xml" />
    <description>${esc(config.blog.description)}</description>
    <language>fr</language>
${items}
  </channel>
</rss>
`;
}
