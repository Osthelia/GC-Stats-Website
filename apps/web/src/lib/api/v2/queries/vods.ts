/**
 * GC-Stats - vods
 *
 * Query helpers for the API v2 paginated vods listing, joined with match,
 * team and organization info for each entry.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import { organizations, gameTables } from "@gc-stats/db";
import { exclusiveUpperBound } from "../../v1/params";
import { toApiTeamFromJoined, type ApiTeam } from "../../v1/entities";
import { getThemedLogoUrlsBatch, type ApiThemedLogoUrls } from "../../v1/logo-response";
import type { VodsFilter } from "../params";
import type { GameSlug } from "@gc-stats/db/game";

function vodEntrantAAlias(game: GameSlug) {
  const { entrants } = gameTables(game);
  return alias(entrants, "vod_entrant_a");
}
function vodEntrantBAlias(game: GameSlug) {
  const { entrants } = gameTables(game);
  return alias(entrants, "vod_entrant_b");
}
function vodTeamAAlias(game: GameSlug) {
  const { teams } = gameTables(game);
  return alias(teams, "vod_team_a");
}
function vodTeamBAlias(game: GameSlug) {
  const { teams } = gameTables(game);
  return alias(teams, "vod_team_b");
}

export type ApiVodMatchRef = {
  id: number;
  tournament_id: number;
  round_name: string | null;
  scheduled_at: string | null;
  team_a: ApiTeam | null;
  team_b: ApiTeam | null;
};

export type ApiVodOrganizationRef = { id: number; name: string; logos: ApiThemedLogoUrls };

export type ApiVodEntry = {
  id: number;
  url: string;
  language_code: string;
  map_id: number | null;
  organization: ApiVodOrganizationRef | null;
  match: ApiVodMatchRef;
};

export type ApiPaginatedVods = { page: number; per_page: number; total: number; total_pages: number; data: ApiVodEntry[] };

/**
 * Global VOD listing, most recent match first — always paginated (never an
 * unbounded scan, see API_V2.md's perf note on matches/matches-adjacent
 * listings). `team_id` matches either side of the match, mirroring the
 * tournament matches endpoint's own `team_id` filter.
 */
export async function getVodsV2(game: GameSlug, filter: VodsFilter): Promise<ApiPaginatedVods> {
  const { vods, matches, stageContainers, stages } = gameTables(game);
  const conditions = [];
  if (filter.from) conditions.push(gte(matches.scheduledAt, new Date(`${filter.from}T00:00:00.000Z`)));
  if (filter.to) conditions.push(lt(matches.scheduledAt, exclusiveUpperBound(filter.to)));
  if (filter.tournamentId) conditions.push(eq(stages.tournamentId, filter.tournamentId));
  if (filter.organizationId) conditions.push(eq(vods.organizationId, filter.organizationId));
  if (filter.languageCode) conditions.push(eq(vods.languageCode, filter.languageCode));
  if (filter.matchId) conditions.push(eq(vods.matchId, filter.matchId));
  if (filter.teamId) conditions.push(or(eq(vodTeamAAlias(game).id, filter.teamId), eq(vodTeamBAlias(game).id, filter.teamId)) ?? sql`false`);
  const where = conditions.length ? and(...conditions) : undefined;

  // Explicit keys: a bare select() would key the joined rows by the game prefixed table names.
  const baseQuery = db
    .select({ vods, matches, stages, vod_team_a: vodTeamAAlias(game), vod_team_b: vodTeamBAlias(game) })
    .from(vods)
    .innerJoin(matches, eq(matches.id, vods.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .leftJoin(vodEntrantAAlias(game), eq(vodEntrantAAlias(game).id, matches.entrantAId))
    .leftJoin(vodTeamAAlias(game), eq(vodTeamAAlias(game).id, vodEntrantAAlias(game).teamId))
    .leftJoin(vodEntrantBAlias(game), eq(vodEntrantBAlias(game).id, matches.entrantBId))
    .leftJoin(vodTeamBAlias(game), eq(vodTeamBAlias(game).id, vodEntrantBAlias(game).teamId));

  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(vods)
    .innerJoin(matches, eq(matches.id, vods.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .leftJoin(vodEntrantAAlias(game), eq(vodEntrantAAlias(game).id, matches.entrantAId))
    .leftJoin(vodTeamAAlias(game), eq(vodTeamAAlias(game).id, vodEntrantAAlias(game).teamId))
    .leftJoin(vodEntrantBAlias(game), eq(vodEntrantBAlias(game).id, matches.entrantBId))
    .leftJoin(vodTeamBAlias(game), eq(vodTeamBAlias(game).id, vodEntrantBAlias(game).teamId))
    .where(where);

  const total = Number(countRow?.total ?? 0);
  const totalPages = total > 0 ? Math.ceil(total / filter.perPage) : 0;

  const rows = await baseQuery
    .where(where)
    .orderBy(desc(matches.scheduledAt), desc(vods.id))
    .limit(filter.perPage)
    .offset((filter.page - 1) * filter.perPage);

  const organizationIds = [...new Set(rows.map((r) => r.vods.organizationId).filter((id): id is number => id != null))];
  const [orgRows, logosByOrgId] = await Promise.all([
    organizationIds.length ? db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, organizationIds)) : Promise.resolve([]),
    getThemedLogoUrlsBatch("organization", organizationIds),
  ]);
  const orgNameById = new Map(orgRows.map((o) => [o.id, o.name]));

  const data: ApiVodEntry[] = rows.map((r) => ({
    id: r.vods.id,
    url: r.vods.url,
    language_code: r.vods.languageCode,
    map_id: r.vods.mapId,
    organization: r.vods.organizationId
      ? { id: r.vods.organizationId, name: orgNameById.get(r.vods.organizationId) ?? "", logos: logosByOrgId.get(r.vods.organizationId) ?? { dark: null, light: null } }
      : null,
    match: {
      id: r.matches.id,
      tournament_id: r.stages.tournamentId,
      round_name: r.matches.label,
      scheduled_at: r.matches.scheduledAt ? r.matches.scheduledAt.toISOString() : null,
      team_a: toApiTeamFromJoined(r.vod_team_a),
      team_b: toApiTeamFromJoined(r.vod_team_b),
    },
  }));

  return { page: filter.page, per_page: filter.perPage, total, total_pages: totalPages, data };
}
