import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

/** Version of data/knowledge/base-conocimiento.md (date of the source document). */
export const KNOWLEDGE_VERSION = "2026-11-26";

let cached: string | null = null;
export function knowledgeBase(): string {
  if (cached) return cached;
  const raw = readFileSync(path.join(process.cwd(), "data/knowledge/base-conocimiento.md"), "utf8");
  cached = raw.replace(/<!--[\s\S]*?-->/g, "").trim();
  return cached;
}
