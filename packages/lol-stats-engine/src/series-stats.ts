/**
 * GC-Stats — series-stats module
 *
 * What the games of a LoL series add up to: the rates of one game (kill participation and the per minute values), each
 * player's line over the whole series, the series score after a game, and the other team of a series. Pure, no database
 * access.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

/** One player's line in one game, with the rates the scoreboard shows. */
export interface PlayerGameLine {
  entrantId: number;
  personId: number | null;
  handle: string;
  championName: string | null;
  role: string | null;
  /** False for a manual lineup without a scoreboard. */
  hasStats: boolean;
  kills: number;
  deaths: number;
  assists: number;
  /** Percent of the team's kills the player made or assisted. */
  killParticipation: number;
  csPerMinute: number | null;
  goldPerMinute: number | null;
}

/**
 * One player over the series. Kills, deaths and assists are totals over the games with stats; the rates are averages
 * per game with stats. `role` is the role of the player's first game. `champions` are distinct, in the order they were
 * first played. A per minute value is null when no game of the player has a known length. `hasStats` is false when no
 * game of the player has stats: then the numbers are 0 and mean nothing.
 */
export type SeriesAverage = Omit<PlayerGameLine, "championName"> & {
  games: number;
  /** The games with stats, which the numbers come from. */
  statGames: number;
  champions: string[];
};

/** The share of the team's kills the player made or assisted, in percent. 0 when the team got no kills. */
export function killParticipation(kills: number, assists: number, teamKills: number): number {
  return teamKills === 0 ? 0 : ((kills + assists) / teamKills) * 100;
}

/** (Kills + assists) / deaths; without deaths, kills + assists. */
export function kdaRatio(kills: number, deaths: number, assists: number): number {
  return deaths > 0 ? (kills + assists) / deaths : kills + assists;
}

/** A total per minute, or null when the game's length is not known (games entered by hand). */
export function perMinute(total: number, durationSeconds: number | null): number | null {
  return durationSeconds ? total / (durationSeconds / 60) : null;
}

function mean(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0) / known.length;
}

export function averageSeriesLines(lines: PlayerGameLine[]): SeriesAverage[] {
  const groups = new Map<string, PlayerGameLine[]>();
  for (const line of lines) {
    const key = `${line.entrantId}:${line.personId ?? line.handle}`;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }

  return [...groups.values()].map((group) => {
    const first = group[0]!;
    // A game without stats counts as played, but its zeros never reach the numbers.
    const withStats = group.filter((line) => line.hasStats);
    const sum = (pick: (line: PlayerGameLine) => number) => withStats.reduce((total, line) => total + pick(line), 0);
    const average = (pick: (line: PlayerGameLine) => number) => (withStats.length > 0 ? sum(pick) / withStats.length : 0);
    return {
      entrantId: first.entrantId,
      personId: first.personId,
      handle: first.handle,
      role: first.role,
      hasStats: withStats.length > 0,
      games: group.length,
      statGames: withStats.length,
      champions: [...new Set(group.flatMap((line) => (line.championName === null ? [] : [line.championName])))],
      kills: sum((line) => line.kills),
      deaths: sum((line) => line.deaths),
      assists: sum((line) => line.assists),
      killParticipation: average((line) => line.killParticipation),
      csPerMinute: mean(withStats.map((line) => line.csPerMinute)),
      goldPerMinute: mean(withStats.map((line) => line.goldPerMinute)),
    };
  });
}

export interface SeriesGameResult {
  order: number;
  isCompleted: boolean;
  winnerEntrantId: number | null;
}

/** Games won by entrant A and by entrant B in the games up to and including `order`. Games not completed count for no one. */
export function seriesScoreThrough(games: SeriesGameResult[], order: number, entrantAId: number | null, entrantBId: number | null): { a: number; b: number } {
  const won = games.filter((game) => game.isCompleted && game.order <= order && game.winnerEntrantId !== null);
  return {
    a: won.filter((game) => game.winnerEntrantId === entrantAId).length,
    b: won.filter((game) => game.winnerEntrantId === entrantBId).length,
  };
}

/** The other entrant of a series: the one that is not the given entrant. Null when there is no entrant to give. */
export function otherEntrantOf(entrantId: number | null, entrantAId: number | null, entrantBId: number | null): number | null {
  if (entrantId === null) return null;
  return entrantId === entrantAId ? entrantBId : entrantAId;
}
