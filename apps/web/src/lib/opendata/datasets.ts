/**
 * GC-Stats - opendata datasets
 *
 * SQL of the OpenData datasets: public fields only, ghost and hidden rows
 * excluded the same way as the public pages. Matches are published whether
 * their stage is published or not. Runs on the dedicated OpenData pool with
 * a statement timeout, so a slow export can never hold the site.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import { sql, type SQL } from "drizzle-orm";
import { db, openDataDb } from "@gc-stats/db/client";
import { foldedIlikeExpr } from "@/lib/db-search";
import { stripAccents } from "@/lib/search-typo";
import { OPENDATA_DATASET_META, OPENDATA_LIST_VALUES, isIntegerColumnType, type OpenDataDataset, type OpenDataFilter, type OpenDataRow } from "./datasets-meta";
const BROWSE_TIMEOUT_MS = 8_000;
const EXPORT_TIMEOUT_MS = 30_000;
const isoDate = (expr: SQL) => sql`to_char(${expr}, 'YYYY-MM-DD')`;
const isoDateTime = (expr: SQL) => sql`to_char(${expr} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
// Each base query exposes exactly the columns of OPENDATA_DATASET_META, under the same names.
const BASE_QUERIES: Record<OpenDataDataset, SQL> = {
  tournaments: sql`
    select
      t.id::int as id,
      t.name,
      t.status,
      ${isoDate(sql`t.start_date`)} as start_date,
      ${isoDate(sql`t.end_date`)} as end_date,
      t.region,
      t.category,
      t.location,
      t.prize_pool,
      (select count(*)::int from entrants e where e.tournament_id = t.id and e.kind = 'team') as teams_count,
      o.id::int as organizer_id,
      o.name as organizer_name,
      t.liquipedia_link,
      t.socials
    from tournaments t
    left join organizations o on o.id = t.organizer_organization_id
    where t.active and not t.is_ghost`,
  teams: sql`
    select
      t.id::int as id,
      t.name,
      t.short_name,
      t.country_code,
      t.secondary_country_code,
      t.is_active,
      (select count(distinct rm.person_id)::int from roster_memberships rm
        join people rp on rp.id = rm.person_id and not rp.is_ghost
        where rm.team_id = t.id and upper_inf(rm.period) and not rm.has_left and rm.role in ('player', 'player-igl')) as players_count,
      (select count(*)::int from entrants e
        join tournaments et on et.id = e.tournament_id and et.active and not et.is_ghost
        join matches m on m.entrant_a_id = e.id or m.entrant_b_id = e.id
        where e.team_id = t.id) as matches_count,
      t.bio,
      t.vlr_id,
      t.liquipedia_link,
      t.socials
    from teams t
    where not t.is_ghost`,
  players: sql`
    select
      p.id::int as id,
      p.handle,
      p.first_name,
      p.last_name,
      p.country_code,
      p.secondary_country_code,
      p.is_active,
      ct.team_id::int as current_team_id,
      ct.team_name as current_team_name,
      ct.role as current_role,
      p.bio,
      p.vlr_id,
      p.liquipedia_link,
      p.socials
    from people p
    left join lateral (
      select rm.team_id, tm.name as team_name, rm.role
      from roster_memberships rm
      join teams tm on tm.id = rm.team_id and not tm.is_ghost
      where rm.person_id = p.id and upper_inf(rm.period) and not rm.has_left
      order by lower(rm.period) desc
      limit 1
    ) ct on true
    where not p.is_ghost`,
  matches: sql`
    select
      m.id::int as id,
      ${isoDateTime(sql`m.scheduled_at`)} as scheduled_at,
      m.status::text as status,
      t.id::int as tournament_id,
      t.name as tournament_name,
      s.name as stage_name,
      c.name as bracket_name,
      m.round,
      m.best_of,
      ea.team_id::int as team_a_id,
      ea.display_name as team_a_name,
      m.score_a,
      m.score_b,
      eb.team_id::int as team_b_id,
      eb.display_name as team_b_name,
      ew.team_id::int as winner_team_id,
      m.is_forfeit,
      m.patch
    from matches m
    join stage_containers c on c.id = m.container_id
    join stages s on s.id = c.stage_id
    join tournaments t on t.id = s.tournament_id and t.active and not t.is_ghost
    left join entrants ea on ea.id = m.entrant_a_id
    left join entrants eb on eb.id = m.entrant_b_id
    left join entrants ew on ew.id = m.winner_id`,
  maps: sql`
    select
      mp.id::int as id,
      m.id::int as match_id,
      ${isoDateTime(sql`coalesce(mp.started_at, m.scheduled_at)`)} as started_at,
      t.id::int as tournament_id,
      t.name as tournament_name,
      mp."order" as map_order,
      mp.map_name,
      mp.is_completed,
      ea.team_id::int as team_a_id,
      ea.display_name as team_a_name,
      mp.team_a_score as score_a,
      mp.team_b_score as score_b,
      eb.team_id::int as team_b_id,
      eb.display_name as team_b_name,
      case when not mp.is_completed or mp.team_a_score = mp.team_b_score then null
        when mp.team_a_score > mp.team_b_score then ea.team_id else eb.team_id end::int as winner_team_id,
      (select rs.rounds_won from map_team_round_summary rs where rs.map_id = mp.id and rs.entrant_id = m.entrant_a_id and rs.side = 'atk') as team_a_atk_rounds_won,
      (select rs.rounds_won from map_team_round_summary rs where rs.map_id = mp.id and rs.entrant_id = m.entrant_a_id and rs.side = 'def') as team_a_def_rounds_won,
      (select rs.rounds_won from map_team_round_summary rs where rs.map_id = mp.id and rs.entrant_id = m.entrant_b_id and rs.side = 'atk') as team_b_atk_rounds_won,
      (select rs.rounds_won from map_team_round_summary rs where rs.map_id = mp.id and rs.entrant_id = m.entrant_b_id and rs.side = 'def') as team_b_def_rounds_won,
      mp.is_forfeit,
      m.patch
    from maps mp
    join matches m on m.id = mp.match_id
    join stage_containers c on c.id = m.container_id
    join stages s on s.id = c.stage_id
    join tournaments t on t.id = s.tournament_id and t.active and not t.is_ghost
    left join entrants ea on ea.id = m.entrant_a_id
    left join entrants eb on eb.id = m.entrant_b_id`,
  // Scoreboard of completed maps, a ghost player keeps their handle but gets no id (no public page).
  map_players: sql`
    select
      ps.id::int as id,
      mp.id::int as map_id,
      m.id::int as match_id,
      ${isoDateTime(sql`coalesce(mp.started_at, m.scheduled_at)`)} as started_at,
      t.id::int as tournament_id,
      t.name as tournament_name,
      mp.map_name,
      case when p.is_ghost then null else p.id end::int as player_id,
      coalesce(p.handle, ps.val_name) as player_handle,
      e.team_id::int as team_id,
      e.display_name as team_name,
      ps.agent_name as agent,
      ps.kills,
      ps.deaths,
      ps.assists,
      ps.acs,
      ps.adr,
      ps.kast_percentage::float8 as kast_percentage,
      ps.headshot_percentage::float8 as headshot_percentage,
      ps.first_kills,
      ps.first_deaths,
      (select coalesce(sum((cl.value ->> 'won')::numeric), 0)::int from jsonb_each(case when jsonb_typeof(ps.clutches) = 'object' then ps.clutches else '{}'::jsonb end) cl) as clutches_won,
      (select coalesce(sum((cl.value ->> 'total')::numeric), 0)::int from jsonb_each(case when jsonb_typeof(ps.clutches) = 'object' then ps.clutches else '{}'::jsonb end) cl) as clutches_played,
      coalesce((ps.multikills ->> '2k')::numeric, 0)::int as multikills_2k,
      coalesce((ps.multikills ->> '3k')::numeric, 0)::int as multikills_3k,
      coalesce((ps.multikills ->> '4k')::numeric, 0)::int as multikills_4k,
      coalesce((ps.multikills ->> '5k')::numeric, 0)::int as multikills_5k,
      ps.trade_kills,
      ps.traded_deaths
    from map_player_stats ps
    join maps mp on mp.id = ps.map_id and mp.is_completed
    join matches m on m.id = mp.match_id
    join stage_containers c on c.id = m.container_id
    join stages s on s.id = c.stage_id
    join tournaments t on t.id = s.tournament_id and t.active and not t.is_ghost
    join entrants e on e.id = ps.entrant_id
    left join people p on p.id = ps.person_id`,
};
const SEARCH_COLUMNS: Record<OpenDataDataset, string[]> = {
  tournaments: ["name", "region", "category", "location", "organizer_name"],
  teams: ["name", "short_name"],
  players: ["handle", "first_name", "last_name", "current_team_name"],
  matches: ["tournament_name", "stage_name", "team_a_name", "team_b_name"],
  maps: ["tournament_name", "map_name", "team_a_name", "team_b_name"],
  map_players: ["tournament_name", "map_name", "player_handle", "team_name", "agent"],
};
function searchClause(dataset: OpenDataDataset, q: string): SQL {
  if (!q) return sql`true`;
  const pattern = stripAccents(q.toLowerCase());
  const clauses = SEARCH_COLUMNS[dataset].map((key) => foldedIlikeExpr(sql`d.${sql.identifier(key)}`, pattern));
  return sql`(${sql.join(clauses, sql` or `)})`;
}
// Filters are validated by parseBrowseQuery, columns and list values are known here.
function filterClauses(dataset: OpenDataDataset, filters: OpenDataFilter[]): SQL[] {
  return filters.map(({ column: key, value }) => {
    const column = OPENDATA_DATASET_META[dataset].columns.find((c) => c.key === key);
    if (!column) throw new Error("unknown filter column");
    const ref = sql`d.${sql.identifier(key)}`;
    if (column.type === "boolean") return sql`${ref} = ${value === "true"}`;
    if (OPENDATA_LIST_VALUES[column.type]) return sql`${ref} = ${value}`;
    if (isIntegerColumnType(column.type)) return sql`${ref} = ${Number(value)}`;
    return foldedIlikeExpr(sql`${ref}::text`, stripAccents(value.toLowerCase()));
  });
}
function sortExpression(dataset: OpenDataDataset, sort: string): SQL {
  const column = OPENDATA_DATASET_META[dataset].columns.find((c) => c.key === sort);
  if (!column) throw new Error("unknown sort column");
  // A socials object has no natural order, it sorts by how many links it holds.
  if (column.type === "socials") return sql`(select count(*) from jsonb_object_keys(d.socials))`;
  if (column.type === "text" || column.type === "longText") return sql`lower(d.${sql.identifier(sort)})`;
  return sql`d.${sql.identifier(sort)}`;
}
async function runWithTimeout<T extends Record<string, unknown>>(query: SQL, timeoutMs: number, client: typeof db = openDataDb): Promise<T[]> {
  return client.transaction(async (tx) => {
    await tx.execute(sql.raw(`set local statement_timeout = ${timeoutMs}`));
    const result = await tx.execute(query);
    return result.rows as T[];
  });
}
export type OpenDataPageQuery = { dataset: OpenDataDataset; sort: string; direction: "asc" | "desc"; page: number; perPage: number; q: string; filters: OpenDataFilter[] };
export async function queryOpenDataPage(query: OpenDataPageQuery): Promise<{ rows: OpenDataRow[]; total: number }> {
  const { dataset, sort, direction, page, perPage, q, filters } = query;
  const where = sql.join([searchClause(dataset, q), ...filterClauses(dataset, filters)], sql` and `);
  const order = sql`${sortExpression(dataset, sort)} ${direction === "asc" ? sql`asc` : sql`desc`} nulls last, d.id asc`;
  const rows = await runWithTimeout<OpenDataRow & { __total: number }>(
    sql`select d.*, count(*) over ()::int as __total
      from (${BASE_QUERIES[dataset]}) d
      where ${where}
      order by ${order}
      limit ${perPage} offset ${(page - 1) * perPage}`,
    BROWSE_TIMEOUT_MS,
  );
  if (rows.length === 0 && page > 1) {
    const [countRow] = await runWithTimeout<{ total: number }>(sql`select count(*)::int as total from (${BASE_QUERIES[dataset]}) d where ${where}`, BROWSE_TIMEOUT_MS);
    return { rows: [], total: countRow?.total ?? 0 };
  }
  const total = rows[0]?.__total ?? 0;
  return { rows: rows.map(({ __total: _total, ...row }) => row), total };
}
export async function queryOpenDataExport(dataset: OpenDataDataset, q: string, filters: OpenDataFilter[]): Promise<OpenDataRow[]> {
  const where = sql.join([searchClause(dataset, q), ...filterClauses(dataset, filters)], sql` and `);
  return runWithTimeout<OpenDataRow>(sql`select d.* from (${BASE_QUERIES[dataset]}) d where ${where} order by d.id asc`, EXPORT_TIMEOUT_MS);
}
export async function queryOpenDataCounts(): Promise<Record<OpenDataDataset, number>> {
  const [row] = await runWithTimeout<Record<OpenDataDataset, number>>(
    sql`select
      (select count(*)::int from (${BASE_QUERIES.tournaments}) d) as tournaments,
      (select count(*)::int from (${BASE_QUERIES.teams}) d) as teams,
      (select count(*)::int from (${BASE_QUERIES.players}) d) as players,
      (select count(*)::int from (${BASE_QUERIES.matches}) d) as matches,
      (select count(*)::int from (${BASE_QUERIES.maps}) d) as maps,
      (select count(*)::int from (${BASE_QUERIES.map_players}) d) as map_players`,
    BROWSE_TIMEOUT_MS,
  );
  return row ?? { tournaments: 0, teams: 0, players: 0, matches: 0, maps: 0, map_players: 0 };
}
/** Public rows of these ids, keyed by id. Used by the webhooks (main pool): a hidden or ghost row is absent. */
export async function queryOpenDataRowsByIds(dataset: OpenDataDataset, ids: number[]): Promise<Map<number, OpenDataRow>> {
  if (ids.length === 0) return new Map();
  const rows = await runWithTimeout<OpenDataRow>(
    sql`select d.* from (${BASE_QUERIES[dataset]}) d where d.id = any(${sql.raw(`array[${ids.map((id) => Math.trunc(id)).join(",")}]::int[]`)})`,
    EXPORT_TIMEOUT_MS,
    db,
  );
  return new Map(rows.map((row) => [row.id as number, row]));
}
