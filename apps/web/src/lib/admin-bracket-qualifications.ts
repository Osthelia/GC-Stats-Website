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

import { asc, eq, inArray, or } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { stageQualifications, qualificationResults, stageContainers, stages, tournaments, entrants, matches } from "@gc-stats/db";

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
  const containerRows = await db
    .select({ id: stageContainers.id, name: stageContainers.name, stageName: stages.name })
    .from(stageContainers)
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(eq(stages.tournamentId, tournamentId));
  if (containerRows.length === 0) return [];
  const containerById = new Map(containerRows.map((c) => [c.id, c]));
  const containerIds = containerRows.map((c) => c.id);

  const matchRows = await db.select().from(matches).where(inArray(matches.containerId, containerIds)).orderBy(asc(matches.containerId), asc(matches.round), asc(matches.id));
  const matchById = new Map(matchRows.map((m) => [m.id, m]));
  const matchIds = matchRows.map((m) => m.id);

  const entrantIds = [...new Set(matchRows.flatMap((m) => [m.entrantAId, m.entrantBId]).filter((id): id is number => id !== null))];
  const entrantRows = entrantIds.length ? await db.select({ id: entrants.id, displayName: entrants.displayName }).from(entrants).where(inArray(entrants.id, entrantIds)) : [];
  const entrantNameById = new Map(entrantRows.map((e) => [e.id, e.displayName]));

  const conditions = [];
  if (containerIds.length) conditions.push(inArray(stageQualifications.sourceContainerId, containerIds));
  if (matchIds.length) conditions.push(inArray(stageQualifications.sourceMatchId, matchIds));
  if (conditions.length === 0) return [];

  const rules = await db.select().from(stageQualifications).where(or(...conditions));
  if (rules.length === 0) return [];

  const destContainerIds = [...new Set(rules.map((r) => r.destinationContainerId).filter((id): id is number => id !== null))];
  const destRows = destContainerIds.length
    ? await db
        .select({ id: stageContainers.id, name: stageContainers.name, stageName: stages.name, tournamentId: tournaments.id, tournamentName: tournaments.name })
        .from(stageContainers)
        .innerJoin(stages, eq(stages.id, stageContainers.stageId))
        .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
        .where(inArray(stageContainers.id, destContainerIds))
    : [];
  const destById = new Map(destRows.map((d) => [d.id, d]));

  const resultRows = await db.select().from(qualificationResults).where(inArray(qualificationResults.qualificationId, rules.map((r) => r.id)));
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
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    const rows = await db
      .select({ id: stageContainers.id, name: stageContainers.name, stageName: stages.name, tournamentId: tournaments.id, tournamentName: tournaments.name })
      .from(stageContainers)
      .innerJoin(stages, eq(stages.id, stageContainers.stageId))
      .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
      .orderBy(asc(tournaments.startDate))
      .limit(15);
    return rows.reverse();
  }

  const rows = await db
    .select({ id: stageContainers.id, name: stageContainers.name, stageName: stages.name, tournamentId: tournaments.id, tournamentName: tournaments.name })
    .from(stageContainers)
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .limit(300);

  const lower = words.map((w) => w.toLowerCase());
  return rows
    .filter((r) => {
      const haystack = `${r.tournamentName} ${r.stageName} ${r.name}`.toLowerCase();
      return lower.every((w) => haystack.includes(w));
    })
    .slice(0, 15);
}
