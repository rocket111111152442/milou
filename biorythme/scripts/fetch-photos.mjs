// Copie les photos de l'ancien site dans public/photos/ pour ne plus en dépendre.
// Jamais bloquant : une photo manquante sera chargée depuis l'original.
import { mkdir, readFile, writeFile, access } from "node:fs/promises";

const src = await readFile(new URL("../lib/photos.ts", import.meta.url), "utf8");
const entries = [...src.matchAll(/(\w+): \{ path: "([^"]+)"/g)].map((m) => ({ key: m[1], path: m[2] }));
const dir = new URL("../public/photos/", import.meta.url);
await mkdir(dir, { recursive: true });

let ok = 0;
await Promise.all(
  entries.map(async ({ key, path }) => {
    const file = new URL(`${key}.jpeg`, dir);
    try {
      await access(file);
      ok++;
      return;
    } catch {}
    const [id, name] = path.split("/");
    const url = `https://www.biorythme.fr/uploads/${id}/767x0_2560x0/${name}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      ok++;
    } catch (err) {
      console.warn(`[photos] ${key} non copiée (${err.message}), l'original sera utilisé.`);
    }
  }),
);
console.log(`[photos] ${ok}/${entries.length} photos disponibles localement.`);
