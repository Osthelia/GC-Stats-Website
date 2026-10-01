/**
 * GC-Stats — Bracket seeding and ordering
 *
 * Power of two rounding and the classic doubling algorithm for standard
 * tournament seed ordering (1-4-2-3, 1-8-4-5-2-7-3-6, etc.), used by every
 * bracket generator that needs a round 1 pairing order.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

/** Smallest power of two greater than or equal to n. */
export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(n));
}

/**
 * Standard seeding order for a bracket of size `size` (power of two).
 * Classic doubling algorithm: at each step, every seed s is followed by its
 * "mirror" (n + 1 - s), which produces the order 1-4-2-3 for size=4,
 * 1-8-4-5-2-7-3-6 for size=8, etc. — adjacent pairs (index 2i, 2i+1) form
 * the round 1 matches.
 */
export function buildStandardSeedOrder(size: number): number[] {
  if (size & (size - 1)) {
    throw new Error(`buildStandardSeedOrder: size must be a power of two, got ${size}`);
  }
  let seeds = [1];
  while (seeds.length < size) {
    const n = seeds.length * 2;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s, n + 1 - s);
    }
    seeds = next;
  }
  return seeds;
}
