/**
 * GC-Stats - liquipedia-match-data
 *
 * Loads match data and builds `{{MatchPage}}` wikicode, batched so a whole
 * stage costs a fixed number of queries.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { tournaments, stages, stageContainers, matches, entrants, matchVetos, maps, mapRoundsRaw, liquipediaTeamNames } from "@gc-stats/db";
import { buildMatchPageWikicode, type WikicodeMap, type WikicodeVetoStep } from "@/lib/liquipedia-match-wikicode";
import { knownScheduledAt } from "@/lib/match-schedule";

export type LiquipediaMatchWikicode = {
  matchId: number;
  tournamentId: number;
  tournamentName: string;
  tournamentIsGhost: boolean;
  stageId: number;
  stageName: string;
  containerName: string;
  round: number;
  label: string | null;
  status: "pending" | "live" | "completed";
  scheduledAt: Date | null;
  scoreA: number | null;
  scoreB: number | null;
  teamAName: string;
  teamBName: string;
  wikicode: string;
  /** Teams written with their GC Stats name because they have no Liquipedia name yet. */
  unlinkedTeams: string[];
};

function isOnline(location: string | null): boolean {
  return !location?.trim() || /online/i.test(location);
}

async function buildWikicodes(matchIds: number[]): Promise<LiquipediaMatchWikicode[]> {
  if (matchIds.length === 0) return [];

  const matchRows = await db
    .select({
      id: matches.id,
      round: matches.round,
      label: matches.label,
      bestOf: matches.bestOf,
      status: matches.status,
      scheduledAt: matches.scheduledAt,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
      containerName: stageContainers.name,
      stageId: stages.id,
      stageName: stages.name,
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      tournamentIsGhost: tournaments.isGhost,
      location: tournaments.location,
    })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(inArray(matches.id, matchIds));
  if (matchRows.length === 0) return [];

  const entrantIds = [...new Set(matchRows.flatMap((m) => [m.entrantAId, m.entrantBId]).filter((id): id is number => id !== null))];
  const [entrantRows, vetoRows, mapRows] = await Promise.all([
    entrantIds.length
      ? db.select({ id: entrants.id, teamId: entrants.teamId, displayName: entrants.displayName }).from(entrants).where(inArray(entrants.id, entrantIds))
      : Promise.resolve([]),
    db
      .select({ matchId: matchVetos.matchId, entrantId: matchVetos.entrantId, mapName: matchVetos.mapName, type: matchVetos.type, side: matchVetos.side, sidePickedBy: matchVetos.sidePickedByEntrantId })
      .from(matchVetos)
      .where(inArray(matchVetos.matchId, matchIds))
      .orderBy(asc(matchVetos.matchId), asc(matchVetos.order)),
    db
      .select({ id: maps.id, matchId: maps.matchId, mapName: maps.mapName, apiMatchId: maps.apiMatchId, teamAScore: maps.teamAScore, teamBScore: maps.teamBScore })
      .from(maps)
      .where(inArray(maps.matchId, matchIds))
      .orderBy(asc(maps.matchId), asc(maps.order)),
  ]);

  const teamIds = [...new Set(entrantRows.map((e) => e.teamId).filter((id): id is number => id !== null))];
  const [firstRounds, nameRows] = await Promise.all([
    mapRows.length
      ? db
          .selectDistinctOn([mapRoundsRaw.mapId], { mapId: mapRoundsRaw.mapId, atkEntrantId: mapRoundsRaw.atkEntrantId })
          .from(mapRoundsRaw)
          .where(inArray(mapRoundsRaw.mapId, mapRows.map((m) => m.id)))
          .orderBy(asc(mapRoundsRaw.mapId), asc(mapRoundsRaw.roundNumber))
      : Promise.resolve([]),
    teamIds.length
      ? db.select({ teamId: liquipediaTeamNames.teamId, name: liquipediaTeamNames.name }).from(liquipediaTeamNames).where(inArray(liquipediaTeamNames.teamId, teamIds))
      : Promise.resolve([]),
  ]);

  const entrantById = new Map(entrantRows.map((e) => [e.id, e]));
  const firstAtkByMap = new Map(firstRounds.map((r) => [r.mapId, r.atkEntrantId]));
  const nameByTeam = new Map(nameRows.map((r) => [r.teamId, r.name]));

  return matchRows.map((match) => {
    const entrantA = match.entrantAId;
    const entrantB = match.entrantBId;
    const matchVetoRows = vetoRows.filter((r) => r.matchId === match.id);

    const veto: WikicodeVetoStep[] = matchVetoRows
      .filter((row) => (row.entrantId === entrantA || row.entrantId === entrantB) && (row.type === "ban" || row.type === "pick" || row.type === "decider"))
      .map((row) => ({ slot: row.entrantId === entrantA ? 1 : 2, mapName: row.mapName, type: row.type as WikicodeVetoStep["type"] }));

    // Starting side from the veto when no round data exists yet.
    const team1DefenseFromVeto = (mapName: string): boolean | null => {
      const row = matchVetoRows.find((r) => r.mapName === mapName && r.side && r.sidePickedBy !== null);
      if (!row) return null;
      return row.sidePickedBy === entrantA ? row.side === "def" : row.side === "atk";
    };

    const matchMaps = mapRows.filter((m) => m.matchId === match.id);
    const wikicodeMaps: WikicodeMap[] =
      matchMaps.length > 0
        ? matchMaps.map((map) => {
            const firstAtk = firstAtkByMap.get(map.id) ?? null;
            const mapName = map.mapName ?? "";
            return {
              mapName,
              apiMatchId: map.apiMatchId,
              skipped: map.teamAScore === -1 && map.teamBScore === -1,
              team1StartedDefense: firstAtk !== null && entrantA !== null ? firstAtk !== entrantA : team1DefenseFromVeto(mapName),
            };
          })
        : veto
            .filter((step) => step.type !== "ban")
            .map((step) => ({ mapName: step.mapName, apiMatchId: null, skipped: false, team1StartedDefense: team1DefenseFromVeto(step.mapName) }));

    const unlinkedTeams: string[] = [];
    const side = (entrantId: number | null) => {
      const entrant = entrantId !== null ? entrantById.get(entrantId) : undefined;
      if (!entrant) return { display: "TBD", wiki: "TBD" };
      const name = entrant.teamId !== null ? nameByTeam.get(entrant.teamId) : undefined;
      if (!name) unlinkedTeams.push(entrant.displayName);
      return { display: entrant.displayName, wiki: name ?? entrant.displayName };
    };
    const a = side(entrantA);
    const b = side(entrantB);
    const scheduledAt = knownScheduledAt(match.scheduledAt);

    return {
      matchId: match.id,
      tournamentId: match.tournamentId,
      tournamentName: match.tournamentName,
      tournamentIsGhost: match.tournamentIsGhost,
      stageId: match.stageId,
      stageName: match.stageName,
      containerName: match.containerName,
      round: match.round,
      label: match.label,
      status: match.status,
      scheduledAt,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      teamAName: a.display,
      teamBName: b.display,
      unlinkedTeams,
      wikicode: buildMatchPageWikicode({
        scheduledAt,
        online: isOnline(match.location),
        bestOf: match.bestOf,
        opponent1: a.wiki,
        opponent2: b.wiki,
        veto,
        maps: wikicodeMaps,
      }),
    };
  });
}

