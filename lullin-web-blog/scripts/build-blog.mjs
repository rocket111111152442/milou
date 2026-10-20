// Génère le blog statique dans dist/ après le build du site :
//   dist/blog/index.html, dist/blog/<slug>/index.html, dist/blog/rss.xml,
// et ajoute les articles à dist/sitemap.xml et dist/llms.txt.
// Les pages reprennent la feuille de style produite par Vite (lue dans
// dist/index.html) mais ne chargent pas React : elles restent légères et
// entièrement lisibles sans JavaScript.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import defaultConfig from "../blog/blog.config.mjs";
import { loadPosts } from "./blog/content.mjs";
import { inlineCta, renderArticlePage, renderIndexPage, renderRss } from "./blog/templates.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const tags = (html, pattern) => (html.match(pattern) || []).map((tag) => tag.replace(/\s+/g, " ").replace(/ \/?>$/, " />"));

// Reprend dans dist/index.html ce que les pages du blog doivent partager avec
// le site : feuilles de style Vite, polices préchargées, icônes, couleur du
// thème et éventuels scripts Vercel (Web Analytics, Speed Insights).
export function extractAssets(indexHtml) {
  const links = tags(indexHtml, /<link\b[^>]*>/gi);
  const stylesheets = links.filter((tag) => /rel="stylesheet"/.test(tag));
  if (!stylesheets.length) throw new Error("Aucune feuille de style trouvée dans dist/index.html : lancer le build Vite avant le blog.");
  return {
    stylesheets,
    preloads: links.filter((tag) => /rel="preload"/.test(tag) && /as="font"/.test(tag)),
    icons: links.filter((tag) => /rel="(?:icon|alternate icon|apple-touch-icon)"/.test(tag)),
    themeColor: tags(indexHtml, /<meta\b[^>]*name="theme-color"[^>]*>/gi)[0] || "",
    scripts: (indexHtml.match(/<script\b[^>]*src="\/_vercel\/[^"]+"[^>]*><\/script>/gi) || []).map((tag) => tag.replace(/\s+/g, " ")),
  };
}

export function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,>])\s*/g, "$1")
    .replace(/:\s+/g, ":")
    .replace(/;}/g, "}")
    .trim();
}

export function sitemapEntries(config, posts) {
  const url = (path) => new URL(path, config.siteUrl).href;
  const latest = posts.reduce((max, p) => (p.dateModified > max ? p.dateModified : max), posts[0]?.dateModified || "");
  return [
    `  <url><loc>${url(config.blog.path)}</loc><lastmod>${latest}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`,
    ...posts.map((p) => `  <url><loc>${url(p.path)}</loc><lastmod>${p.dateModified}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`),
  ];
}

// Idempotent : les anciennes entrées du blog sont retirées avant d'ajouter
// les nouvelles, donc relancer le script ne crée pas de doublons.
export function patchSitemap(xml, config, posts) {
  if (!xml.includes("</urlset>")) throw new Error("dist/sitemap.xml ne contient pas de balise </urlset>.");
  const blogUrl = new URL(config.blog.path, config.siteUrl).href;
  const cleaned = xml.replace(/[ \t]*<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>\r?\n?/g, (block, loc) =>
    loc === blogUrl || loc.startsWith(`${blogUrl}/`) ? "" : block,
  );
  return cleaned.replace("</urlset>", `${sitemapEntries(config, posts).join("\n")}\n</urlset>`);
}

export function patchLlms(text, config, posts) {
  const withoutBlog = text.replace(/\n## Blog\n[\s\S]*?(?=\n## |\s*$)/, "");
  const section = `\n## Blog\n\n${posts
    .map((p) => `- [${p.h1Plain}](${new URL(p.path, config.siteUrl).href}) : ${p.excerpt}`)
    .join("\n")}\n`;
  const anchor = withoutBlog.indexOf("\n## Contact");
  if (anchor === -1) return `${withoutBlog.replace(/\s*$/, "\n")}${section}`;
  return `${withoutBlog.slice(0, anchor)}${section}${withoutBlog.slice(anchor)}`;
}

function relatedPosts(post, posts, limit = 3) {
  return posts
    .filter((p) => p.slug !== post.slug)
    .sort((a, b) => Number(b.category === post.category) - Number(a.category === post.category))
    .slice(0, limit);
}

export async function buildBlog({ root = ROOT, dist = join(ROOT, "dist"), config = defaultConfig, log = console.log } = {}) {
  const indexPath = join(dist, "index.html");
  if (!existsSync(indexPath)) throw new Error(`${indexPath} introuvable : le blog se génère après « vite build ».`);

  const assets = extractAssets(await readFile(indexPath, "utf8"));
  assets.blogCss = minifyCss(await readFile(join(root, "blog", "blog.css"), "utf8"));

  const posts = await loadPosts(join(root, "blog", "articles"), config);
  if (!posts.length) throw new Error("Aucun article publié dans blog/articles.");
  for (const post of posts) {
    let first = true;
    post.html = post.html.replaceAll(post.ctaToken, () => {
      const html = first ? inlineCta(config, post) : "";
      first = false;
      return html;
    });
  }

  const outDir = join(dist, config.blog.path.replace(/^\//, ""));
  await rm(outDir, { recursive: true, force: true });
  for (const post of posts) {
    const file = join(outDir, post.slug, "index.html");
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, renderArticlePage(config, assets, post, relatedPosts(post, posts)));
  }
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "index.html"), renderIndexPage(config, assets, posts));
  await writeFile(join(outDir, "rss.xml"), renderRss(config, posts));

  const sitemapPath = join(dist, "sitemap.xml");
  if (existsSync(sitemapPath)) {
    await writeFile(sitemapPath, patchSitemap(await readFile(sitemapPath, "utf8"), config, posts));
  } else {
    log("Attention : dist/sitemap.xml absent, les articles n’y ont pas été ajoutés.");
  }
  const llmsPath = join(dist, "llms.txt");
  if (existsSync(llmsPath)) await writeFile(llmsPath, patchLlms(await readFile(llmsPath, "utf8"), config, posts));

  log(`Blog : ${posts.length} article(s) publié(s) → ${posts.map((p) => p.path).join(", ")}`);
  return posts;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = process.env.BLOG_DIST_DIR ? resolve(process.env.BLOG_DIST_DIR) : join(ROOT, "dist");
  buildBlog({ dist }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
