/**
 * GC-Stats - league-scoreboard
 *
 * The rows of a LoL scoreboard, built from a game's players or from the averages over a series. Shared by the match
 * page and the poster, so both list the same players in the same order. Client safe.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { LEAGUE_ROLES, type SeriesAverage } from "@gc-stats/lol-stats-engine";
import type { LeagueMatchGame, PlayerRunes } from "@/lib/match-league-games";

/** Game length as m:ss, e.g. 1985 seconds → "33:05". */
export function formatGameDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The lane order of a scoreboard, top to bottom. Players without a role keep their place at the end. */
function roleRank(role: string | null): number {
  const rank = role === null ? -1 : (LEAGUE_ROLES as readonly string[]).indexOf(role);
  return rank === -1 ? LEAGUE_ROLES.length : rank;
}

export type LeagueScoreRow = {
  personId: number | null;
  handle: string;
  champions: { name: string; iconUrl: string | null }[];
  kills: number;
  deaths: number;
  assists: number;
  killParticipation: number;
  csPerMinute: number | null;
  goldPerMinute: number | null;
  items?: { name: string; iconUrl: string | null }[];
  runes?: PlayerRunes;
};

/** The champion icon of each name, from any game it was played in: the averages only know the name. */
export function championIconMap(games: LeagueMatchGame[]): Map<string, string | null> {
  return new Map(games.flatMap((game) => game.players).map((player): [string, string | null] => [player.championName, player.championIconUrl]));
}

export function gameScoreRows(game: LeagueMatchGame, entrantId: number | null): LeagueScoreRow[] {
  return game.players
    .filter((player) => player.entrantId === entrantId)
    .sort((x, y) => roleRank(x.role) - roleRank(y.role))
    .map((player) => ({
      personId: player.personId,
      handle: player.handle,
      champions: [{ name: player.championName, iconUrl: player.championIconUrl }],
      kills: player.kills,
      deaths: player.deaths,
      assists: player.assists,
      killParticipation: player.killParticipation,
      csPerMinute: player.csPerMinute,
      goldPerMinute: player.goldPerMinute,
      items: player.items,
      runes: player.runes,
    }));
}

export function averageScoreRows(averages: SeriesAverage[], entrantId: number | null, iconByChampion: Map<string, string | null>): LeagueScoreRow[] {
  return averages
    .filter((average) => average.entrantId === entrantId)
    .sort((x, y) => roleRank(x.role) - roleRank(y.role))
    .map((average) => ({
      personId: average.personId,
      handle: average.handle,
      champions: average.champions.map((name) => ({ name, iconUrl: iconByChampion.get(name) ?? null })),
      kills: average.kills,
      deaths: average.deaths,
      assists: average.assists,
      killParticipation: average.killParticipation,
      csPerMinute: average.csPerMinute,
      goldPerMinute: average.goldPerMinute,
    }));
}
