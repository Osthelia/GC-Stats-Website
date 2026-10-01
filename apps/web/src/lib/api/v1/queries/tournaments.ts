/**
 * GC-Stats - tournaments
 *
 * Query helpers for the API v1 `/tournaments` endpoints: fetches a tournament
 * with its stages mapped to legacy V1 "phases" and its logo.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { tournaments, stages, stageContainers, matches } from "@gc-stats/db";
import { escapeLike } from "../params";
import { getLogoUrls, getLogoUrlsBatch, getLogoHistoryResponse, type ApiLogoUrls, type ApiLogoHistoryResponse } from "../logo-response";
import { visibleTournament } from "@/lib/ghost-visibility";
import { rejectGhost } from "@/lib/api/v1/ghost";

export type ApiTournament = {
  id: number;
  name: string;
  region: string | null;
  category: string | null;
  prize_pool: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  status: string;
  description: string | null;
};

/** A V2 stage has neither a single format nor a parent (`tournament.phase` (V1) → `stages` (V2) decision) — always null here. */
export type ApiTournamentPhase = {
  id: number;
  tournament_id: number;
  name: string;
  format: null;
  parent_id: null;
  match_ids: number[];
};

export type ApiTournamentFullResponse = ApiTournament & { phases: ApiTournamentPhase[]; logo: ApiLogoUrls | null };

export function toApiTournament(row: typeof tournaments.$inferSelect): ApiTournament {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    category: row.category,
    prize_pool: row.prizePool,
    location: row.location,
    start_date: row.startDate,
    end_date: row.endDate,
    status: row.status,
    description: row.description,
  };
}

type ApiTournamentPhaseRaw = ApiTournamentPhase & { liquipedia_link: string | null };

/** `match_ids` aggregates every match across all of a stage's `stage_containers`. Includes `liquipedia_link` even though v1's `ApiTournamentPhase` doesn't expose it — kept for V2 to reuse without a second query, stripped by `buildPhasesByTournament` for the v1 contract. */
async function buildPhasesByTournamentRaw(tournamentIds: number[]): Promise<Map<number, ApiTournamentPhaseRaw[]>> {
  const result = new Map<number, ApiTournamentPhaseRaw[]>();
  for (const id of tournamentIds) result.set(id, []);
  if (tournamentIds.length === 0) return result;

  const stageRows = await db
    .select({ id: stages.id, tournamentId: stages.tournamentId, name: stages.name, liquipediaLink: stages.liquipediaLink })
    .from(stages)
    .where(inArray(stages.tournamentId, tournamentIds))
    .orderBy(asc(stages.id));
  const stageIds = stageRows.map((s) => s.id);

  const containerRows =
    stageIds.length > 0
      ? await db
          .select({ id: stageContainers.id, stageId: stageContainers.stageId })
          .from(stageContainers)
          .where(inArray(stageContainers.stageId, stageIds))
      : [];
  const stageIdByContainerId = new Map(containerRows.map((c) => [c.id, c.stageId]));
  const containerIds = containerRows.map((c) => c.id);

  const matchRows = containerIds.length > 0 ? await db.select({ id: matches.id, containerId: matches.containerId }).from(matches).where(inArray(matches.containerId, containerIds)) : [];

  const matchIdsByStage = new Map<number, number[]>();
  for (const m of matchRows) {
    const stageId = stageIdByContainerId.get(m.containerId);
    if (stageId == null) continue;
    const list = matchIdsByStage.get(stageId) ?? [];
    list.push(m.id);
    matchIdsByStage.set(stageId, list);
  }

  for (const stage of stageRows) {
    const list = result.get(stage.tournamentId) ?? [];
    list.push({
      id: stage.id,
      tournament_id: stage.tournamentId,
      name: stage.name,
      format: null,
      parent_id: null,
      match_ids: matchIdsByStage.get(stage.id) ?? [],
      liquipedia_link: stage.liquipediaLink,
    });
    result.set(stage.tournamentId, list);
  }
  return result;
}

export async function buildPhasesByTournamentWithLiquipedia(tournamentIds: number[]): Promise<Map<number, ApiTournamentPhaseRaw[]>> {
  return buildPhasesByTournamentRaw(tournamentIds);
}

async function buildPhasesByTournament(tournamentIds: number[]): Promise<Map<number, ApiTournamentPhase[]>> {
  const raw = await buildPhasesByTournamentRaw(tournamentIds);
  const result = new Map<number, ApiTournamentPhase[]>();
  for (const [tournamentId, phases] of raw) {
    result.set(
      tournamentId,
      phases.map(({ liquipedia_link: _liquipediaLink, ...phase }) => phase),
    );
  }
  return result;
}

export async function searchTournamentsByName(query: string): Promise<ApiTournamentFullResponse[]> {
  const pattern = `${escapeLike(query)}%`;
  const rows = await db.select().from(tournaments).where(and(ilike(tournaments.name, pattern), visibleTournament)).orderBy(asc(tournaments.name)).limit(20);

  const ids = rows.map((r) => r.id);
  const [phasesByTournament, logos] = await Promise.all([buildPhasesByTournament(ids), getLogoUrlsBatch("tournament", ids)]);

  return rows.map((row) => ({ ...toApiTournament(row), phases: phasesByTournament.get(row.id) ?? [], logo: logos.get(row.id) ?? null }));
}

export async function getTournamentById(id: number): Promise<ApiTournamentFullResponse | null> {
  const [row] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  rejectGhost(row, "tournament");
  if (!row) return null;

  const [phasesByTournament, logo] = await Promise.all([buildPhasesByTournament([id]), getLogoUrls("tournament", id)]);
  return { ...toApiTournament(row), phases: phasesByTournament.get(id) ?? [], logo };
}

/** No existence gate — mirrors V1 (`/tournaments/{id}/logos` never documented a 404, always 200 with an empty history). */
export async function getTournamentLogoHistory(id: number): Promise<ApiLogoHistoryResponse> {
  return getLogoHistoryResponse("tournament", id);
}
