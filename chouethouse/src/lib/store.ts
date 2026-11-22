import "server-only";
import { get, put, del } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import type { Activity, ContactRequest, Post } from "./types";
import { SEED_ACTIVITIES, SEED_POSTS } from "./seed";

/**
 * Stockage :
 *  - en production : Vercel Blob (store PRIVÉ) -> data/*.json + uploads/*
 *  - en local sans BLOB_READ_WRITE_TOKEN : fichiers dans .data/
 */
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const LOCAL_DIR = path.join(process.cwd(), ".data");

type Collections = {
  activities: Activity[];
  posts: Post[];
  requests: ContactRequest[];
};

const SEEDS: Collections = {
  activities: SEED_ACTIVITIES,
  posts: SEED_POSTS,
  requests: [],
};

async function streamToText(stream: ReadableStream<Uint8Array>) {
  return await new Response(stream).text();
}

async function readCollection<K extends keyof Collections>(name: K): Promise<Collections[K]> {
  try {
    if (useBlob()) {
      const res = await get(`data/${name}.json`, { access: "private", useCache: false });
      if (!res || !res.stream) return structuredClone(SEEDS[name]);
      return JSON.parse(await streamToText(res.stream)) as Collections[K];
    }
    const file = path.join(LOCAL_DIR, `${name}.json`);
    const txt = await fs.readFile(file, "utf8");
    return JSON.parse(txt) as Collections[K];
  } catch (e) {
    if (useBlob()) console.error(`[store] lecture ${name} impossible`, e);
    return structuredClone(SEEDS[name]);
  }
}

async function writeCollection<K extends keyof Collections>(name: K, data: Collections[K]) {
  const body = JSON.stringify(data, null, 2);
  if (useBlob()) {
    await put(`data/${name}.json`, body, {
      access: "private",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return;
  }
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, `${name}.json`), body, "utf8");
}

const byDate = (a: { date: string; start?: string }, b: { date: string; start?: string }) =>
  (a.date + (a.start ?? "")).localeCompare(b.date + (b.start ?? ""));

/* ---------- Activités ---------- */
export async function getActivities({ includeDrafts = false } = {}) {
  const list = await readCollection("activities");
  return list
    .filter((a) => includeDrafts || a.published)
    .map((a) => ({
      ...a,
      // anciennes illustrations remplacées par des photos (dossier renommé)
      image: a.image?.replace("/images/ateliers/", "/images/photos/") ?? a.image,
      sessions: [...(a.sessions ?? [])].sort(byDate),
    }));
}

export async function getActivity(slug: string) {
  return (await getActivities()).find((a) => a.slug === slug) ?? null;
}

export async function saveActivity(activity: Activity) {
  const list = await readCollection("activities");
  const i = list.findIndex((a) => a.id === activity.id);
  const item = { ...activity, updatedAt: new Date().toISOString() };
  if (i >= 0) list[i] = item;
  else list.unshift(item);
  await writeCollection("activities", list);
  return item;
}

export async function deleteActivity(id: string) {
  const list = await readCollection("activities");
  await writeCollection("activities", list.filter((a) => a.id !== id));
}

/* ---------- Blog ---------- */
export async function getPosts({ includeDrafts = false } = {}) {
  const list = await readCollection("posts");
  return list
    .filter((p) => includeDrafts || p.published)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPost(slug: string) {
  return (await getPosts()).find((p) => p.slug === slug) ?? null;
}

export async function savePost(post: Post) {
  const list = await readCollection("posts");
  const i = list.findIndex((p) => p.id === post.id);
  const item = { ...post, updatedAt: new Date().toISOString() };
  if (i >= 0) list[i] = item;
  else list.unshift(item);
  await writeCollection("posts", list);
  return item;
}

export async function deletePost(id: string) {
  const list = await readCollection("posts");
  await writeCollection("posts", list.filter((p) => p.id !== id));
}

/* ---------- Demandes (formulaires) ---------- */
export async function getRequests() {
  const list = await readCollection("requests");
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addRequest(req: ContactRequest) {
  const list = await readCollection("requests");
  list.unshift(req);
  await writeCollection("requests", list.slice(0, 1000));
}

export async function updateRequest(id: string, patch: Partial<ContactRequest>) {
  const list = await readCollection("requests");
  const i = list.findIndex((r) => r.id === id);
  if (i >= 0) list[i] = { ...list[i], ...patch };
  await writeCollection("requests", list);
}

export async function deleteRequest(id: string) {
  const list = await readCollection("requests");
  await writeCollection("requests", list.filter((r) => r.id !== id));
}

/* ---------- Médias ---------- */
export async function uploadMedia(file: File) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const name = `uploads/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  if (useBlob()) {
    await put(name, file, { access: "private", addRandomSuffix: false, contentType: file.type });
  } else {
    const dest = path.join(LOCAL_DIR, name);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, Buffer.from(await file.arrayBuffer()));
  }
  return `/media/${name}`;
}

export async function readMedia(pathname: string) {
  if (useBlob()) {
    const res = await get(pathname, { access: "private" });
    if (!res || !res.stream) return null;
    return { stream: res.stream, contentType: res.blob.contentType ?? "application/octet-stream" };
  }
  try {
    const buf = await fs.readFile(path.join(LOCAL_DIR, pathname));
    const ext = pathname.split(".").pop();
    const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
    return { stream: new Blob([buf]).stream(), contentType: type };
  } catch {
    return null;
  }
}

export async function deleteMedia(pathname: string) {
  if (useBlob()) await del(pathname).catch(() => {});
}
