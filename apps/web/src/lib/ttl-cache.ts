/**
 * GC-Stats - ttl-cache
 *
 * Small in-memory TTL cache with a hard entry cap, for lookups keyed by
 * caller-supplied values (API keys, OAuth client ids, bearer tokens) where an
 * unbounded Map would let anyone grow memory with random keys.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export class TtlCache<V> {
  private entries = new Map<string, { value: V; expiresAt: number }>();

  constructor(
    private ttlMs: number,
    private maxEntries: number,
  ) {}

  /** `undefined` means "not cached", a cached `null` is a real (negative) value. */
  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) this.evict();
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
    // Still full: drop the oldest insertions (Map keeps insertion order).
    const overflow = this.entries.size - this.maxEntries + 1;
    if (overflow <= 0) return;
    let dropped = 0;
    for (const key of this.entries.keys()) {
      if (dropped++ >= overflow) break;
      this.entries.delete(key);
    }
  }
}
