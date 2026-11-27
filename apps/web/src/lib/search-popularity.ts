/**
 * GC-Stats - search-popularity
 *
 * Popularity of a search result, read from the site's own data: matches played
 * in the last 90 days (by a team, by a player, in a tournament, in the
 * tournaments of an organizer), plus the accounts that follow a team as fans.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sql, type SQL } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { GAME_INFO, gameHasSeriesGames, type GameSlug } from "@gc-stats/db/game";
import { FAN_TEAM_COLUMNS } from "@/lib/fan-team-columns";

export type PopularityType = "team" | "player" | "tournament" | "organization";

export const POPULARITY_WINDOW_DAYS = 90;

const since = sql.raw(`now() - interval '${POPULARITY_WINDOW_DAYS} days'`);
const played = sql`m.status in ('live', 'completed') and m.scheduled_at between ${since} and now()`;

/** Table names of a game for raw SQL: its content tables, and where the player stats of one map (or game) live. */
export function gameSqlTables(game: GameSlug) {
  const prefix = GAME_INFO[game].tablePrefix;
  const table = (name: string) => sql.identifier(`${prefix}_${name}`);
  const [stats, series, seriesKey] = gameHasSeriesGames(game) ? ["game_player_stats", "games", "game_id"] : ["map_player_stats", "maps", "map_id"];
  return {
    people: table("people"),
    tournaments: table("tournaments"),
    stages: table("stages"),
    containers: table("stage_containers"),
    entrants: table("entrants"),
    matches: table("matches"),
    playerStats: table(stats!),
    series: table(series!),
    seriesKey: sql.identifier(seriesKey!),
  };
}

// Each query returns one `(id, total)` row per entity with some activity.
const QUERIES: Record<PopularityType, (game: GameSlug, ids: number[]) => SQL> = {
  team: (game, ids) => {
    const t = gameSqlTables(game);
    const fanTeam = sql.identifier(FAN_TEAM_COLUMNS[game].team);
    return sql`
      select id, sum(total)::int as total from (
        select e.team_id as id, count(distinct m.id) as total
        from ${t.entrants} e
        join ${t.matches} m on m.entrant_a_id = e.id or m.entrant_b_id = e.id
        where e.team_id in ${ids} and ${played}
        group by e.team_id
        union all
        select ${fanTeam} as id, count(*) as total from users where ${fanTeam} in ${ids} group by ${fanTeam}
      ) activity
      group by id`;
  },
  player: (game, ids) => {
    const t = gameSqlTables(game);
    return sql`
      select s.person_id as id, count(distinct m.id)::int as total
      from ${t.playerStats} s
      join ${t.series} sm on sm.id = s.${t.seriesKey}
      join ${t.matches} m on m.id = sm.match_id
      where s.person_id in ${ids} and coalesce(sm.started_at, m.scheduled_at) between ${since} and now()
      group by s.person_id`;
  },
  tournament: (game, ids) => {
    const t = gameSqlTables(game);
    return sql`
      select st.tournament_id as id, count(*)::int as total
      from ${t.stages} st
      join ${t.containers} c on c.stage_id = st.id
      join ${t.matches} m on m.container_id = c.id
      where st.tournament_id in ${ids} and ${played}
      group by st.tournament_id`;
  },
  organization: (game, ids) => {
    const t = gameSqlTables(game);
    return sql`
      select t.organizer_organization_id as id, count(*)::int as total
      from ${t.tournaments} t
      join ${t.stages} st on st.tournament_id = t.id
      join ${t.containers} c on c.stage_id = st.id
      join ${t.matches} m on m.container_id = c.id
      where t.organizer_organization_id in ${ids} and ${played}
      group by t.organizer_organization_id`;
  },
};

/** Popularity per id in one game, ids without any activity are absent from the map. */
export async function getPopularity(game: GameSlug, type: PopularityType, ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const result = await db.execute<{ id: string | number; total: number }>(QUERIES[type](game, ids));
  return new Map(result.rows.map((row) => [Number(row.id), Number(row.total)]));
}
