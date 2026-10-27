/**
 * GC-Stats — champion-catalog.test module
 *
 * Patch and version handling of the Data Dragon catalog, and the check that a game names every champion
 * it uses. No network: Data Dragon's version list is passed in as data.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { championNameOf, compareVersions, missingChampionIds, patchOf, pickDataDragonVersion, pickStoredVersion } from "./champion-catalog";
import { namesForEveryChampion } from "./test-helpers";
import type { RiotMatchDto } from "./types";

const fixturePath = fileURLToPath(new URL("./__fixtures__/lol-game-example.json", import.meta.url));
const match: RiotMatchDto = JSON.parse(readFileSync(fixturePath, "utf-8")).match;

describe("patchOf", () => {
  it("takes major and minor from a game version, and from a Data Dragon version", () => {
    expect(patchOf("15.18.712.3409")).toBe("15.18");
    expect(patchOf("15.18.1")).toBe("15.18");
  });

  it("is null for a version without a major and a minor", () => {
    expect(patchOf("15")).toBeNull();
    expect(patchOf("")).toBeNull();
    expect(patchOf("latest")).toBeNull();
  });
});

describe("compareVersions", () => {
  it("compares number by number, so 15.18.10 is newer than 15.18.9", () => {
    expect(compareVersions("15.18.10", "15.18.9")).toBeGreaterThan(0);
    expect(compareVersions("15.9.1", "15.18.1")).toBeLessThan(0);
    expect(compareVersions("15.18", "15.18.0")).toBe(0);
  });
});

describe("pickDataDragonVersion", () => {
  it("matches the whole patch, so 15.1 does not match 15.18", () => {
    expect(pickDataDragonVersion(["15.18.1"], "15.1")).toBeNull();
  });

  it("is null while the patch has no Data Dragon version yet", () => {
    expect(pickDataDragonVersion(["15.19.1", "15.18.1"], "15.20")).toBeNull();
  });
});

describe("pickStoredVersion", () => {
  it("takes the newest stored version of the game's patch or an earlier one", () => {
    expect(pickStoredVersion(["15.17.1", "15.18.1", "15.19.1"], "15.18")).toBe("15.18.1");
    expect(pickStoredVersion(["15.17", "15.16"], "15.18")).toBe("15.17");
  });

  it("compares the patch numerically inside the stored list", () => {
    expect(pickStoredVersion(["15.18.9", "15.18.10"], "15.18")).toBe("15.18.10");
  });

  it("falls back to the newest stored version at all when none is from an earlier patch", () => {
    expect(pickStoredVersion(["15.19.1", "16.1.1"], "15.18")).toBe("16.1.1");
  });

  it("is null when nothing is stored", () => {
    expect(pickStoredVersion([], "15.18")).toBeNull();
  });
});

describe("missingChampionIds", () => {
  it("is empty when the catalog names every champion of the game", () => {
    expect(missingChampionIds(match, namesForEveryChampion(match))).toEqual([]);
  });

  it("lists each champion of the game that the catalog does not name, once, sorted", () => {
    const names = namesForEveryChampion(match);
    const [first, second] = [...new Set(match.info.participants.map((p) => p.championId))].sort((a, b) => a - b);
    names.delete(second!);
    names.delete(first!);
    expect(missingChampionIds(match, names)).toEqual([first, second]);
  });
});

describe("championNameOf", () => {
  it("returns the name of a known champion", () => {
    expect(championNameOf(new Map([[103, "Ahri"]]), 103)).toBe("Ahri");
  });

  it("throws for an unknown champion instead of returning a placeholder", () => {
    expect(() => championNameOf(new Map(), 103)).toThrow("No champion name for champion id 103");
  });
});
