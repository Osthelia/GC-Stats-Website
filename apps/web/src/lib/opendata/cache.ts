/**
 * GC-Stats - opendata cache
 *
 * Per process TTL cache of the OpenData responses. Concurrent misses on the
 * same key share one load, so a burst of identical requests runs one query.
 * Kept in memory rather than in the Next data cache: full exports are larger
 * than its per entry limit.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

type Entry<T> = { value: T; expiresAt: number; bytes: number };

export class OpenDataCache<T> {
  private entries = new Map<string, Entry<T>>();
  private loading = new Map<string, Promise<T>>();
  private totalBytes = 0;

  constructor(
    private readonly maxEntries: number,
    private readonly maxBytes: number,
    private readonly sizeOf: (value: T) => number,
  ) {}

  has(key: string): boolean {
    const entry = this.entries.get(key);
    return (!!entry && entry.expiresAt > Date.now()) || this.loading.has(key);
  }

  /** `hit` is true when no query ran for this call (cached value, or joined an ongoing load). */
  async getOrLoad(key: string, ttlMs: number, loader: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      // Map keeps insertion order: re-inserting marks the entry as recently used.
      this.entries.delete(key);
      this.entries.set(key, entry);
      return { value: entry.value, hit: true };
    }
    if (entry) this.remove(key);

    const pending = this.loading.get(key);
    if (pending) return { value: await pending, hit: true };

    const promise = loader();
    this.loading.set(key, promise);
    try {
      const value = await promise;
      this.store(key, value, ttlMs);
      return { value, hit: false };
    } finally {
      this.loading.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
    this.totalBytes = 0;
  }

  private store(key: string, value: T, ttlMs: number): void {
    const bytes = this.sizeOf(value);
    if (bytes > this.maxBytes) return;
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs, bytes });
    this.totalBytes += bytes;
    for (const oldestKey of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries && this.totalBytes <= this.maxBytes) break;
      this.remove(oldestKey);
    }
  }

  private remove(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.totalBytes -= entry.bytes;
    this.entries.delete(key);
  }
}
