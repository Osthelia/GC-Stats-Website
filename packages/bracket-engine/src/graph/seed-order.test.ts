/**
 * GC-Stats — seed-order.test module
 *
 * Tests nextPowerOfTwo and buildStandardSeedOrder's classic seeding output.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { buildStandardSeedOrder, nextPowerOfTwo } from "./seed-order";

describe("nextPowerOfTwo", () => {
  it.each([
    [0, 1],
    [1, 1],
    [2, 2],
    [3, 4],
    [4, 4],
    [5, 8],
    [8, 8],
    [9, 16],
    [16, 16],
  ])("nextPowerOfTwo(%i) === %i", (input, expected) => {
    expect(nextPowerOfTwo(input)).toBe(expected);
  });
});

describe("buildStandardSeedOrder", () => {
  it.each([
    [1, [1]],
    [2, [1, 2]],
    [4, [1, 4, 2, 3]],
    [8, [1, 8, 4, 5, 2, 7, 3, 6]],
    [16, [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]],
  ])("builds the classic order for size=%i", (size, expected) => {
    expect(buildStandardSeedOrder(size)).toEqual(expected);
  });

  it("rejects a size that is not a power of two", () => {
    expect(() => buildStandardSeedOrder(3)).toThrow(/power of two/);
    expect(() => buildStandardSeedOrder(5)).toThrow(/power of two/);
    expect(() => buildStandardSeedOrder(6)).toThrow(/power of two/);
  });

  it("returns every seed from 1 to size exactly once", () => {
    const order = buildStandardSeedOrder(16);
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
});
