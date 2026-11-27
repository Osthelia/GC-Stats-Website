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

export type PopularityType = "team" | "player" | "tournament" | "organization";

export const POPULARITY_WINDOW_DAYS = 90;

const since = sql.raw(`now() - interval '${POPULARITY_WINDOW_DAYS} days'`);
const played = sql`m.status in ('live', 'completed') and m.scheduled_at between ${since} and now()`;

// Each query returns one `(id, total)` row per entity with some activity.
const QUERIES: Record<PopularityType, (ids: number[]) => SQL> = {
  team: (ids) => sql`
    select id, sum(total)::int as total from (
      select e.team_id as id, count(distinct m.id) as total
      from entrants e
      join matches m on m.entrant_a_id = e.id or m.entrant_b_id = e.id
      where e.team_id in ${ids} and ${played}
      group by e.team_id
      union all
      select team_id as id, count(*) as total from users where team_id in ${ids} group by team_id
    ) activity
    group by id`,
  player: (ids) => sql`
    select s.person_id as id, count(distinct m.id)::int as total
    from map_player_stats s
    join maps mp on mp.id = s.map_id
    join matches m on m.id = mp.match_id
    where s.person_id in ${ids} and coalesce(mp.started_at, m.scheduled_at) between ${since} and now()
    group by s.person_id`,
  tournament: (ids) => sql`
    select st.tournament_id as id, count(*)::int as total
    from stages st
    join stage_containers c on c.stage_id = st.id
    join matches m on m.container_id = c.id
    where st.tournament_id in ${ids} and ${played}
    group by st.tournament_id`,
  organization: (ids) => sql`
    select t.organizer_organization_id as id, count(*)::int as total
    from tournaments t
    join stages st on st.tournament_id = t.id
    join stage_containers c on c.stage_id = st.id
    join matches m on m.container_id = c.id
    where t.organizer_organization_id in ${ids} and ${played}
    group by t.organizer_organization_id`,
};

/** Popularity per id, ids without any activity are absent from the map. */
export async function getPopularity(type: PopularityType, ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const result = await db.execute<{ id: string | number; total: number }>(QUERIES[type](ids));
  return new Map(result.rows.map((row) => [Number(row.id), Number(row.total)]));
}
