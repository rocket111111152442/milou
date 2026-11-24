import sanitizeHtml from "sanitize-html";

/** Strict allowlist for listing descriptions and agent bios (AlterEstate docs: "Sanitize HTML with a strict allowlist"). */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  const clean = sanitizeHtml(html.replace(/&amp;amp;/g, "&amp;"), {
    allowedTags: ["p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "h3", "h4"],
    allowedAttributes: {},
    transformTags: { h1: "h3", h2: "h3", b: "strong", i: "em" },
    exclusiveFilter: (frame) => ["p", "li"].includes(frame.tag) && !frame.text.trim(),
  });
  return clean.replace(/(<p>\s*<\/p>)+/g, "").trim();
}

export function toPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html.replace(/<\/(p|li|h\d)>|<br\s*\/?>/gi, "\n"), { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** Only http(s) URLs from video platforms are kept; embeds are built by us, never from received markup. */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/https?:\/\/[^\s"'<>]+/);
  if (!m) return null;
  try {
    const u = new URL(m[0]);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function youtubeId(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
      return u.searchParams.get("v");
    }
  } catch {
    /* ignore */
  }
  return null;
}
