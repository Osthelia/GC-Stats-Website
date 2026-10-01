/**
 * GC-Stats - matches
 *
 * Query helpers for the API v2 paginated matches listing, reusing v1's
 * team/veto shaping while adding v2 specific filters and pagination.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, gte, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import { matches, entrants, teams, stageContainers, stages } from "@gc-stats/db";
import { exclusiveUpperBound } from "../../v1/params";
import { toApiTeamFromJoined } from "../../v1/entities";
import { buildVetosByMatch, type ApiMatchVeto } from "../../v1/queries/match-vetos";
import type { ApiTeamWithScore } from "../../v1/queries/teams";
import type { MatchesFilter } from "../params";

const listEntrantAAlias = alias(entrants, "list_entrant_a");
const listEntrantBAlias = alias(entrants, "list_entrant_b");
const listTeamAAlias = alias(teams, "list_team_a");
const listTeamBAlias = alias(teams, "list_team_b");

export type ApiMatchListEntry = {
  id: number;
  tournament_id: number;
  phase_id: number;
  round_number: number | null;
  round_name: string | null;
  scheduled_at: string | null;
  status: string;
  best_of: number;
  patch: string | null;
  team_a: ApiTeamWithScore | null;
  team_b: ApiTeamWithScore | null;
  vetos: ApiMatchVeto[];
};

export type ApiPaginatedMatches = { page: number; per_page: number; total: number; total_pages: number; data: ApiMatchListEntry[] };

/**
 * Global match listing, most recent first, always paginated (API_V2.md perf
 * note: never an unbounded scan over `matches`). `team_id` matches either
 * side, same convention as the vods listing's own `team_id` filter.
 */
export async function getMatchesV2(filter: MatchesFilter): Promise<ApiPaginatedMatches> {
  const conditions = [];
  if (filter.from) conditions.push(gte(matches.scheduledAt, new Date(`${filter.from}T00:00:00.000Z`)));
  if (filter.to) conditions.push(lt(matches.scheduledAt, exclusiveUpperBound(filter.to)));
  if (filter.status) conditions.push(eq(matches.status, filter.status as "pending" | "live" | "completed"));
  if (filter.roundName) conditions.push(eq(matches.label, filter.roundName));
  if (filter.tournamentId) conditions.push(eq(stages.tournamentId, filter.tournamentId));
  if (filter.stageId) conditions.push(eq(stageContainers.stageId, filter.stageId));
  if (filter.teamId) conditions.push(or(eq(listTeamAAlias.id, filter.teamId), eq(listTeamBAlias.id, filter.teamId)) ?? sql`false`);
  const where = conditions.length ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .leftJoin(listEntrantAAlias, eq(listEntrantAAlias.id, matches.entrantAId))
    .leftJoin(listTeamAAlias, eq(listTeamAAlias.id, listEntrantAAlias.teamId))
    .leftJoin(listEntrantBAlias, eq(listEntrantBAlias.id, matches.entrantBId))
    .leftJoin(listTeamBAlias, eq(listTeamBAlias.id, listEntrantBAlias.teamId))
    .where(where);
  const total = Number(countRow?.total ?? 0);
  const totalPages = total > 0 ? Math.ceil(total / filter.perPage) : 0;

  const rows = await db
    .select({
      id: matches.id,
      round: matches.round,
      label: matches.label,
      scheduledAt: matches.scheduledAt,
      status: matches.status,
      bestOf: matches.bestOf,
      patch: matches.patch,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      stageId: stages.id,
      tournamentId: stages.tournamentId,
      teamA: listTeamAAlias,
      teamB: listTeamBAlias,
    })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .leftJoin(listEntrantAAlias, eq(listEntrantAAlias.id, matches.entrantAId))
    .leftJoin(listTeamAAlias, eq(listTeamAAlias.id, listEntrantAAlias.teamId))
    .leftJoin(listEntrantBAlias, eq(listEntrantBAlias.id, matches.entrantBId))
    .leftJoin(listTeamBAlias, eq(listTeamBAlias.id, listEntrantBAlias.teamId))
    .where(where)
    .orderBy(desc(matches.scheduledAt), desc(matches.id))
    .limit(filter.perPage)
    .offset((filter.page - 1) * filter.perPage);

  const vetosByMatch = await buildVetosByMatch(rows.map((r) => r.id));

  const data: ApiMatchListEntry[] = rows.map((row) => {
    const teamA = toApiTeamFromJoined(row.teamA);
    const teamB = toApiTeamFromJoined(row.teamB);
    return {
      id: row.id,
      tournament_id: row.tournamentId,
      phase_id: row.stageId,
      round_number: row.round,
      round_name: row.label,
      scheduled_at: row.scheduledAt ? row.scheduledAt.toISOString() : null,
      status: row.status,
      best_of: row.bestOf,
      patch: row.patch,
      team_a: teamA ? { team: teamA, score: row.scoreA } : null,
      team_b: teamB ? { team: teamB, score: row.scoreB } : null,
      vetos: vetosByMatch.get(row.id) ?? [],
    };
  });

  return { page: filter.page, per_page: filter.perPage, total, total_pages: totalPages, data };
}
