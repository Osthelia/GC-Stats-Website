/**
 * GC-Stats - series-entrants
 *
 * Which entrant of a League series a Leaguepedia team name stands for, and the tournament's Leaguepedia games ranked
 * for one series: its own games first. Pure, so it can be tested without the database.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { compareTeamNames } from "@/lib/liquipedia-team-match";

/** An entrant of the series, with every name a Leaguepedia team name can be matched against. */
export interface SeriesEntrant {
  id: number;
  /** The entrant's display name. */
  name: string;
  teamId: number | null;
  /** The display name, the team's name and its short name. */
  names: string[];
  /** The Leaguepedia name an earlier import linked to the entrant's team (lol_leaguepedia_team_names). */
  leaguepediaName: string | null;
}

/** Check for the best match for given name in the given teams (entrants) */
export function entrantForName(name: string | null, entrants: readonly SeriesEntrant[]): number | null {
  if (!name?.trim()) return null;
  const key = name.trim().toLowerCase();
  const linked = entrants.find((e) => e.leaguepediaName?.trim().toLowerCase() === key);
  if (linked) return linked.id;

  const scored = entrants.map((e) => ({
    id: e.id,
    score: Math.max(
      0,
      ...e.names.map((own) => {
        const result = compareTeamNames(own, name);
        return result && result.confidence !== "possible" ? result.score : 0;
      })
    ),
  }));
  const best = Math.max(0, ...scored.map((s) => s.score));
  const top = scored.filter((s) => s.score === best);
  return best > 0 && top.length === 1 ? top[0]!.id : null;
}

/** What the ranking reads of a Leaguepedia game. */
export type RankableLeaguepediaGame = { team1: string | null; team2: string | null; playedAt: string | null };

/**
 * Sorts LeagupediaGames in following order: 
 * teams match given teams -> date distance to given date -> order from leagupedia
 */
export function rankLeaguepediaGames<T extends RankableLeaguepediaGame>(games: readonly T[], playingTeams: readonly SeriesEntrant[], playingAt: string | null): T[] {
  const playingDate = playingAt ? Date.parse(playingAt) : NaN;
  const teamsMatched = (g: T) => {
    const a = entrantForName(g.team1, playingTeams);
    const b = entrantForName(g.team2, playingTeams);
    // The same entrant for both names is one match, not two.
    return a !== null && b !== null && a !== b ? 2 : a !== null || b !== null ? 1 : 0;
  };
  const distance = (g: T): number => {
    const played = g.playedAt ? Date.parse(g.playedAt) : NaN;
    return Number.isNaN(playingDate) || Number.isNaN(played) ? Number.POSITIVE_INFINITY : Math.abs(played - playingDate);
  };
  return games
    .map((game, index) => ({ game, index, teams: teamsMatched(game), distance: distance(game) }))
    .sort((x, y) => y.teams - x.teams || compareDistance(x.distance, y.distance) || x.index - y.index)
    .map((x) => x.game);
}

/**
 * Games of one series are close together, so they are compared by day: within the same day the list order (game
 * number) decides, not the minutes between them.
 */
function compareDistance(a: number, b: number): number {
  if (a === b) return 0;
  if (!Number.isFinite(a)) return Number.isFinite(b) ? 1 : 0;
  if (!Number.isFinite(b)) return -1;
  const DAY = 24 * 60 * 60 * 1000;
  return Math.floor(a / DAY) - Math.floor(b / DAY);
}
