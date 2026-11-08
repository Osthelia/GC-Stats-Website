/**
 * GC-Stats — account-suggestions.test module
 *
 * How the people of a team are ranked for an unknown Riot account.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { nameCloseness, rankSuggestions, type SuggestionCandidate } from "./account-suggestions";

const person = (id: number, handle: string, lanes: string[] = [], aliases: string[] = []): SuggestionCandidate => ({ id, handle, aliases, lanes });

describe("nameCloseness", () => {
  it("is 1 for the same name whatever the case, accents and punctuation", () => {
    expect(nameCloseness("Pivotless", "pivotless")).toBe(1);
    expect(nameCloseness("Rékkles", "Rekkles")).toBe(1);
    expect(nameCloseness("Mr. Fox", "mrfox")).toBe(1);
  });

  it("is high when the Riot name holds the handle (team tag plus handle)", () => {
    expect(nameCloseness("Pivotless", "SLYA Pivotless")).toBe(0.9);
  });

  it("ignores a contained name that is too short to mean anything", () => {
    expect(nameCloseness("Al", "Alexander")).toBeLessThan(0.9);
  });

  it("is between 0 and 1 for similar names and 0 for unrelated ones", () => {
    const close = nameCloseness("Caps", "Capss1");
    expect(close).toBeGreaterThan(0.5);
    expect(nameCloseness("Caps", "Zzzzz")).toBe(0);
    expect(nameCloseness("", "Caps")).toBe(0);
  });
});

describe("rankSuggestions", () => {
  const roster = [person(1, "Zed", ["TOP"]), person(2, "Pivotless", ["MIDDLE"]), person(3, "Nova", ["MIDDLE"]), person(4, "Quill", ["BOTTOM"])];

  it("puts the closest handle first", () => {
    expect(rankSuggestions("SLYA Pivotless", null, roster)[0]?.id).toBe(2);
  });

  it("uses the lane to order names that are equally far", () => {
    const ranked = rankSuggestions("Unrelated", "MIDDLE", [person(1, "Aaa", ["TOP"]), person(2, "Bbb", ["MIDDLE"])]);
    expect(ranked.map((p) => p.id)).toEqual([2, 1]);
  });

  it("matches an alias as well as the handle", () => {
    const ranked = rankSuggestions("Hylissang", null, [person(1, "Zzz"), person(2, "Hyli", [], ["Hylissang"])]);
    expect(ranked[0]?.id).toBe(2);
  });

  it("keeps handle order for equal scores and cuts to the limit", () => {
    const ranked = rankSuggestions("Unrelated", null, [person(1, "Bbb"), person(2, "Aaa"), person(3, "Ccc")], 2);
    expect(ranked.map((p) => p.handle)).toEqual(["Aaa", "Bbb"]);
  });

  it("returns nothing for no candidates", () => {
    expect(rankSuggestions("Anyone", "TOP", [])).toEqual([]);
  });
});
