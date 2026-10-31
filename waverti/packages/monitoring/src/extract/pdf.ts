/**
 * Documents PDF (serveur uniquement — dépend de node:zlib).
 *
 * - Aucune exécution : le fichier n'est jamais interprété (pas de JavaScript PDF, pas de polices, pas de rendu).
 * - Empreinte SHA-256 des octets : détection fiable de toute nouvelle version.
 * - Extraction de texte « au mieux » : flux compressés (FlateDecode) décompressés avec plafond de taille, puis lecture
 *   des chaînes des opérateurs Tj/TJ. Si le résultat n'est pas du texte lisible (polices CID, PDF scanné, chiffré),
 *   le texte est déclaré indisponible : seule l'empreinte est utilisée, rien n'est inventé.
 */
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import type { PageObservation } from "@waverti/types";
import { collapseWhitespace } from "./text";
import { stableContentHash } from "./structure";

export const PDF_MAX_BYTES = 8 * 1024 * 1024;
const MAX_INFLATED = 8 * 1024 * 1024;
const MAX_STREAMS = 400;

function decodePdfString(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!;
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = raw[++i];
    if (n === undefined) break;
    if (n === "n") out += "\n";
    else if (n === "r" || n === "t" || n === "b" || n === "f") out += " ";
    else if (/[0-7]/.test(n)) {
      let oct = n;
      while (oct.length < 3 && /[0-7]/.test(raw[i + 1] ?? "")) oct += raw[++i];
      out += String.fromCharCode(parseInt(oct, 8));
    } else out += n;
  }
  return out;
}

function textFromContent(content: string): string {
  const parts: string[] = [];
  for (const block of content.matchAll(/BT([\s\S]*?)ET/g)) {
    const body = block[1]!;
    for (const m of body.matchAll(/\((?:\\.|[^\\)])*\)\s*(?:Tj|'|")|\[((?:\\.|[^\]])*)\]\s*TJ|(T\*|Td|TD)/g)) {
      if (m[3]) {
        parts.push(" ");
        continue;
      }
      if (m[2] !== undefined) {
        for (const s of m[2].matchAll(/\((?:\\.|[^\\)])*\)/g)) parts.push(decodePdfString(s[0].slice(1, -1)));
        continue;
      }
      const str = /\(((?:\\.|[^\\)])*)\)/.exec(m[0]);
      if (str) parts.push(decodePdfString(str[1]!));
    }
    parts.push("\n");
  }
  return parts.join("");
}

/** Texte lisible d'un PDF, ou null si l'extraction n'est pas fiable. */
export function extractPdfText(buf: Buffer): string | null {
  const latin = buf.toString("latin1");
  if (/\/Encrypt\b/.test(latin)) return null;
  const chunks: string[] = [];
  let inflated = 0;
  let count = 0;
  const re = /<<([^]*?)>>\s*stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin)) && count < MAX_STREAMS) {
    count++;
    const start = m.index + m[0].length;
    const end = latin.indexOf("endstream", start);
    if (end < 0) break;
    const dict = m[1]!;
    if (/\/Subtype\s*\/(Image|Font)|\/Type\s*\/(XObject|Font)|\/Length1/.test(dict)) continue;
    const raw = buf.subarray(start, end);
    let data: Buffer | null = null;
    if (/\/FlateDecode/.test(dict)) {
      try {
        data = inflateSync(raw, { maxOutputLength: Math.max(1, MAX_INFLATED - inflated) });
      } catch {
        data = null;
      }
    } else if (!/\/Filter/.test(dict)) data = raw;
    if (!data) continue;
    inflated += data.length;
    if (inflated >= MAX_INFLATED) break;
    const t = textFromContent(data.toString("latin1"));
    if (t.trim()) chunks.push(t);
  }
  const text = collapseWhitespace(chunks.join("\n")).slice(0, 200_000);
  if (text.length < 20) return null;
  const letters = (text.match(/[\p{L}\p{N}\s.,;:'’()«»%€-]/gu) ?? []).length;
  return letters / text.length >= 0.85 ? text : null;
}

export function isPdf(contentType: string, body: Buffer): boolean {
  return /application\/pdf/i.test(contentType) || body.subarray(0, 5).toString("latin1") === "%PDF-";
}

/** Observation d'un document PDF (même format qu'une page, sans prix ni disponibilité). */
export function extractPdfObservation(input: { body: Buffer; url: string; finalUrl: string; httpStatus: number; responseMs?: number; fetchedAt?: Date }): PageObservation {
  const bytesHash = createHash("sha256").update(input.body).digest("hex");
  const text = extractPdfText(input.body);
  const name = decodeURIComponent(new URL(input.finalUrl).pathname.split("/").pop() || "document.pdf").slice(0, 300);
  return {
    kind: "page",
    url: input.url,
    finalUrl: input.finalUrl,
    httpStatus: input.httpStatus,
    title: name,
    price: null,
    currency: null,
    priceSource: null,
    availability: "unknown",
    availabilitySource: "none",
    // Le document change dès que ses octets changent.
    textHash: bytesHash,
    textLength: text?.length ?? 0,
    excerpt: text ? text.slice(0, 4000) : "",
    selectorFound: null,
    method: "http",
    fetchedAt: (input.fetchedAt ?? new Date()).toISOString(),
    contentKind: "pdf",
    contentHash: text ? stableContentHash(text) : bytesHash,
    ...(input.responseMs !== undefined ? { responseMs: Math.round(input.responseMs) } : {}),
  };
}
