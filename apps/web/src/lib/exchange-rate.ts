/**
 * GC-Stats - exchange-rate
 *
 * EUR/USD exchange rate, used by admin finance entry creation to convert a
 * single entered amount into both currencies stored on `financeEntries`.
 * Cached in-memory for 6h per server process so entry creation never waits
 * on frankfurter.app on every submit. A failed lookup falls back to a 1:1
 * rate rather than blocking the write, but is reported as `stale` so the
 * caller can warn the admin.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
let cached: { rate: number; expiresAt: number } | null = null;
const CACHE_MS = 6 * 60 * 60 * 1000;

export async function eurToUsd(): Promise<{ rate: number; stale: boolean }> {
  if (cached && cached.expiresAt > Date.now()) return { rate: cached.rate, stale: false };

  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.error(`eurToUsd: frankfurter.app returned ${res.status}, falling back to 1:1 rate`);
      return { rate: 1, stale: true };
    }
    const data = (await res.json()) as { rates?: { USD?: number } };
    const rate = data.rates?.USD;
    if (typeof rate !== "number" || !Number.isFinite(rate)) {
      console.error("eurToUsd: malformed frankfurter.app response, falling back to 1:1 rate");
      return { rate: 1, stale: true };
    }
    cached = { rate, expiresAt: Date.now() + CACHE_MS };
    return { rate, stale: false };
  } catch (err) {
    console.error("eurToUsd: frankfurter.app request failed, falling back to 1:1 rate", err);
    return { rate: 1, stale: true };
  }
}
