import { describe, expect, it } from "vitest";
import { buildCatalogOf, buildOptionsOf, type BuildOptionFiles } from "./league-build-options";

const files: BuildOptionFiles = {
  items: {
    data: {
      "1055": { name: "Doran's Blade", maps: { "11": true, "12": true } },
      "221055": { name: "Doran's Blade", maps: { "11": true } },
      "3340": { name: "Stealth Ward", tags: ["Trinket", "Vision"], maps: { "11": true } },
      "3031": { name: "Infinity Edge", maps: { "11": true } },
      "3112": { name: "Guardian's Orb", maps: { "11": false, "12": true } },
    },
  },
  summoners: {
    data: {
      SummonerFlash: { key: "4", name: "Flash", modes: ["CLASSIC", "ARAM"] },
      SummonerSnowball: { key: "32", name: "Mark", modes: ["ARAM"] },
      SummonerDot: { key: "14", name: "Ignite", modes: ["CLASSIC"] },
    },
  },
  runeStyles: [
    { id: 8100, name: "Domination", slots: [{ runes: [{ id: 8112, name: "Electrocute" }] }, { runes: [{ id: 8126, name: "Cheap Shot" }] }] },
    { id: 8000, name: "Precision", slots: [{ runes: [{ id: 8010, name: "Conqueror" }] }] },
  ],
};

describe("buildOptionsOf", () => {
  it("offers the Summoner's Rift items once by name, with the trinkets apart", () => {
    const options = buildOptionsOf(files);
    expect(options.items).toEqual([
      { id: 1055, name: "Doran's Blade" },
      { id: 3031, name: "Infinity Edge" },
    ]);
    expect(options.trinkets).toEqual([{ id: 3340, name: "Stealth Ward" }]);
  });

  it("offers the summoner spells of a normal game, the keystones with their trees, and the trees", () => {
    const options = buildOptionsOf(files);
    expect(options.summoners).toEqual([
      { id: 4, name: "Flash" },
      { id: 14, name: "Ignite" },
    ]);
    expect(options.keystones).toEqual([
      { id: 8010, name: "Conqueror", treeId: 8000 },
      { id: 8112, name: "Electrocute", treeId: 8100 },
    ]);
    expect(options.trees.map((tree) => tree.name)).toEqual(["Domination", "Precision"]);
    expect(buildCatalogOf(options).keystones.get(8112)).toBe(8100);
  });
});
