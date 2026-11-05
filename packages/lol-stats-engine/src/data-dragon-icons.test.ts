/**
 * GC-Stats — data-dragon-icons.test module
 *
 * The Summoner's Rift item filter and the diff of a version's icons against the stored rows.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { missingIcons, summonersRiftItemIds } from "./data-dragon-icons";

describe("summonersRiftItemIds", () => {
  it("keeps the items bought on Summoner's Rift and drops the ones of other maps", () => {
    const items = {
      "3089": { maps: { "11": true, "12": true } },
      "3115": { maps: { "11": false, "12": true } },
      "443054": { maps: { "30": true } },
      "1001": { maps: { "11": true } },
    };
    expect(summonersRiftItemIds(items)).toEqual(["1001", "3089"]);
  });

  it("drops items without a map list and keys that are not ids", () => {
    expect(summonersRiftItemIds({ "1001": {}, "x": { maps: { "11": true } } })).toEqual([]);
  });
});

describe("missingIcons", () => {
  it("returns only the icons no stored row covers", () => {
    const wanted = [
      { kind: "champions" as const, id: "Ahri" },
      { kind: "champions" as const, id: "MonkeyKing" },
      { kind: "items" as const, id: "3089" },
    ];
    const stored = [{ kind: "champions" as const, id: "Ahri" }];
    expect(missingIcons(wanted, stored)).toEqual([wanted[1], wanted[2]]);
  });

  it("treats the same id of two kinds as two icons", () => {
    const wanted = [
      { kind: "items" as const, id: "100" },
      { kind: "runes" as const, id: "100" },
    ];
    expect(missingIcons(wanted, [{ kind: "items", id: "100" }])).toEqual([wanted[1]]);
  });

  it("returns each missing icon once", () => {
    const icon = { kind: "spells" as const, id: "4" };
    expect(missingIcons([icon, icon], [])).toEqual([icon]);
  });

  it("is empty when everything is stored", () => {
    const icon = { kind: "runes" as const, id: "8000" };
    expect(missingIcons([icon], [icon])).toEqual([]);
  });
});
