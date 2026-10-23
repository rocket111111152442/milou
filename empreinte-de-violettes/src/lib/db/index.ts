import "server-only";
import { getDriver } from "./drivers";
import * as seed from "../seed";
import type { CollectionMap, CollectionName, DocMap, DocName } from "../types";

const SEED_VERSION = "v1";

const seedCollections: { [K in CollectionName]: CollectionMap[K][] } = {
  products: seed.seedProducts,
  categories: seed.seedCategories,
  occasions: seed.seedOccasions,
  addons: seed.seedAddons,
  orders: [],
  promos: seed.seedPromos,
  messages: [],
  reviews: seed.seedReviews,
  faqs: seed.seedFaqs,
  gallery: seed.seedGallery,
  subscribers: [],
};

const seedDocs: DocMap = {
  settings: seed.seedSettings,
  delivery: seed.seedDelivery,
  content: seed.seedContent,
  atelier: seed.seedAtelier,
};

let seeding: Promise<void> | null = null;

async function ensureSeeded() {
  if (!seeding) {
    seeding = (async () => {
      const d = getDriver();
      const flag = await d.get(`seeded:${SEED_VERSION}`);
      if (flag) return;
      for (const [col, items] of Object.entries(seedCollections)) {
        for (const item of items as { id: string }[]) await d.hset(`col:${col}`, item.id, item);
      }
      for (const [name, value] of Object.entries(seedDocs)) {
        if (!(await d.get(`doc:${name}`))) await d.set(`doc:${name}`, value);
      }
      await d.set(`seeded:${SEED_VERSION}`, new Date().toISOString());
    })().catch((e) => {
      seeding = null;
      throw e;
    });
  }
  return seeding;
}

export async function list<K extends CollectionName>(col: K): Promise<CollectionMap[K][]> {
  await ensureSeeded();
  const all = await getDriver().hgetall(`col:${col}`);
  return Object.values(all) as CollectionMap[K][];
}

export async function get<K extends CollectionName>(col: K, id: string): Promise<CollectionMap[K] | null> {
  await ensureSeeded();
  return (await getDriver().hget(`col:${col}`, id)) as CollectionMap[K] | null;
}

export async function put<K extends CollectionName>(col: K, item: CollectionMap[K]): Promise<CollectionMap[K]> {
  await ensureSeeded();
  await getDriver().hset(`col:${col}`, (item as { id: string }).id, item);
  return item;
}

export async function remove(col: CollectionName, id: string) {
  await ensureSeeded();
  await getDriver().hdel(`col:${col}`, id);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Fusionne les valeurs par défaut avec le document stocké (ajout de nouveaux champs sans casser l'existant). */
function withDefaults<T>(def: T, stored: unknown): T {
  if (!isObj(def) || !isObj(stored)) return (stored ?? def) as T;
  const out: Record<string, unknown> = { ...def };
  for (const [k, v] of Object.entries(stored)) {
    out[k] = isObj(v) && isObj((def as Record<string, unknown>)[k]) ? withDefaults((def as Record<string, unknown>)[k], v) : v;
  }
  return out as T;
}

export async function getDoc<K extends DocName>(name: K): Promise<DocMap[K]> {
  await ensureSeeded();
  const stored = await getDriver().get(`doc:${name}`);
  return withDefaults(seedDocs[name], stored);
}

export async function setDoc<K extends DocName>(name: K, value: DocMap[K]) {
  await ensureSeeded();
  await getDriver().set(`doc:${name}`, value);
}

export function storageInfo() {
  const d = getDriver();
  return { kind: d.kind, persistent: d.persistent };
}

export async function exportAll() {
  const data: Record<string, unknown> = {};
  for (const col of Object.keys(seedCollections) as CollectionName[]) data[col] = await list(col);
  for (const name of Object.keys(seedDocs) as DocName[]) data[name] = await getDoc(name);
  return { exportedAt: new Date().toISOString(), version: SEED_VERSION, data };
}

export async function importAll(payload: { data: Record<string, unknown> }) {
  await ensureSeeded();
  const d = getDriver();
  for (const col of Object.keys(seedCollections) as CollectionName[]) {
    const items = payload.data[col];
    if (!Array.isArray(items)) continue;
    await d.del(`col:${col}`);
    for (const item of items as { id: string }[]) if (item?.id) await d.hset(`col:${col}`, item.id, item);
  }
  for (const name of Object.keys(seedDocs) as DocName[]) {
    if (isObj(payload.data[name])) await d.set(`doc:${name}`, payload.data[name]);
  }
}

export async function resetToDemo() {
  const d = getDriver();
  for (const col of Object.keys(seedCollections)) await d.del(`col:${col}`);
  for (const name of Object.keys(seedDocs)) await d.del(`doc:${name}`);
  await d.del(`seeded:${SEED_VERSION}`);
  seeding = null;
  await ensureSeeded();
}

export function newId(prefix: string) {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 12);
  return `${prefix}_${rand}`;
}
