/**
 * GC-Stats - entrant-qualification-source
 *
 * Where an entrant's spot in a tournament comes from: derived from the
 * qualification rules (a team that advanced from another tournament), or
 * set by hand by an admin (invite, ranking, other tournament).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { db } from "@gc-stats/db/client";
import { entrants, matches, pointTypes, stageContainers, stageQualifications, qualificationResults, stages, tournaments } from "@gc-stats/db";

export const QUALIFICATION_SOURCE_TYPES = ["tournament", "invite", "points"] as const;
export type QualificationSourceType = (typeof QUALIFICATION_SOURCE_TYPES)[number];

/** "auto" derives the source from the qualification rules, "none" is a manual choice of showing no source. */
export const QUALIFICATION_MODES = ["auto", "none", ...QUALIFICATION_SOURCE_TYPES] as const;
export type QualificationMode = (typeof QUALIFICATION_MODES)[number];

export type EntrantQualificationSource = {
  type: QualificationSourceType;
  tournamentId: number | null;
  tournamentName: string | null;
  pointTypeLabel: string | null;
  /** Container and rank the team came from, only known for an automatic source. */
  detail: string | null;
  origin: "auto" | "manual";
};

export type EntrantSourceInput = {
  id: number;
  teamId: number | null;
  qualificationSourceManual: boolean;
  qualificationSourceType: string | null;
  qualificationSourceTournamentId: number | null;
  qualificationSourcePointTypeId: number | null;
};

type Db = typeof db;

/** Most recent source tournament per team, from the qualification results that land in this tournament's containers. */
async function findAutoSources(client: Db, tournamentId: number, teamIds: number[]): Promise<Map<number, EntrantQualificationSource>> {
  const result = new Map<number, EntrantQualificationSource>();
  if (teamIds.length === 0) return result;

  const sourceEntrant = alias(entrants, "source_entrant");
  const sourceMatch = alias(matches, "source_match");
  const sourceContainer = alias(stageContainers, "source_container");
  const destinationContainerIds = client
    .select({ id: stageContainers.id })
    .from(stageContainers)
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(eq(stages.tournamentId, tournamentId));

  const rows = await client
    .select({
      teamId: sourceEntrant.teamId,
      rank: qualificationResults.rank,
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      containerName: sourceContainer.name,
    })
    .from(qualificationResults)
    .innerJoin(stageQualifications, eq(stageQualifications.id, qualificationResults.qualificationId))
    .innerJoin(sourceEntrant, eq(sourceEntrant.id, qualificationResults.entrantId))
    .innerJoin(tournaments, eq(tournaments.id, sourceEntrant.tournamentId))
    .leftJoin(sourceMatch, eq(sourceMatch.id, stageQualifications.sourceMatchId))
    .innerJoin(sourceContainer, eq(sourceContainer.id, sql`coalesce(${stageQualifications.sourceContainerId}, ${sourceMatch.containerId})`))
    .where(
      and(
        eq(stageQualifications.destinationType, "container"),
        inArray(stageQualifications.destinationContainerId, destinationContainerIds),
        inArray(sourceEntrant.teamId, teamIds),
        ne(sourceEntrant.tournamentId, tournamentId),
      ),
    )
    .orderBy(desc(tournaments.startDate), desc(qualificationResults.id));

  for (const row of rows) {
    if (row.teamId === null || result.has(row.teamId)) continue;
    result.set(row.teamId, {
      type: "tournament",
      tournamentId: row.tournamentId,
      tournamentName: row.tournamentName,
      pointTypeLabel: null,
      detail: row.rank !== null ? `${row.containerName} #${row.rank}` : row.containerName,
      origin: "auto",
    });
  }
  return result;
}

/** Effective source of each entrant (manual choice wins, else the qualification rules), keyed by entrant id. Entrants without any source are absent. */
export async function resolveEntrantQualificationSources(client: Db, tournamentId: number, rows: EntrantSourceInput[]): Promise<Map<number, EntrantQualificationSource>> {
  const autoTeamIds = rows.filter((r) => !r.qualificationSourceManual && r.teamId !== null).map((r) => r.teamId as number);
  const autoByTeam = await findAutoSources(client, tournamentId, [...new Set(autoTeamIds)]);

  const manualTournamentIds = [...new Set(rows.filter((r) => r.qualificationSourceManual && r.qualificationSourceTournamentId !== null).map((r) => r.qualificationSourceTournamentId as number))];
  const manualTournaments = manualTournamentIds.length
    ? await client.select({ id: tournaments.id, name: tournaments.name }).from(tournaments).where(inArray(tournaments.id, manualTournamentIds))
    : [];
  const tournamentNameById = new Map(manualTournaments.map((t) => [t.id, t.name]));

  const pointTypeIds = [...new Set(rows.filter((r) => r.qualificationSourceManual && r.qualificationSourcePointTypeId !== null).map((r) => r.qualificationSourcePointTypeId as number))];
  const pointTypeRows = pointTypeIds.length ? await client.select({ id: pointTypes.id, label: pointTypes.label }).from(pointTypes).where(inArray(pointTypes.id, pointTypeIds)) : [];
  const pointTypeLabelById = new Map(pointTypeRows.map((p) => [p.id, p.label]));

  const out = new Map<number, EntrantQualificationSource>();
  for (const row of rows) {
    if (row.qualificationSourceManual) {
      const type = QUALIFICATION_SOURCE_TYPES.find((t) => t === row.qualificationSourceType);
      if (!type) continue;
      const sourceTournamentId = type === "tournament" ? row.qualificationSourceTournamentId : null;
      out.set(row.id, {
        type,
        tournamentId: sourceTournamentId,
        tournamentName: sourceTournamentId !== null ? (tournamentNameById.get(sourceTournamentId) ?? null) : null,
        pointTypeLabel: type === "points" && row.qualificationSourcePointTypeId !== null ? (pointTypeLabelById.get(row.qualificationSourcePointTypeId) ?? null) : null,
        detail: null,
        origin: "manual",
      });
    } else if (row.teamId !== null) {
      const auto = autoByTeam.get(row.teamId);
      if (auto) out.set(row.id, auto);
    }
  }
  return out;
}
