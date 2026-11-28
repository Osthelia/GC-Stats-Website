/**
 * GC-Stats — find-games.test module
 *
 * The search window, the seed accounts, the merge of match ids and the check of a found game against the two teams.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { checkFoundGame, defaultSearchWindow, isPossibleRemake, isValidSearchWindow, mergeMatchIds, pickSeedAccounts, sharedMatchIds, type FoundParticipant } from "./find-games";

describe("defaultSearchWindow", () => {
  it("is one hour before to four hours after the scheduled time", () => {
    const window = defaultSearchWindow(new Date("2026-03-01T18:00:00Z"))!;
    expect(window.start.toISOString()).toBe("2026-03-01T17:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-03-01T22:00:00.000Z");
  });

  it("is null without a scheduled time", () => {
    expect(defaultSearchWindow(null)).toBeNull();
  });
});

describe("isValidSearchWindow", () => {
  const at = (iso: string) => new Date(iso);

  it("accepts a forward range of up to 48 hours", () => {
    expect(isValidSearchWindow({ start: at("2026-03-01T00:00Z"), end: at("2026-03-01T09:00Z") })).toBe(true);
    expect(isValidSearchWindow({ start: at("2026-03-01T00:00Z"), end: at("2026-03-03T00:00Z") })).toBe(true);
  });

  it("refuses an empty, backwards, too wide or invalid range", () => {
    expect(isValidSearchWindow({ start: at("2026-03-01T00:00Z"), end: at("2026-03-01T00:00Z") })).toBe(false);
    expect(isValidSearchWindow({ start: at("2026-03-02T00:00Z"), end: at("2026-03-01T00:00Z") })).toBe(false);
    expect(isValidSearchWindow({ start: at("2026-03-01T00:00Z"), end: at("2026-03-03T00:00:01Z") })).toBe(false);
    expect(isValidSearchWindow({ start: new Date("nope"), end: at("2026-03-01T00:00Z") })).toBe(false);
  });
});

describe("pickSeedAccounts", () => {
  const account = (puuid: string, platform: string | null, lastSeen: string | null, cluster: string | null = null) => ({
    puuid,
    platform,
    cluster,
    lastSeenAt: lastSeen === null ? null : new Date(lastSeen),
  });

  it("keeps the live accounts of the cluster, the most recently seen first", () => {
    const picked = pickSeedAccounts(
      [account("old", "EUW1", "2026-01-01T00:00Z"), account("new", "EUN1", "2026-03-01T00:00Z"), account("kr", "KR", "2026-04-01T00:00Z"), account("realm", "LOLTMNT01", "2026-05-01T00:00Z")],
      "europe"
    );
    expect(picked.map((a) => a.puuid)).toEqual(["new", "old"]);
  });

  it("puts an account never seen in a game last, using the cluster it was looked up in", () => {
    const picked = pickSeedAccounts([account("unseen", null, null, "europe"), account("seen", "EUW1", "2026-01-01T00:00Z")], "europe");
    expect(picked.map((a) => a.puuid)).toEqual(["seen", "unseen"]);
  });

  it("stops at the limit", () => {
    const many = ["a", "b", "c", "d"].map((id, i) => account(id, "EUW1", `2026-01-0${i + 1}T00:00Z`));
    expect(pickSeedAccounts(many, "europe").map((a) => a.puuid)).toEqual(["d", "c"]);
    expect(pickSeedAccounts(many, "europe", 1).map((a) => a.puuid)).toEqual(["d"]);
  });
});

describe("mergeMatchIds", () => {
  it("lists each id once, the ones in more lists first", () => {
    expect(mergeMatchIds([["EUW1_1", "EUW1_2"], ["EUW1_2", "EUW1_3"]])).toEqual(["EUW1_2", "EUW1_1", "EUW1_3"]);
  });

  it("keeps a game two accounts share when the limit cuts the rest", () => {
    const a = ["A1", "A2", "A3", "SHARED"];
    const b = ["B1", "B2", "B3", "SHARED"];
    expect(mergeMatchIds([a, b], 3)).toEqual(["SHARED", "A1", "B1"]);
  });

  it("takes from each list in turn before the limit cuts", () => {
    const merged = mergeMatchIds([["A1", "A2", "A3", "A4"], ["B1", "B2"]], 4);
    expect(merged).toEqual(["A1", "B1", "A2", "B2"]);
  });

  it("is empty for no lists", () => {
    expect(mergeMatchIds([])).toEqual([]);
  });
});

describe("sharedMatchIds", () => {
  it("keeps the ids that are in a list of every group", () => {
    const typedA = [["G1", "G2", "G3"]];
    const typedB = [["G9", "G2", "G3"]];
    expect(sharedMatchIds([typedA, typedB])).toEqual(["G2", "G3"]);
  });

  it("counts a group as met when any of its lists has the id (a team's seed accounts)", () => {
    const teamA = [["G1"], ["G2", "G5"]];
    const teamB = [["G2"], ["G7"]];
    expect(sharedMatchIds([teamA, teamB])).toEqual(["G2"]);
  });

  it("is empty when nothing is shared, or when there are fewer than two groups", () => {
    expect(sharedMatchIds([[["A"]], [["B"]]])).toEqual([]);
    expect(sharedMatchIds([[["A", "B"]]])).toEqual([]);
    expect(sharedMatchIds([])).toEqual([]);
  });

  it("cuts to the limit", () => {
    const ids = Array.from({ length: 15 }, (_, i) => `G${i}`);
    expect(sharedMatchIds([[ids], [ids]])).toHaveLength(10);
    expect(sharedMatchIds([[ids], [ids]], 3)).toEqual(["G0", "G1", "G2"]);
  });
});

describe("isPossibleRemake", () => {
  it("flags games under five minutes", () => {
    expect(isPossibleRemake(179)).toBe(true);
    expect(isPossibleRemake(299)).toBe(true);
    expect(isPossibleRemake(300)).toBe(false);
  });
});

describe("checkFoundGame", () => {
  const side = (side: "blue" | "red", names: string[], puuidPrefix: string): FoundParticipant[] => names.map((riotName, i) => ({ puuid: `${puuidPrefix}${i}`, side, riotName }));
  const players = [...side("blue", ["AaA", "BbB", "CcC", "DdD", "EeE"], "a"), ...side("red", ["Fox One", "Two", "Three", "Four", "Five"], "r")];
  const accountsOf = (prefix: string, count: number) => new Set(Array.from({ length: count }, (_, i) => `${prefix}${i}`));
  const none = new Set<string>();

  it("finds both teams on their own sides", () => {
    const check = checkFoundGame(players, { accounts: { a: accountsOf("a", 4), b: accountsOf("r", 3) }, names: { a: [], b: [] } });
    expect(check.status).toBe("both");
    expect(check.sideOf).toEqual({ a: "blue", b: "red" });
    expect(check.known.blue.a).toBe(4);
    expect(check.known.red.b).toBe(3);
    expect(check.players).toEqual({ blue: 5, red: 5 });
  });

  it("puts a team on the side that holds more of its accounts", () => {
    const check = checkFoundGame(players, { accounts: { a: new Set(["a0", "r0", "r1"]), b: none }, names: { a: [], b: [] } });
    expect(check.sideOf.a).toBe("red");
  });

  it("puts the other team on the opposite side when only one is known, and counts its names against the roster", () => {
    const check = checkFoundGame(players, { accounts: { a: accountsOf("a", 3), b: none }, names: { a: [], b: ["Fox", "Nobody", "Three"] } });
    expect(check.status).toBe("one");
    expect(check.sideOf).toEqual({ a: "blue", b: "red" });
    // "Fox" sits inside "Fox One", "Three" is the same name; "Nobody" is on neither side.
    expect(check.nameMatches).toEqual({ blue: null, red: 2 });
  });

  it("works the same when only the second team is known", () => {
    const check = checkFoundGame(players, { accounts: { a: none, b: accountsOf("r", 2) }, names: { a: ["AaA"], b: [] } });
    expect(check.status).toBe("one");
    expect(check.sideOf).toEqual({ a: "blue", b: "red" });
    expect(check.nameMatches.blue).toBe(1);
  });

  it("claims nothing when no account is known", () => {
    const check = checkFoundGame(players, { accounts: { a: none, b: none }, names: { a: ["AaA"], b: ["Fox One"] } });
    expect(check.status).toBe("none");
    expect(check.sideOf).toEqual({ a: null, b: null });
    expect(check.nameMatches).toEqual({ blue: null, red: null });
  });

  it("claims nothing when both teams are found on the same side", () => {
    const check = checkFoundGame(players, { accounts: { a: accountsOf("a", 2), b: new Set(["a3", "a4"]) }, names: { a: [], b: [] } });
    expect(check.status).toBe("none");
    expect(check.sideOf).toEqual({ a: null, b: null });
  });

  it("does not decide a side on an even split", () => {
    const check = checkFoundGame(players, { accounts: { a: new Set(["a0", "r0"]), b: none }, names: { a: [], b: [] } });
    expect(check.sideOf.a).toBeNull();
    expect(check.status).toBe("none");
  });
});
