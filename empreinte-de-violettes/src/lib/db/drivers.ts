import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

/**
 * Stockage clé/valeur minimaliste.
 * - Upstash Redis (recommandé en production, gratuit, 1 clic sur Vercel)
 * - Fichiers JSON dans .data/ (développement local ou serveur classique)
 * - Mémoire (démo sur Vercel sans base : les modifications ne survivent pas aux redémarrages)
 */
export interface Driver {
  kind: "redis" | "file" | "memory";
  persistent: boolean;
  hgetall(key: string): Promise<Record<string, unknown>>;
  hget(key: string, field: string): Promise<unknown | null>;
  hset(key: string, field: string, value: unknown): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

const PREFIX = process.env.STORE_PREFIX || "ev";

class RedisDriver implements Driver {
  kind = "redis" as const;
  persistent = true;
  private r: Redis;
  constructor(url: string, token: string) {
    this.r = new Redis({ url, token, automaticDeserialization: false });
  }
  private k(key: string) {
    return `${PREFIX}:${key}`;
  }
  async hgetall(key: string) {
    const raw = (await this.r.hgetall<Record<string, string>>(this.k(key))) || {};
    const out: Record<string, unknown> = {};
    for (const [f, v] of Object.entries(raw)) out[f] = typeof v === "string" ? JSON.parse(v) : v;
    return out;
  }
  async hget(key: string, field: string) {
    const v = await this.r.hget<string>(this.k(key), field);
    return v == null ? null : typeof v === "string" ? JSON.parse(v) : v;
  }
  async hset(key: string, field: string, value: unknown) {
    await this.r.hset(this.k(key), { [field]: JSON.stringify(value) });
  }
  async hdel(key: string, field: string) {
    await this.r.hdel(this.k(key), field);
  }
  async get(key: string) {
    const v = await this.r.get<string>(this.k(key));
    return v == null ? null : typeof v === "string" ? JSON.parse(v) : v;
  }
  async set(key: string, value: unknown) {
    await this.r.set(this.k(key), JSON.stringify(value));
  }
  async del(key: string) {
    await this.r.del(this.k(key));
  }
}

type Bag = Map<string, unknown>;

class MemoryDriver implements Driver {
  kind = "memory" as const;
  persistent = false;
  private bag: Bag;
  constructor() {
    const g = globalThis as unknown as { __evMemory?: Bag };
    g.__evMemory ??= new Map();
    this.bag = g.__evMemory;
  }
  private clone<T>(v: T): T {
    return v == null ? v : (JSON.parse(JSON.stringify(v)) as T);
  }
  async hgetall(key: string) {
    return this.clone((this.bag.get(key) as Record<string, unknown>) || {});
  }
  async hget(key: string, field: string) {
    const h = (this.bag.get(key) as Record<string, unknown>) || {};
    return this.clone(h[field] ?? null);
  }
  async hset(key: string, field: string, value: unknown) {
    const h = ((this.bag.get(key) as Record<string, unknown>) || {}) as Record<string, unknown>;
    h[field] = this.clone(value);
    this.bag.set(key, h);
  }
  async hdel(key: string, field: string) {
    const h = (this.bag.get(key) as Record<string, unknown>) || {};
    delete h[field];
    this.bag.set(key, h);
  }
  async get(key: string) {
    return this.clone(this.bag.get(key) ?? null);
  }
  async set(key: string, value: unknown) {
    this.bag.set(key, this.clone(value));
  }
  async del(key: string) {
    this.bag.delete(key);
  }
}

class FileDriver implements Driver {
  kind = "file" as const;
  persistent = true;
  private dir: string;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(dir: string) {
    this.dir = dir;
  }
  private file(key: string) {
    return path.join(this.dir, key.replace(/[^a-z0-9_-]/gi, "_") + ".json");
  }
  private async read(key: string): Promise<unknown | null> {
    try {
      return JSON.parse(await fs.readFile(this.file(key), "utf8"));
    } catch {
      return null;
    }
  }
  private write(key: string, value: unknown) {
    // écritures sérialisées + renommage atomique
    const run = async () => {
      await fs.mkdir(this.dir, { recursive: true });
      const tmp = this.file(key) + "." + process.pid + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(value, null, 1));
      await fs.rename(tmp, this.file(key));
    };
    this.queue = this.queue.then(run, run);
    return this.queue as Promise<void>;
  }
  private mutate(key: string, fn: (h: Record<string, unknown>) => void) {
    const run = async () => {
      const h = ((await this.read(key)) as Record<string, unknown>) || {};
      fn(h);
      await fs.mkdir(this.dir, { recursive: true });
      const tmp = this.file(key) + "." + process.pid + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(h, null, 1));
      await fs.rename(tmp, this.file(key));
    };
    this.queue = this.queue.then(run, run);
    return this.queue as Promise<void>;
  }
  async hgetall(key: string) {
    await this.queue;
    return ((await this.read(key)) as Record<string, unknown>) || {};
  }
  async hget(key: string, field: string) {
    const h = await this.hgetall(key);
    return h[field] ?? null;
  }
  async hset(key: string, field: string, value: unknown) {
    await this.mutate(key, (h) => {
      h[field] = value;
    });
  }
  async hdel(key: string, field: string) {
    await this.mutate(key, (h) => {
      delete h[field];
    });
  }
  async get(key: string) {
    await this.queue;
    return this.read(key);
  }
  async set(key: string, value: unknown) {
    await this.write(key, value);
  }
  async del(key: string) {
    await this.queue;
    await fs.rm(this.file(key), { force: true });
  }
}

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (driver) return driver;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) driver = new RedisDriver(url, token);
  else if (process.env.VERCEL || process.env.STORE_DRIVER === "memory") driver = new MemoryDriver();
  else driver = new FileDriver(path.join(process.cwd(), ".data"));
  return driver;
}
