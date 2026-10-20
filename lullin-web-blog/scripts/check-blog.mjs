// Vérifie les pages du blog générées dans dist/ : un seul H1, title et meta
// description, canonical, Open Graph, données structurées valides, liens
// internes qui existent, sitemap à jour. Une erreur fait échouer le build ;
// un avertissement s'affiche seulement.
// Option --external : vérifie aussi que les liens externes répondent (réseau).

import { readdir, readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import defaultConfig from "../blog/blog.config.mjs";
import { loadPosts } from "./blog/content.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const attr = (html, pattern) => {
  const m = pattern.exec(html);
  return m ? decode(m[1]) : null;
};

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

function routeExists(dist, href) {
  const path = decodeURI(href.split("#")[0].split("?")[0]);
  if (path === "/" || path === "") return existsSync(join(dist, "index.html"));
  const target = join(dist, path);
  if (existsSync(join(target, "index.html"))) return true;
  if (existsSync(`${target}.html`)) return true;
  return existsSync(target) && statSync(target).isFile();
}

export function inspectPage(html) {
  return {
    h1Count: (html.match(/<h1[\s>]/g) || []).length,
    title: attr(html, /<title>([^<]*)<\/title>/),
    description: attr(html, /<meta name="description" content="([^"]*)"/),
    canonical: attr(html, /<link rel="canonical" href="([^"]*)"/),
    ogTitle: attr(html, /<meta property="og:title" content="([^"]*)"/),
    ogDescription: attr(html, /<meta property="og:description" content="([^"]*)"/),
    ogUrl: attr(html, /<meta property="og:url" content="([^"]*)"/),
    ogImage: attr(html, /<meta property="og:image" content="([^"]*)"/),
    jsonLd: [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]),
    links: [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) => decode(m[1])),
    ids: new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])),
    imagesWithoutAlt: (html.match(/<img\b(?![^>]*\balt=)[^>]*>/g) || []).length,
    headingLevels: [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1])),
  };
}