export async function getLiquipediaMatchWikicode(matchId: number): Promise<LiquipediaMatchWikicode | null> {
  const [result] = await buildWikicodes([matchId]);
  return result ?? null;
}

export type LiquipediaStageOption = { id: number; name: string };

/** Public stages of a tournament, in bracket order. */
export async function getLiquipediaStageOptions(tournamentId: number): Promise<LiquipediaStageOption[]> {
  return db
    .select({ id: stages.id, name: stages.name })
    .from(stages)
    .where(and(eq(stages.tournamentId, tournamentId), eq(stages.active, true)))
    .orderBy(asc(stages.sequenceOrder), asc(stages.id));
}

/** Every match of a stage that has at least one entrant, ordered by container, round, then date. */
export async function getStageLiquipediaWikicodes(stageId: number): Promise<LiquipediaMatchWikicode[]> {
  const rows = await db
    .select({ id: matches.id })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .where(and(eq(stageContainers.stageId, stageId), or(isNotNull(matches.entrantAId), isNotNull(matches.entrantBId))))
    .orderBy(asc(stageContainers.id), asc(matches.round), asc(matches.scheduledAt), asc(matches.displayOrder), asc(matches.id));
  const order = new Map(rows.map((r, index) => [r.id, index]));
  const result = await buildWikicodes(rows.map((r) => r.id));
  return result.sort((x, y) => order.get(x.matchId)! - order.get(y.matchId)!);
}
