/**
 * GC-Stats — match-id.test module
 *
 * Which cluster the relay routes a Riot match id to, and the tournament realm that is never requested.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { isTournamentRealmMatchId, riotCluster } from "./match-id";

describe("riotCluster", () => {
  it("routes a match to the cluster of its platform", () => {
    expect(riotCluster("EUW1_123")).toBe("europe");
    expect(riotCluster("KR_5")).toBe("asia");
    expect(riotCluster("NA1_9")).toBe("americas");
  });

  it("is null for tournament-realm games, unknown platforms and malformed ids", () => {
    expect(riotCluster("LOLTMNT01_296476")).toBeNull();
    expect(riotCluster("XX9_1")).toBeNull();
    expect(riotCluster("euw1_1")).toBeNull();
    expect(riotCluster("EUW1")).toBeNull();
  });
});

describe("isTournamentRealmMatchId", () => {
  it("recognises the LOLTMNT prefix whatever number follows it", () => {
    expect(isTournamentRealmMatchId("LOLTMNT01_296476")).toBe(true);
    expect(isTournamentRealmMatchId("LOLTMNT12_1")).toBe(true);
    expect(isTournamentRealmMatchId("EUW1_296476")).toBe(false);
  });
});