export async function checkBlog({ root = ROOT, dist = join(ROOT, "dist"), config = defaultConfig, external = false } = {}) {
  const errors = [];
  const warnings = [];
  const posts = await loadPosts(join(root, "blog", "articles"), config);
  const absolute = (path) => new URL(path, config.siteUrl).href;

  const pages = [
    { path: config.blog.path, kind: "index" },
    ...posts.map((post) => ({ path: post.path, kind: "article", post })),
  ];

  // Titres et descriptions de toutes les autres pages du site, pour repérer
  // un doublon (risque de cannibalisation).
  const others = new Map();
  for (const file of await htmlFiles(dist)) {
    if (file.includes(`${join(dist, config.blog.path)}`) || file.endsWith("404.html")) continue;
    const info = inspectPage(await readFile(file, "utf8"));
    if (info.title) others.set(`title:${info.title}`, file);
    if (info.description) others.set(`description:${info.description}`, file);
  }

  const seen = new Map();
  const externalLinks = new Set();
  for (const page of pages) {
    const file = join(dist, page.path, "index.html");
    const where = page.path;
    if (!existsSync(file)) {
      errors.push(`${where} : page absente (${file})`);
      continue;
    }
    const html = await readFile(file, "utf8");
    const info = inspectPage(html);

    if (info.h1Count !== 1) errors.push(`${where} : ${info.h1Count} balises H1 (une seule attendue)`);
    if (!info.title) errors.push(`${where} : balise <title> manquante`);
    else if (info.title.length > 70) warnings.push(`${where} : title long (${info.title.length} caractères), risque de coupure dans Google`);
    if (!info.description) errors.push(`${where} : meta description manquante`);
    else if (info.description.length < 110 || info.description.length > 160) {
      warnings.push(`${where} : meta description de ${info.description.length} caractères (idéal : 110 à 160)`);
    }
    if (info.canonical !== absolute(page.path)) errors.push(`${where} : canonical « ${info.canonical} » au lieu de « ${absolute(page.path)} »`);
    if (info.ogUrl !== info.canonical) errors.push(`${where} : og:url différent du canonical`);
    for (const key of ["ogTitle", "ogDescription", "ogImage"]) if (!info[key]) errors.push(`${where} : ${key} manquant`);
    if (info.imagesWithoutAlt) errors.push(`${where} : ${info.imagesWithoutAlt} image(s) sans attribut alt`);

    for (const key of [`title:${info.title}`, `description:${info.description}`]) {
      if (seen.has(key)) errors.push(`${where} : ${key.split(":")[0]} identique à ${seen.get(key)}`);
      seen.set(key, where);
      if (others.has(key)) errors.push(`${where} : ${key.split(":")[0]} identique à une page du site (${others.get(key)})`);
    }

    const levels = info.headingLevels;
    for (let i = 1; i < levels.length; i += 1) {
      if (levels[i] > levels[i - 1] + 1) warnings.push(`${where} : saut de niveau de titre (h${levels[i - 1]} → h${levels[i]})`);
    }

    for (const raw of info.jsonLd) {
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        errors.push(`${where} : données structurées JSON-LD invalides`);
        continue;
      }
      if (data["@type"] === "BlogPosting") {
        for (const key of ["headline", "datePublished", "dateModified", "image", "author", "publisher", "mainEntityOfPage"]) {
          if (!data[key]) errors.push(`${where} : BlogPosting sans « ${key} »`);
        }
        if (data.headline && data.headline.length > 110) warnings.push(`${where} : headline de plus de 110 caractères`);
      }
    }
    if (page.kind === "article" && !info.jsonLd.some((raw) => raw.includes('"BlogPosting"'))) errors.push(`${where} : données structurées Article absentes`);

    for (const href of info.links) {
      if (href.startsWith("#")) {
        if (href.length > 1 && !info.ids.has(href.slice(1))) errors.push(`${where} : ancre « ${href} » introuvable`);
      } else if (href.startsWith("/") && !href.startsWith("//")) {
        if (!routeExists(dist, href)) errors.push(`${where} : lien interne cassé « ${href} »`);
      } else if (/^https?:\/\//.test(href)) {
        if (href.startsWith(config.siteUrl)) warnings.push(`${where} : lien interne en absolu « ${href} »`);
        else externalLinks.add(href);
      }
    }
  }

  const sitemapPath = join(dist, "sitemap.xml");
  if (existsSync(sitemapPath)) {
    const sitemap = await readFile(sitemapPath, "utf8");
    if ((sitemap.match(/<url>/g) || []).length !== (sitemap.match(/<\/url>/g) || []).length) errors.push("sitemap.xml : balises <url> mal fermées");
    for (const page of pages) {
      const count = sitemap.split(`<loc>${absolute(page.path)}</loc>`).length - 1;
      if (count !== 1) errors.push(`sitemap.xml : ${absolute(page.path)} présent ${count} fois`);
    }
  } else {
    warnings.push("sitemap.xml absent de dist/");
  }
  if (!existsSync(join(dist, config.blog.path, "rss.xml"))) errors.push("flux RSS du blog absent");

  if (external) {
    for (const href of externalLinks) {
      try {
        const response = await fetch(href, { method: "GET", redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (link check)" } });
        if (response.status >= 400) warnings.push(`lien externe en erreur ${response.status} : ${href}`);
      } catch (error) {
        warnings.push(`lien externe injoignable : ${href} (${error.message})`);
      }
    }
  }

  return { errors, warnings, posts, externalLinks: [...externalLinks] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = process.env.BLOG_DIST_DIR ? resolve(process.env.BLOG_DIST_DIR) : join(ROOT, "dist");
  const { errors, warnings, posts } = await checkBlog({ dist, external: process.argv.includes("--external") });
  for (const warning of warnings) console.warn(`Attention : ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`Erreur : ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Blog vérifié : ${posts.length} article(s), index, sitemap et flux RSS conformes.`);
  }
}
