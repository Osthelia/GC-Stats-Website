/**
 * GC-Stats — series-stats.test module
 *
 * Kill participation and per minute rates of one game, including the cases with no kills for the team and no known game
 * length. The averages of a series' scoreboard: per player over the games they played, champions in order, unknown game
 * lengths left out of the per minute averages, and unmapped players grouped by their handle. The running score after each
 * game, and the other entrant of a series. No network, no database.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { averageSeriesLines, kdaRatio, killParticipation, otherEntrantOf, perMinute, seriesScoreThrough, type PlayerGameLine, type SeriesGameResult } from "./series-stats";

function line(overrides: Partial<PlayerGameLine>): PlayerGameLine {
  return {
    entrantId: 1,
    personId: 10,
    handle: "Top",
    championName: "Ahri",
    role: "TOP",
    kills: 0,
    deaths: 0,
    assists: 0,
    killParticipation: 0,
    csPerMinute: 0,
    goldPerMinute: 0,
    ...overrides,
  };
}

describe("killParticipation", () => {
  it("counts the kills and assists out of the team's kills", () => {
    expect(killParticipation(2, 5, 10)).toBe(70);
  });

  it("is zero when the team got no kills", () => {
    expect(killParticipation(0, 0, 0)).toBe(0);
  });
});

describe("kdaRatio", () => {
  it("is kills plus assists over deaths", () => {
    expect(kdaRatio(4, 2, 6)).toBe(5);
  });
  it("is kills plus assists without deaths", () => {
    expect(kdaRatio(4, 0, 6)).toBe(10);
  });
});

describe("perMinute", () => {
  it("divides the total by the game length in minutes", () => {
    expect(perMinute(300, 600)).toBe(30);
  });

  it("is null without a known game length", () => {
    expect(perMinute(300, null)).toBeNull();
    expect(perMinute(300, 0)).toBeNull();
  });
});

describe("averageSeriesLines", () => {
  it("sums the kills, deaths and assists and averages the rates over the games they played", () => {
    const [average] = averageSeriesLines([
      line({ kills: 2, deaths: 1, assists: 4, killParticipation: 60, csPerMinute: 6, goldPerMinute: 400 }),
      line({ kills: 4, deaths: 3, assists: 8, killParticipation: 80, csPerMinute: 8, goldPerMinute: 500 }),
    ]);
    expect(average).toMatchObject({ games: 2, kills: 6, deaths: 4, assists: 12, killParticipation: 70, csPerMinute: 7, goldPerMinute: 450, role: "TOP" });
  });

  it("averages the per minute values only over the games with a known length", () => {
    const [average] = averageSeriesLines([line({ csPerMinute: 6, goldPerMinute: 400 }), line({ csPerMinute: null, goldPerMinute: null })]);
    expect(average).toMatchObject({ csPerMinute: 6, goldPerMinute: 400 });
  });

  it("is null for a per minute value no game knows", () => {
    const [average] = averageSeriesLines([line({ csPerMinute: null, goldPerMinute: null })]);
    expect(average).toMatchObject({ csPerMinute: null, goldPerMinute: null });
  });

  it("lists the champions played, distinct and in the order they were first played", () => {
    const [average] = averageSeriesLines([line({ championName: "Ahri" }), line({ championName: "Jinx" }), line({ championName: "Ahri" })]);
    expect(average!.champions).toEqual(["Ahri", "Jinx"]);
    expect(average!.games).toBe(3);
  });

  it("keeps a player apart within each entrant and groups unmapped players by handle", () => {
    const averages = averageSeriesLines([
      line({ entrantId: 1, personId: 10, handle: "Top" }),
      line({ entrantId: 2, personId: 10, handle: "Top" }),
      line({ entrantId: 1, personId: null, handle: "Guest" }),
      line({ entrantId: 1, personId: null, handle: "Guest" }),
    ]);
    expect(averages.map((a) => [a.entrantId, a.handle, a.games])).toEqual([
      [1, "Top", 1],
      [2, "Top", 1],
      [1, "Guest", 2],
    ]);
  });

  it("returns nothing for no lines", () => {
    expect(averageSeriesLines([])).toEqual([]);
  });
});

const games: SeriesGameResult[] = [
  { order: 1, isCompleted: true, winnerEntrantId: 1 },
  { order: 2, isCompleted: true, winnerEntrantId: 2 },
  { order: 3, isCompleted: true, winnerEntrantId: 1 },
];

describe("seriesScoreThrough", () => {
  it("counts the games won up to and including the given game", () => {
    expect(seriesScoreThrough(games, 1, 1, 2)).toEqual({ a: 1, b: 0 });
    expect(seriesScoreThrough(games, 2, 1, 2)).toEqual({ a: 1, b: 1 });
    expect(seriesScoreThrough(games, 3, 1, 2)).toEqual({ a: 2, b: 1 });
  });

  it("leaves out games that are not completed or have no winner", () => {
    const unfinished: SeriesGameResult[] = [
      { order: 1, isCompleted: true, winnerEntrantId: 1 },
      { order: 2, isCompleted: false, winnerEntrantId: 2 },
      { order: 3, isCompleted: true, winnerEntrantId: null },
    ];
    expect(seriesScoreThrough(unfinished, 3, 1, 2)).toEqual({ a: 1, b: 0 });
  });

  it("is zero before the first game", () => {
    expect(seriesScoreThrough(games, 0, 1, 2)).toEqual({ a: 0, b: 0 });
  });
});

describe("otherEntrantOf", () => {
  it("gives the entrant that is not the given one", () => {
    expect(otherEntrantOf(1, 1, 2)).toBe(2);
    expect(otherEntrantOf(2, 1, 2)).toBe(1);
  });

  it("is null without an entrant to give", () => {
    expect(otherEntrantOf(null, 1, 2)).toBeNull();
  });
});
