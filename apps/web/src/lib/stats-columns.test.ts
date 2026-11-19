import { describe, expect, it } from "vitest";
import { CHAMPION_STAT_COLUMNS, LEAGUE_STAT_COLUMNS } from "./stats-columns";
import type { ChampionStatRow, LeagueStatRow } from "./stats-aggregate";

const leagueRow = (totals: Partial<LeagueStatRow["totals"]>, mapsPlayed: number): LeagueStatRow => ({
  groupKey: "1",
  mapsPlayed,
  totals: { statGames: 0, wins: 0, kills: 0, deaths: 0, assists: 0, teamKills: 0, cs: 0, gold: 0, damage: 0, vision: 0, minutes: 0, goldMinutes: 0, damageMinutes: 0, visionMinutes: 0, ...totals },
  averages: { goldDiff10: NaN, goldDiff15: NaN, xpDiff10: NaN, xpDiff15: NaN, csDiff10: NaN, csDiff15: NaN },
});
const leagueValue = (key: string, row: LeagueStatRow) => LEAGUE_STAT_COLUMNS.find((c) => c.key === key)!.value(row, "avg");

describe("LEAGUE_STAT_COLUMNS", () => {
  it("counts every game for games and win rate, but averages only over the games with stats", () => {
    // 4 games, 2 of them manual lineups without stats: 10 kills in the 2 games with stats is 5 a game, not 2.5.
    const row = leagueRow({ statGames: 2, wins: 3, kills: 10, deaths: 4, assists: 6, teamKills: 32, cs: 400, minutes: 50 }, 4);
    expect(leagueValue("played", row)).toBe(4);
    expect(leagueValue("winRate", row)).toBe(75);
    expect(leagueValue("kills", row)).toBe(5);
    expect(leagueValue("kda", row)).toBe(4);
    expect(leagueValue("kp", row)).toBe(50);
    expect(leagueValue("csPerMinute", row)).toBe(8);
  });

  it("averages gold, damage and vision only over the games that have them", () => {
    // 50 minutes with stats, but the gold of only 20 of them: 8000 gold is 400 a minute. No game has the vision.
    const row = leagueRow({ statGames: 2, cs: 400, minutes: 50, gold: 8000, goldMinutes: 20, damage: 50000, damageMinutes: 50 }, 2);
    expect(leagueValue("csPerMinute", row)).toBe(8);
    expect(leagueValue("goldPerMinute", row)).toBe(400);
    expect(leagueValue("damagePerMinute", row)).toBe(1000);
    expect(leagueValue("visionPerMinute", row)).toBeNaN();
  });

  it("shows no numbers for a player with only manual lineups", () => {
    const row = leagueRow({ statGames: 0, wins: 1 }, 2);
    expect(leagueValue("played", row)).toBe(2);
    expect(leagueValue("winRate", row)).toBe(50);
    for (const key of ["kills", "deaths", "assists", "kda", "kp", "csPerMinute", "goldPerMinute", "damagePerMinute", "visionPerMinute"]) {
      expect(leagueValue(key, row)).toBeNaN();
    }
  });
});

describe("CHAMPION_STAT_COLUMNS", () => {
  const championRow = (picks: number, statPicks: number): ChampionStatRow => ({
    groupKey: "Ahri",
    mapsPlayed: statPicks,
    totals: { games: 10, picks, statPicks, bans: 0, wins: 1, kills: statPicks * 4, deaths: statPicks * 2, assists: statPicks * 4 },
    roles: [],
  });
  const value = (key: string, row: ChampionStatRow) => CHAMPION_STAT_COLUMNS.find((c) => c.key === key)!.value(row, "avg");

  it("averages the K/D/A over the picks with stats", () => {
    const row = championRow(3, 2);
    expect(value("picks", row)).toBe(3);
    expect(value("kills", row)).toBe(4);
    expect(value("kda", row)).toBe(4);
  });

  it("shows no K/D/A for a champion picked only in manual lineups", () => {
    const row = championRow(2, 0);
    expect(value("picks", row)).toBe(2);
    expect(value("winRate", row)).toBe(50);
    expect(value("kills", row)).toBeNaN();
    expect(value("kda", row)).toBeNaN();
  });
});
