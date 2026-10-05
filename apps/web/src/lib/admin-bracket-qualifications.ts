/**
 * GC-Stats - admin-bracket-qualifications
 *
 * Resolves qualification rules (rank or match based sources advancing
 * entrants to another container or a final placement) for a tournament's
 * bracket editor, plus destination container search.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { foldedIlike } from "@/lib/db-search";
import { adminDb as db } from "@gc-stats/db/client";
import { stageQualifications, qualificationResults, stageContainers, stages, tournaments, entrants, matches } from "@gc-stats/db";
import { containerOrderBy } from "@/lib/bracket/container-order";

export type AdminQualificationSource =
  | { kind: "rank"; containerId: number; containerName: string; stageName: string; rankFrom: number; rankTo: number }
  | { kind: "match"; matchId: number; containerName: string; stageName: string; round: number; label: string | null; outcome: "winner" | "loser"; entrantAName: string | null; entrantBName: string | null };

export type AdminQualificationDestination =
  | { kind: "container"; containerId: number; containerName: string; stageName: string; tournamentId: number; tournamentName: string }
  | { kind: "placement"; placement: number; placementLabel: string; points: number | null; cashPrizeAmount: string | null; cashPrizeCurrency: string | null };

export type AdminQualificationResolvedResult = { entrantId: number; entrantName: string; rank: number | null };

export type AdminQualificationRule = {
  id: number;
  source: AdminQualificationSource;
  destination: AdminQualificationDestination;
  results: AdminQualificationResolvedResult[];
};

/** Every `stage_qualifications` row anchored (directly or via its source match's container) on one of this tournament's stages — the full set an admin can manage from the tournament's bracket editor hub. */
export async function getAdminQualificationRules(tournamentId: number): Promise<AdminQualificationRule[]> {
  const tournamentStageIds = db.select({ id: stages.id }).from(stages).where(eq(stages.tournamentId, tournamentId));
  const tournamentContainerIds = db.select({ id: stageContainers.id }).from(stageContainers).where(inArray(stageContainers.stageId, tournamentStageIds));
  const tournamentMatchIds = db.select({ id: matches.id }).from(matches).where(inArray(matches.containerId, tournamentContainerIds));

  const [containerRows, matchRows, rules, entrantRows] = await Promise.all([
    db
      .select({ id: stageContainers.id, name: stageContainers.name, stageName: stages.name })
      .from(stageContainers)
      .innerJoin(stages, eq(stages.id, stageContainers.stageId))
      .where(eq(stages.tournamentId, tournamentId)),
    db.select().from(matches).where(inArray(matches.containerId, tournamentContainerIds)).orderBy(asc(matches.containerId), asc(matches.round), asc(matches.id)),
    db
      .select()
      .from(stageQualifications)
      .where(or(inArray(stageQualifications.sourceContainerId, tournamentContainerIds), inArray(stageQualifications.sourceMatchId, tournamentMatchIds))),
    db.select({ id: entrants.id, displayName: entrants.displayName }).from(entrants).where(eq(entrants.tournamentId, tournamentId)),
  ]);
  if (rules.length === 0) return [];
  const containerById = new Map(containerRows.map((c) => [c.id, c]));
  const matchById = new Map(matchRows.map((m) => [m.id, m]));
  const entrantNameById = new Map(entrantRows.map((e) => [e.id, e.displayName]));

  const destContainerIds = [...new Set(rules.map((r) => r.destinationContainerId).filter((id): id is number => id !== null))];
  const [destRows, resultRows] = await Promise.all([
    destContainerIds.length
      ? db
          .select({ id: stageContainers.id, name: stageContainers.name, stageName: stages.name, tournamentId: tournaments.id, tournamentName: tournaments.name })
          .from(stageContainers)
          .innerJoin(stages, eq(stages.id, stageContainers.stageId))
          .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
          .where(inArray(stageContainers.id, destContainerIds))
      : [],
    db.select().from(qualificationResults).where(inArray(qualificationResults.qualificationId, rules.map((r) => r.id))),
  ]);
  const destById = new Map(destRows.map((d) => [d.id, d]));

  const otherEntrantIds = [...new Set(resultRows.map((r) => r.entrantId).filter((id) => !entrantNameById.has(id)))];
  if (otherEntrantIds.length) {
    const rows = await db.select({ id: entrants.id, displayName: entrants.displayName }).from(entrants).where(inArray(entrants.id, otherEntrantIds));
    for (const row of rows) entrantNameById.set(row.id, row.displayName);
  }

  const out: AdminQualificationRule[] = [];
  for (const rule of rules) {
    let source: AdminQualificationSource;
    if (rule.sourceContainerId !== null) {
      const container = containerById.get(rule.sourceContainerId);
      if (!container || rule.rankFrom === null || rule.rankTo === null) continue;
      source = { kind: "rank", containerId: container.id, containerName: container.name, stageName: container.stageName, rankFrom: rule.rankFrom, rankTo: rule.rankTo };
    } else if (rule.sourceMatchId !== null) {
      const match = matchById.get(rule.sourceMatchId);
      const container = match ? containerById.get(match.containerId) : undefined;
      if (!match || !container || rule.outcome === null) continue;
      source = {
        kind: "match",
        matchId: match.id,
        containerName: container.name,
        stageName: container.stageName,
        round: match.round,
        label: match.label,
        outcome: rule.outcome,
        entrantAName: match.entrantAId !== null ? (entrantNameById.get(match.entrantAId) ?? null) : null,
        entrantBName: match.entrantBId !== null ? (entrantNameById.get(match.entrantBId) ?? null) : null,
      };
    } else {
      continue;
    }

    let destination: AdminQualificationDestination;
    if (rule.destinationType === "container") {
      const dest = rule.destinationContainerId !== null ? destById.get(rule.destinationContainerId) : undefined;
      if (!dest) continue;
      destination = { kind: "container", containerId: dest.id, containerName: dest.name, stageName: dest.stageName, tournamentId: dest.tournamentId, tournamentName: dest.tournamentName };
    } else {
      if (rule.placement === null || rule.placementLabel === null) continue;
      destination = { kind: "placement", placement: rule.placement, placementLabel: rule.placementLabel, points: rule.points, cashPrizeAmount: rule.cashPrizeAmount, cashPrizeCurrency: rule.cashPrizeCurrency };
    }

    const results: AdminQualificationResolvedResult[] = resultRows
      .filter((r) => r.qualificationId === rule.id)
      .map((r) => ({ entrantId: r.entrantId, entrantName: entrantNameById.get(r.entrantId) ?? `#${r.entrantId}`, rank: r.rank }))
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

    out.push({ id: rule.id, source, destination, results });
  }

  return out;
}

export type QualificationContainerSearchResult = { id: number; name: string; stageName: string; tournamentId: number; tournamentName: string };

/** Cross-tournament container search for the destination picker (a rule can advance an entrant into another tournament entirely, e.g. regional -> major). */
export async function searchQualificationDestinationContainers(query: string): Promise<QualificationContainerSearchResult[]> {
  const words = query
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  // Each word must match the tournament, stage or container name
  const conditions = words.map((w) => or(foldedIlike(tournaments.name, w), foldedIlike(stages.name, w), foldedIlike(stageContainers.name, w)));

  return db
    .select({ id: stageContainers.id, name: stageContainers.name, stageName: stages.name, tournamentId: tournaments.id, tournamentName: tournaments.name })
    .from(stageContainers)
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(and(...conditions))
    .orderBy(sql`${tournaments.startDate} DESC NULLS LAST`, asc(stages.id), ...containerOrderBy)
    .limit(30);
}
