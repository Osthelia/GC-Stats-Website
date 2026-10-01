/**
 * GC-Stats - admin-liquipedia
 *
 * Admin queries for the tournament Liquipedia page: each stage's teams with
 * their current Liquipedia name (if any) and every name they are known under.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, eq, inArray, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { entrants, stages, stageContainers, matches, groupEntries, teams, teamNameHistory, liquipediaTeamNames } from "@gc-stats/db";

export type LiquipediaStageTeam = {
  teamId: number;
  displayName: string;
  /** Every name the team is known under, used for matching. */
  names: string[];
  liquipediaName: string | null;
};

export type LiquipediaStage = { id: number; name: string; liquipediaLink: string | null; teams: LiquipediaStageTeam[] };

export async function getTournamentLiquipediaStages(tournamentId: number): Promise<LiquipediaStage[]> {
  const stageRows = await db
    .select({ id: stages.id, name: stages.name, liquipediaLink: stages.liquipediaLink })
    .from(stages)
    .where(eq(stages.tournamentId, tournamentId))
    .orderBy(asc(stages.sequenceOrder), asc(stages.id));
  if (stageRows.length === 0) return [];
  const stageIds = stageRows.map((s) => s.id);

  // A stage's teams: entrants seeded into one of its groups or playing one of its matches.
  const [groupRows, matchRows] = await Promise.all([
    db
      .select({ stageId: stageContainers.stageId, entrantId: groupEntries.entrantId })
      .from(groupEntries)
      .innerJoin(stageContainers, eq(stageContainers.id, groupEntries.containerId))
      .where(inArray(stageContainers.stageId, stageIds)),
    db
      .select({ stageId: stageContainers.stageId, a: matches.entrantAId, b: matches.entrantBId })
      .from(matches)
      .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
      .where(inArray(stageContainers.stageId, stageIds)),
  ]);

  const entrantIdsByStage = new Map<number, Set<number>>(stageIds.map((id) => [id, new Set()]));
  for (const row of groupRows) entrantIdsByStage.get(row.stageId)!.add(row.entrantId);
  for (const row of matchRows) {
    if (row.a !== null) entrantIdsByStage.get(row.stageId)!.add(row.a);
    if (row.b !== null) entrantIdsByStage.get(row.stageId)!.add(row.b);
  }

  const entrantRows = await db
    .select({ id: entrants.id, teamId: entrants.teamId, displayName: entrants.displayName })
    .from(entrants)
    .where(eq(entrants.tournamentId, tournamentId));
  const teamIds = [...new Set(entrantRows.map((e) => e.teamId).filter((id): id is number => id !== null))];

  const [teamRows, historyRows, mappingRows] = teamIds.length
    ? await Promise.all([
        db.select({ id: teams.id, name: teams.name, shortName: teams.shortName }).from(teams).where(inArray(teams.id, teamIds)),
        db.select({ teamId: teamNameHistory.teamId, name: teamNameHistory.name }).from(teamNameHistory).where(inArray(teamNameHistory.teamId, teamIds)),
        db.select({ teamId: liquipediaTeamNames.teamId, name: liquipediaTeamNames.name }).from(liquipediaTeamNames).where(inArray(liquipediaTeamNames.teamId, teamIds)),
      ])
    : [[], [], []];

  const namesByTeam = new Map<number, Set<string>>();
  const addName = (teamId: number, name: string | null) => {
    if (!name?.trim()) return;
    const set = namesByTeam.get(teamId) ?? new Set<string>();
    set.add(name.trim());
    namesByTeam.set(teamId, set);
  };
  for (const team of teamRows) {
    addName(team.id, team.name);
    addName(team.id, team.shortName);
  }
  for (const row of historyRows) addName(row.teamId, row.name);
  for (const row of entrantRows) if (row.teamId !== null) addName(row.teamId, row.displayName);
  const liquipediaByTeam = new Map(mappingRows.map((r) => [r.teamId, r.name]));
  const teamNameById = new Map(teamRows.map((t) => [t.id, t.name]));
  const entrantById = new Map(entrantRows.map((e) => [e.id, e]));

  return stageRows.map((stage) => {
    const byTeam = new Map<number, LiquipediaStageTeam>();
    for (const entrantId of entrantIdsByStage.get(stage.id) ?? []) {
      const entrant = entrantById.get(entrantId);
      if (!entrant || entrant.teamId === null || byTeam.has(entrant.teamId)) continue;
      byTeam.set(entrant.teamId, {
        teamId: entrant.teamId,
        displayName: teamNameById.get(entrant.teamId) ?? entrant.displayName,
        names: [...(namesByTeam.get(entrant.teamId) ?? [])],
        liquipediaName: liquipediaByTeam.get(entrant.teamId) ?? null,
      });
    }
    const stageTeams = [...byTeam.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
    return { ...stage, teams: stageTeams };
  });
}

/** Mappings touching either the given teams or the given names (case-insensitive), for conflict checks. */
export async function findLiquipediaMappings(teamIds: number[], names: string[]): Promise<{ teamId: number; name: string; teamName: string }[]> {
  const lowered = [...new Set(names.map((n) => n.toLowerCase()))];
  const conditions = [];
  if (teamIds.length > 0) conditions.push(inArray(liquipediaTeamNames.teamId, teamIds));
  if (lowered.length > 0) conditions.push(inArray(sql`lower(${liquipediaTeamNames.name})`, lowered));
  if (conditions.length === 0) return [];
  return db
    .select({ teamId: liquipediaTeamNames.teamId, name: liquipediaTeamNames.name, teamName: teams.name })
    .from(liquipediaTeamNames)
    .innerJoin(teams, eq(teams.id, liquipediaTeamNames.teamId))
    .where(or(...conditions));
}
