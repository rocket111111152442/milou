import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FILE = join(import.meta.dirname, "../../../docs/LOAD-TEST-RESULTS.md");
const HEADER = [
  "# Résultats des tests de charge",
  "",
  "Généré par `pnpm test:load` sur la machine de test (PostgreSQL local, serveurs HTTP locaux, Chromium local).",
  "Ces chiffres décrivent l'environnement de test ; ils ne constituent pas une garantie de performance en production.",
  "",
].join("\n");

/** Remplace (ou ajoute) une section du rapport, quel que soit l'ordre d'exécution des fichiers. */
export function writeLoadSection(name: string, lines: string[]): void {
  const current = existsSync(FILE) ? readFileSync(FILE, "utf8") : HEADER;
  const block = `<!-- section:${name} -->\n${lines.join("\n")}\n<!-- /section:${name} -->`;
  const re = new RegExp(`<!-- section:${name} -->[\\s\\S]*?<!-- /section:${name} -->`);
  const next = re.test(current) ? current.replace(re, block) : `${current.trimEnd()}\n\n${block}\n`;
  writeFileSync(FILE, next.startsWith("# ") ? next : `${HEADER}\n${next}`);
}
