// Convertisseur Markdown volontairement restreint, sans dépendance : il couvre ce
// dont les articles ont besoin (titres, paragraphes, listes, tableaux, citations,
// liens, gras, italique) et rien d'autre. Tout le texte est échappé avant d'être
// mis en forme, donc un article ne peut pas injecter de HTML.

export const CTA_MARKER = "<!-- cta -->";
// Caractères de la zone d'usage privé Unicode : ils ne peuvent pas apparaître
// dans un article, donc servent de marqueurs temporaires sans risque.
const CTA_TOKEN = "\ue000CTA\ue000";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'"]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Espaces insécables de la typographie française : avant « : ; ! ? », à
// l'intérieur des guillemets, entre un nombre et son unité, et pour séparer
// les milliers. Appliqué au texte seulement, jamais aux balises.
export function frenchTypography(html) {
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith("<")) return part;
      return part
        .replace(/ ([:;!?»])/g, "\u00a0$1")
        .replace(/« /g, "«\u00a0")
        .replace(/(\d) (\d{3})(?!\d)/g, "$1\u00a0$2")
        .replace(/(\d) (€|%|HT\b|TTC\b|ans?\b|mois\b|pages?\b)/g, "$1\u00a0$2");
    })
    .join("");
}

export function renderInline(text) {
  const links = [];
  // Les liens sont mis de côté avant le reste, pour que le gras ou l'italique
  // ne touchent jamais une URL.
  let out = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    links.push({ label, href });
    return `\ue001${links.length - 1}\ue001`;
  });
  out = escapeHtml(out)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?![*\w])/g, "$1<em>$2</em>");
  return out.replace(/\ue001(\d+)\ue001/g, (_, index) => {
    const { label, href } = links[Number(index)];
    const external = /^https?:\/\//.test(href);
    const attrs = external ? ' rel="noopener"' : "";
    return `<a href="${escapeHtml(href)}"${attrs}>${renderInline(label)}</a>`;
  });
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function renderMarkdown(source) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  const headings = [];
  const usedIds = new Set();
  let paragraph = [];
  let list = null;
  let quote = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item) => `<li>${renderInline(item)}</li>`).join("");
    blocks.push(`<${list.type}>${items}</${list.type}>`);
    list = null;
  };
  const flushQuote = () => {
    if (!quote.length) return;
    const inner = quote
      .join("\n")
      .split(/\n\s*\n/)
      .map((chunk) => chunk.replace(/\n/g, " ").trim())
      .filter(Boolean)
      .map((chunk) => `<p>${renderInline(chunk)}</p>`)
      .join("");
    blocks.push(`<blockquote>${inner}</blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === CTA_MARKER) {
      flushAll();
      blocks.push(CTA_TOKEN);
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      flushList();
      if (quote.length) quote.push("");
      continue;
    }

    const heading = /^(#{2,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = heading[2].trim();
      let id = slugify(text) || "section";
      for (let n = 2; usedIds.has(id); n += 1) id = `${slugify(text)}-${n}`;
      usedIds.add(id);
      headings.push({ level, text, id });
      blocks.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      flushList();
      quote.push(trimmed.replace(/^>\s?/, ""));
      continue;
    }
    flushQuote();

    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushAll();
      const head = splitRow(trimmed);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      i -= 1;
      // Les rôles ARIA gardent la sémantique du tableau quand le CSS mobile
      // l'affiche en cartes ; data-label sert d'intitulé à chaque cellule.
      const labels = head.map((cell) => escapeHtml(cell.replace(/[*`]/g, "")));
      const thead = `<thead role="rowgroup"><tr role="row">${head.map((cell) => `<th scope="col" role="columnheader">${renderInline(cell)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody role="rowgroup">${rows
        .map((row) => `<tr role="row">${row.map((cell, index) => `<td role="cell" data-label="${labels[index] || ""}">${renderInline(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody>`;
      blocks.push(`<div class="blog-table" role="region" aria-label="Tableau" tabindex="0"><table role="table">${thead}${tbody}</table></div>`);
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    const ordered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (bullet || ordered) {
      flushParagraph();
      const type = bullet ? "ul" : "ol";
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((bullet || ordered)[1]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${trimmed}`;
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }
  flushAll();

  const html = frenchTypography(blocks.join("\n"));
  return { html, headings, ctaToken: CTA_TOKEN };
}

// En-tête « clé: valeur » entre deux lignes « --- », sans dépendance YAML.
export function parseFrontMatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return { data: {}, body: source };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1 || !line.trim()) continue;
    data[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return { data, body: source.slice(match[0].length) };
}

export function plainText(markdown) {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*|`_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
