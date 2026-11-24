/**
 * Small in-memory cache with explicit freshness and a bounded stale window.
 *  - fresh (< ttl): served directly
 *  - stale (< ttl + maxStale): served only if a refresh fails (AlterEstate down / 429)
 *  - older: dropped; the caller gets the error
 * Concurrent loads of the same key share one request.
 */
interface Entry<T> { value: T; storedAt: number }

export class TtlCache {
  private store = new Map<string, Entry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();
  constructor(private maxEntries = 500) {}

  async get<T>(key: string, load: () => Promise<T>, ttlMs: number, maxStaleMs: number): Promise<{ value: T; stale: boolean }> {
    const now = Date.now();
    const hit = this.store.get(key) as Entry<T> | undefined;
    if (hit && now - hit.storedAt < ttlMs) return { value: hit.value, stale: false };

    let p = this.inflight.get(key) as Promise<T> | undefined;
    if (!p) {
      p = load();
      this.inflight.set(key, p);
      p.finally(() => this.inflight.delete(key)).catch(() => undefined);
    }
    try {
      const value = await p;
      this.set(key, value);
      return { value, stale: false };
    } catch (err) {
      if (hit && now - hit.storedAt < ttlMs + maxStaleMs) return { value: hit.value, stale: true };
      if (hit) this.store.delete(key);
      throw err;
    }
  }

  set(key: string, value: unknown) {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.delete(key);
    this.store.set(key, { value, storedAt: Date.now() });
  }

  delete(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}
