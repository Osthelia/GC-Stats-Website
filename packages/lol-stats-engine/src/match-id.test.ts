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
import { accountRealm, accountsOnRealm, clusterForPlatform, clusterForRegion, formatRiotId, isRiotCluster, isTournamentRealm, parseRiotId, platformOfMatchId, realmOf, riotCluster } from "./match-id";

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

describe("isTournamentRealm", () => {
  it("recognises the LOLTMNT prefix on a match id whatever number follows it", () => {
    expect(isTournamentRealm("LOLTMNT01_296476")).toBe(true);
    expect(isTournamentRealm("LOLTMNT12_1")).toBe(true);
    expect(isTournamentRealm("EUW1_296476")).toBe(false);
  });

  it("recognises the tournament realm's platforms as well", () => {
    expect(isTournamentRealm("LOLTMNT01")).toBe(true);
    expect(isTournamentRealm("EUW1")).toBe(false);
  });
});

describe("platformOfMatchId", () => {
  it("is the part before the number, for live and tournament-realm games", () => {
    expect(platformOfMatchId("EUW1_123")).toBe("EUW1");
    expect(platformOfMatchId("LOLTMNT01_296476")).toBe("LOLTMNT01");
  });

  it("is null for a malformed id", () => {
    expect(platformOfMatchId("EUW1")).toBeNull();
    expect(platformOfMatchId("euw1_1")).toBeNull();
  });
});

describe("clusterForPlatform", () => {
  it("maps live platforms to their cluster", () => {
    expect(clusterForPlatform("EUW1")).toBe("europe");
    expect(clusterForPlatform("TR1")).toBe("europe");
    expect(clusterForPlatform("BR1")).toBe("americas");
    expect(clusterForPlatform("JP1")).toBe("asia");
    expect(clusterForPlatform("VN2")).toBe("sea");
  });

  it("is null for the tournament realm and unknown platforms", () => {
    expect(clusterForPlatform("LOLTMNT03")).toBeNull();
    expect(clusterForPlatform("XX9")).toBeNull();
  });
});

describe("clusterForRegion", () => {
  it("maps the regions with one home cluster", () => {
    expect(clusterForRegion("emea")).toEqual({ kind: "cluster", cluster: "europe" });
    expect(clusterForRegion("na")).toEqual({ kind: "cluster", cluster: "americas" });
    expect(clusterForRegion("latam")).toEqual({ kind: "cluster", cluster: "americas" });
    expect(clusterForRegion("brazil")).toEqual({ kind: "cluster", cluster: "americas" });
    expect(clusterForRegion("korea")).toEqual({ kind: "cluster", cluster: "asia" });
    expect(clusterForRegion("oceania")).toEqual({ kind: "cluster", cluster: "sea" });
  });

  it("leaves the choice to the admin when a region has no single cluster", () => {
    for (const key of ["pacific", "international", "other", ""]) expect(clusterForRegion(key)).toEqual({ kind: "ask" });
  });

  it("marks China as unsupported", () => {
    expect(clusterForRegion("china")).toEqual({ kind: "unsupported" });
  });
});

describe("realmOf", () => {
  it("is the cluster of a live platform and 'tournament' for the tournament realm", () => {
    expect(realmOf({ platform: "EUW1", cluster: "europe" })).toBe("europe");
    expect(realmOf({ platform: "LOLTMNT01", cluster: null })).toBe("tournament");
  });

  it("uses the stored cluster for an account never seen in a game", () => {
    expect(realmOf({ platform: null, cluster: "asia" })).toBe("asia");
    expect(realmOf({ platform: null, cluster: null })).toBeNull();
  });
});

describe("parseRiotId", () => {
  it("splits name and tag at the last hash", () => {
    expect(parseRiotId("SLYA Pivotless#EUW")).toEqual({ gameName: "SLYA Pivotless", tagLine: "EUW" });
    expect(parseRiotId("  Caps#1234 ")).toEqual({ gameName: "Caps", tagLine: "1234" });
  });

  it("is null without a tag or with a name or tag outside Riot's limits", () => {
    expect(parseRiotId("Caps")).toBeNull();
    expect(parseRiotId("Ab#EUW")).toBeNull();
    expect(parseRiotId("AVeryLongRiotNameX#EUW")).toBeNull();
    expect(parseRiotId("Caps#EU")).toBeNull();
    expect(parseRiotId("Caps#EUWEST")).toBeNull();
    expect(parseRiotId("Ca/ps#EUW")).toBeNull();
    expect(parseRiotId("#EUW")).toBeNull();
  });
});

describe("formatRiotId", () => {
  it("joins name and tag", () => {
    expect(formatRiotId({ riotIdGameName: "SLYA Pivotless", riotIdTagline: "EUW" })).toBe("SLYA Pivotless#EUW");
  });

  it("formats an account the same way", () => {
    expect(formatRiotId({ gameName: "SLYA Pivotless", tagLine: "EUW" })).toBe("SLYA Pivotless#EUW");
  });

  it("is the name alone without a tag, and null without a name", () => {
    expect(formatRiotId({ riotIdGameName: "Caps" })).toBe("Caps");
    expect(formatRiotId({ riotIdTagline: "EUW" })).toBeNull();
    expect(formatRiotId({})).toBeNull();
  });
});

describe("isRiotCluster", () => {
  it("is true for the four clusters only", () => {
    for (const cluster of ["americas", "europe", "asia", "sea"]) expect(isRiotCluster(cluster)).toBe(true);
    for (const other of ["tournament", "EUW1", "", null, undefined, 3]) expect(isRiotCluster(other)).toBe(false);
  });
});

describe("accountsOnRealm", () => {
  const account = (puuid: string, platform: string | null, cluster: string | null = null) => ({ puuid, platform, cluster });
  const accounts = [account("a", "EUW1"), account("b", "KR"), account("c", "LOLTMNT01"), account("d", null, "europe"), account("e", null, null)];

  it("keeps the accounts of a live cluster, including ones only looked up there", () => {
    expect(accountsOnRealm(accounts, "europe").map((a) => a.puuid)).toEqual(["a", "d"]);
  });

  it("keeps the tournament realm accounts for 'tournament'", () => {
    expect(accountsOnRealm(accounts, "tournament").map((a) => a.puuid)).toEqual(["c"]);
  });

  it("is empty for an unknown realm", () => {
    expect(accountsOnRealm(accounts, null)).toEqual([]);
  });
});

describe("accountRealm", () => {
  it("is the tournament realm for its platforms and live for everything else, also before a game was seen", () => {
    expect(accountRealm("LOLTMNT01")).toBe("tournament");
    expect(accountRealm("EUW1")).toBe("live");
    expect(accountRealm(null)).toBe("live");
  });
});
