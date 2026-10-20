// Lecture et validation des articles (blog/articles/*.md).

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontMatter, plainText, renderMarkdown } from "./markdown.mjs";

const REQUIRED = ["slug", "title", "h1", "description", "excerpt", "keyword", "datePublished", "status"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parsePost(source, file, config) {
  const { data, body } = parseFrontMatter(source);
  const errors = REQUIRED.filter((key) => !data[key]).map((key) => `${file} : champ « ${key} » manquant`);
  if (data.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) errors.push(`${file} : slug invalide (minuscules, chiffres et tirets)`);
  for (const key of ["datePublished", "dateModified"]) {
    if (data[key] && !ISO_DATE.test(data[key])) errors.push(`${file} : ${key} doit être au format AAAA-MM-JJ`);
  }
  if (data.status && !["published", "draft"].includes(data.status)) errors.push(`${file} : status doit valoir published ou draft`);
  if (errors.length) throw new Error(errors.join("\n"));

  const { html, headings, ctaToken } = renderMarkdown(body);
  const words = plainText(body).split(" ").filter(Boolean).length;
  const h1Plain = data.h1.replace(/\*/g, "");
  return {
    file,
    slug: data.slug,
    path: `${config.blog.path}/${data.slug}`,
    status: data.status,
    title: data.title.length + config.siteName.length + 3 <= 65 ? `${data.title} | ${config.siteName}` : data.title,
    h1: data.h1,
    h1Plain,
    breadcrumbLabel: data.breadcrumb || h1Plain.replace(/\s*[:?].*$/, "") || h1Plain,
    description: data.description,
    excerpt: data.excerpt,
    category: data.category || "Conseils",
    keyword: data.keyword,
    keywords: (data.keywords || "").split(",").map((k) => k.trim()).filter(Boolean),
    datePublished: data.datePublished,
    dateModified: data.dateModified || data.datePublished,
    image: data.image
      ? { path: data.image, width: Number(data.imageWidth || 1200), height: Number(data.imageHeight || 630), alt: data.imageAlt || h1Plain }
      : null,
    cta: data.cta,
    ctaButton: data.ctaButton,
    html,
    ctaToken,
    headings,
    wordCount: words,
    readingMinutes: Math.max(1, Math.round(words / 220)),
    body,
  };
}

export async function loadPosts(dir, config, { includeDrafts = false } = {}) {
  const files = (await readdir(dir)).filter((name) => name.endsWith(".md")).sort();
  const posts = [];
  for (const name of files) {
    posts.push(parsePost(await readFile(join(dir, name), "utf8"), name, config));
  }
  const slugs = new Map();
  for (const post of posts) {
    if (slugs.has(post.slug)) throw new Error(`Slug en double : ${post.slug} (${slugs.get(post.slug)} et ${post.file})`);
    slugs.set(post.slug, post.file);
  }
  return posts
    .filter((post) => includeDrafts || post.status === "published")
    .sort((a, b) => b.datePublished.localeCompare(a.datePublished) || a.slug.localeCompare(b.slug));
}
