/**
 * GC-Stats — champion-stats.test module
 *
 * Presence, win rate, the rows built from picks and bans, and the highlights with their minimum of picks. No network,
 * no database.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { buildChampionInsights, buildChampionStatRows, championPresence, championWinRate, type ChampionPickRow } from "./champion-stats";

const pick = (championName: string, picks: number, wins: number, roles: string[] = ["MIDDLE"]): ChampionPickRow => ({ championName, picks, wins, kills: picks * 3, deaths: picks, assists: picks * 4, roles });

describe("championPresence", () => {
  it("counts picks and bans against the games played", () => {
    expect(championPresence(3, 2, 10)).toBe(50);
  });
  it("is 0 without games", () => {
    expect(championPresence(0, 0, 0)).toBe(0);
  });
});

describe("championWinRate", () => {
  it("is wins over picks", () => {
    expect(championWinRate(1, 4)).toBe(25);
  });
  it("is 0 without picks", () => {
    expect(championWinRate(0, 0)).toBe(0);
  });
});

describe("buildChampionStatRows", () => {
  const rows = buildChampionStatRows([pick("Ahri", 4, 3, ["UTILITY", "MIDDLE"])], [{ championName: "Ahri", bans: 2 }, { championName: "Jinx", bans: 5 }], 10);
  const byName = new Map(rows.map((r) => [r.groupKey, r]));

  it("joins the bans of a picked champion onto its row", () => {
    expect(byName.get("Ahri")!.totals).toMatchObject({ games: 10, picks: 4, bans: 2, wins: 3, kills: 12 });
    expect(byName.get("Ahri")!.mapsPlayed).toBe(4);
  });
  it("keeps a champion that was only banned, with no picks", () => {
    expect(byName.get("Jinx")!.totals).toMatchObject({ picks: 0, bans: 5 });
    expect(byName.get("Jinx")!.mapsPlayed).toBe(0);
  });
  it("lists the roles in lane order", () => {
    expect(byName.get("Ahri")!.roles).toEqual(["MIDDLE", "UTILITY"]);
  });
});

describe("buildChampionInsights", () => {
  const rows = buildChampionStatRows([pick("Ahri", 5, 3), pick("Jinx", 1, 1), pick("Leona", 3, 3)], [{ championName: "Ahri", bans: 1 }, { championName: "Sivir", bans: 4 }], 10);
  const insight = (label: string) => buildChampionInsights(rows).find((i) => i.label === label);

  it("names the most picked and the most banned", () => {
    expect(insight("mostPicked")).toMatchObject({ championNames: ["Ahri"], value: "5" });
    expect(insight("mostBanned")).toMatchObject({ championNames: ["Sivir"], value: "4" });
  });
  it("names the highest presence", () => {
    expect(insight("highestPresence")).toMatchObject({ championNames: ["Ahri"], value: "60.0%" });
  });
  it("ignores a champion under the minimum of picks for the best win rate", () => {
    // Jinx is 1–0 but has one pick; Leona is 3–0.
    expect(insight("highestWinRate")).toMatchObject({ championNames: ["Leona"], value: "100.0%" });
  });
  it("leaves the best win rate out when nobody has enough picks", () => {
    expect(buildChampionInsights(rows, 6).find((i) => i.label === "highestWinRate")).toBeUndefined();
  });
  it("names the best KDA among the champions with enough picks", () => {
    // pick(): kills 3, deaths 1, assists 4 per pick, so Ahri and Leona both have a KDA of 7 and share the card.
    // Jinx has a far better one (14), but only one pick.
    const kdaRows = buildChampionStatRows([pick("Ahri", 3, 1), pick("Leona", 4, 2), { ...pick("Jinx", 1, 1), kills: 10, deaths: 0 }], [], 10);
    const best = buildChampionInsights(kdaRows).find((i) => i.label === "highestKda");
    expect(best).toMatchObject({ championNames: ["Ahri", "Leona"], value: "7.00" });
  });
  it("leaves the best KDA out when nobody has enough picks", () => {
    expect(buildChampionInsights(rows, 6).find((i) => i.label === "highestKda")).toBeUndefined();
  });
  it("has no highlights without rows", () => {
    expect(buildChampionInsights([])).toEqual([]);
  });
  it("lists every champion on a tie, by name", () => {
    const tied = buildChampionStatRows([pick("Zed", 2, 1), pick("Ahri", 2, 1), pick("Jinx", 1, 1)], [], 5);
    expect(buildChampionInsights(tied).find((i) => i.label === "mostPicked")).toMatchObject({ championNames: ["Ahri", "Zed"], value: "2" });
  });
  it("ties champions whose shown value is the same", () => {
    // 2 of 3 and 4 of 6 are the same win rate, 66.7%.
    const tied = buildChampionStatRows([pick("Zed", 3, 2), pick("Ahri", 6, 4), pick("Jinx", 3, 1)], [], 12);
    expect(buildChampionInsights(tied).find((i) => i.label === "highestWinRate")).toMatchObject({ championNames: ["Ahri", "Zed"], value: "66.7%" });
  });
});
