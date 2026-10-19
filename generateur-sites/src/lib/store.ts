import "server-only";
import { del, get, list, put } from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";

// Stockage de tous les fichiers (sites, commandes, réglages, photos).
// En production : Blob store privé Vercel. En local, sans BLOB_READ_WRITE_TOKEN : dossier .data/ (développement, ou LOCAL_DATA=1 pour un test).

const blob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const ROOT = path.join(process.cwd(), ".data");

export function storageEnabled() {
  return blob() || process.env.NODE_ENV !== "production" || process.env.LOCAL_DATA === "1";
}

const TYPES: Record<string, string> = { json: "application/json", jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const typeOf = (p: string) => TYPES[p.split(".").pop() ?? ""] ?? "application/octet-stream";

function local(p: string) {
  const full = path.join(ROOT, p);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Chemin invalide");
  return full;
}

export async function putFile(pathname: string, body: string | Buffer, contentType = typeOf(pathname)) {
  if (blob()) {
    await put(pathname, body, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
    return;
  }
  const file = local(pathname);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body);
}

export async function getFile(pathname: string): Promise<{ body: Buffer; contentType: string } | null> {
  if (blob()) {
    const res = await get(pathname, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return null;
    return { body: Buffer.from(await new Response(res.stream).arrayBuffer()), contentType: res.blob.contentType };
  }
  try {
    return { body: await fs.readFile(local(pathname)), contentType: typeOf(pathname) };
  } catch {
    return null;
  }
}

export async function putJSON(pathname: string, value: unknown) {
  await putFile(pathname, JSON.stringify(value), "application/json");
}

export async function getJSON<T>(pathname: string): Promise<T | null> {
  try {
    const f = await getFile(pathname);
    return f ? (JSON.parse(f.body.toString("utf8")) as T) : null;
  } catch {
    return null;
  }
}

export type Entry = { pathname: string; uploadedAt: Date; url?: string };

export async function listEntries(prefix: string): Promise<Entry[]> {
  if (blob()) {
    const out: Entry[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      out.push(...page.blobs.map((b) => ({ pathname: b.pathname, uploadedAt: new Date(b.uploadedAt), url: b.url })));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  }
  const out: Entry[] = [];
  async function walk(dir: string) {
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const n of names) {
      const full = path.join(dir, n);
      const st = await fs.stat(full);
      if (st.isDirectory()) await walk(full);
      else {
        const rel = path.relative(ROOT, full).split(path.sep).join("/");
        if (rel.startsWith(prefix)) out.push({ pathname: rel, uploadedAt: st.mtime });
      }
    }
  }
  await walk(ROOT);
  return out;
}

/** Supprime des fichiers ; renvoie le nombre de fichiers supprimés. */
export async function removeFiles(entries: Entry[]) {
  if (!entries.length) return 0;
  if (blob()) {
    for (let i = 0; i < entries.length; i += 100) await del(entries.slice(i, i + 100).map((e) => e.url ?? e.pathname));
  } else {
    await Promise.all(entries.map((e) => fs.rm(local(e.pathname), { force: true })));
  }
  return entries.length;
}

export async function removeFile(pathname: string) {
  await removeFiles([{ pathname, uploadedAt: new Date() }]);
}

export async function wipePrefix(prefix: string) {
  return removeFiles(await listEntries(prefix));
}
