import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import config from "../blog/blog.config.mjs";
import { frenchTypography, parseFrontMatter, renderInline, renderMarkdown, slugify } from "../scripts/blog/markdown.mjs";
import { parsePost } from "../scripts/blog/content.mjs";
import { buildBlog, extractAssets, minifyCss, patchLlms, patchSitemap } from "../scripts/build-blog.mjs";
import { checkBlog } from "../scripts/check-blog.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("le Markdown échappe le HTML et ne crée pas de balises", () => {
  const { html } = renderMarkdown('Texte <script>alert("x")</script> & suite');
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("les titres reçoivent des ancres uniques et sans accents", () => {
  const { html, headings } = renderMarkdown("## Être trouvé\n\n## Être trouvé\n\n### Où ?");
  assert.deepEqual(headings.map((h) => h.id), ["etre-trouve", "etre-trouve-2", "ou"]);
  assert.match(html, /<h2 id="etre-trouve">/);
  assert.match(html, /<h3 id="ou">/);
});

test("listes, tableaux, citations et marqueur d'appel à l'action", () => {
  const md = "- un\n- deux\n\n1. premier\n2. second\n\n| A | B |\n|---|---|\n| x | 5 200 € |\n\n> note\n\n<!-- cta -->";
  const { html, ctaToken } = renderMarkdown(md);
  assert.match(html, /<ul><li>un<\/li><li>deux<\/li><\/ul>/);
  assert.match(html, /<ol><li>premier<\/li><li>second<\/li><\/ol>/);
  assert.match(html, /<th scope="col" role="columnheader">A<\/th>/);
  assert.match(html, /<td role="cell" data-label="B">5\u00a0200\u00a0€<\/td>/);
  assert.match(html, /<blockquote><p>note<\/p><\/blockquote>/);
  assert.ok(html.includes(ctaToken));
});

test("liens, gras et italique en ligne", () => {
  assert.equal(renderInline("[offres](/offres)"), '<a href="/offres">offres</a>');
  assert.equal(renderInline("[Google](https://google.com/a_b_c)"), '<a href="https://google.com/a_b_c" rel="noopener">Google</a>');
  assert.equal(renderInline("**gras** et *italique*"), "<strong>gras</strong> et <em>italique</em>");
});

test("typographie française sur le texte, jamais dans les balises", () => {
  assert.equal(frenchTypography("Prix : 349 € ?"), "Prix\u00a0: 349\u00a0€\u00a0?");
  assert.equal(frenchTypography('<a href="/x?a=1 :">ok</a>'), '<a href="/x?a=1 :">ok</a>');
  assert.equal(slugify("Combien coûte l’hébergement ?"), "combien-coute-l-hebergement");
});

test("en-tête d'article et règles de validation", () => {
  const source = "---\nslug: test\ntitle: Titre : court\nh1: Un *titre*\ndescription: d\nexcerpt: e\nkeyword: k\ndatePublished: 2026-10-20\nstatus: published\n---\nCorps";
  assert.deepEqual(parseFrontMatter(source).data.title, "Titre : court");
  const post = parsePost(source, "test.md", config);
  assert.equal(post.title, "Titre : court | Lullin Web");
  assert.equal(post.h1Plain, "Un titre");
  assert.equal(post.path, "/blog/test");
  assert.throws(() => parsePost(source.replace("slug: test", "slug: Test Invalide"), "x.md", config), /slug invalide/);
  assert.throws(() => parsePost(source.replace("keyword: k\n", ""), "x.md", config), /keyword/);
});

test("les ressources du site sont reprises depuis dist/index.html, sans le module React", () => {
  const html = `<head><meta name="theme-color" content="#111211" />
    <link rel="preload"
      href="/fonts/a.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="icon" href="/favicon.svg" />
    <script type="module" crossorigin src="/assets/index-a.js"></script>
    <link rel="modulepreload" href="/assets/x.js">
    <link rel="stylesheet" crossorigin href="/assets/index-b.css">
    <script defer src="/_vercel/insights/script.js"></script></head>`;
  const assets = extractAssets(html);
  assert.deepEqual(assets.stylesheets, ['<link rel="stylesheet" crossorigin href="/assets/index-b.css">']);
  assert.equal(assets.preloads.length, 1);
  assert.equal(assets.icons.length, 1);
  assert.equal(assets.scripts.length, 1);
  assert.ok(!JSON.stringify(assets).includes("index-a.js"));
  assert.throws(() => extractAssets("<head></head>"), /feuille de style/);
});

test("sitemap et llms.txt : ajout idempotent", () => {
  const posts = [{ path: "/blog/a", dateModified: "2026-10-20", h1Plain: "A", excerpt: "Résumé" }];
  const xml = '<?xml version="1.0"?>\n<urlset>\n  <url><loc>https://www.lullin-web.com/</loc></url>\n</urlset>\n';
  const once = patchSitemap(xml, config, posts);
  assert.equal(patchSitemap(once, config, posts), once);
  assert.equal((once.match(/<url>/g) || []).length, 3);
  const llms = "# Site\n\n## Pages\n\n- x\n\n## Contact\n\n- mail\n";
  const patched = patchLlms(llms, config, posts);
  assert.equal(patchLlms(patched, config, posts), patched);
  assert.ok(patched.indexOf("## Blog") < patched.indexOf("## Contact"));
});

test("minification CSS sans casser les sélecteurs ni calc()", () => {
  assert.equal(minifyCss(".a > .b :is(p) { top: calc(1em - 2px); }"), ".a>.b :is(p){top:calc(1em - 2px)}");
});

test("build complet sur un dist minimal, puis vérification sans erreur", async () => {
  const dist = await mkdtemp(join(tmpdir(), "blog-dist-"));
  try {
    await writeFile(join(dist, "index.html"), '<html><head><link rel="stylesheet" href="/assets/index.css"></head><body></body></html>');
    await writeFile(join(dist, "sitemap.xml"), '<?xml version="1.0"?>\n<urlset>\n  <url><loc>https://www.lullin-web.com/</loc></url>\n</urlset>\n');
    await writeFile(join(dist, "llms.txt"), "# Lullin Web\n\n## Contact\n\n- mail\n");
    for (const route of ["services", "realisations", "a-propos", "offres", "methode", "faq", "partenaires", "contact", "cgv", "confidentialite", "mentions-legales"]) {
      await mkdir(join(dist, route), { recursive: true });
      await writeFile(join(dist, route, "index.html"), `<html><head><title>${route}</title></head></html>`);
    }
    await mkdir(join(dist, "images"), { recursive: true });
    await writeFile(join(dist, "images", "lullin-mark.svg"), "<svg/>");

    const posts = await buildBlog({ root: ROOT, dist, log: () => {} });
    assert.ok(posts.length >= 1);
    const html = await readFile(join(dist, "blog", posts[0].slug, "index.html"), "utf8");
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
    assert.ok(!html.includes("<!-- cta -->"));
    assert.ok(!/[\ue000\ue001]/.test(html));
    assert.ok(!html.includes('type="module"'));

    const { errors } = await checkBlog({ root: ROOT, dist });
    assert.deepEqual(errors, []);
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
});
