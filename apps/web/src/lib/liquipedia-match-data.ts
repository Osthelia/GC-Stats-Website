/**
 * GC-Stats - liquipedia-match-data
 *
 * Loads match data and builds `{{MatchPage}}` wikicode, batched so a whole
 * stage costs a fixed number of queries.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { gameTables, valorantTablesOf } from "@gc-stats/db";
import { buildMatchPageWikicode, type WikicodeMap, type WikicodeVetoStep } from "@/lib/liquipedia-match-wikicode";
import { knownScheduledAt } from "@/lib/match-schedule";
import type { GameSlug } from "@gc-stats/db/game";

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

// International broadcasts are the English ones.
function isInternationalLanguage(code: string): boolean {
  return code.trim().toLowerCase().startsWith("en");
}

/** What every game's match wikicode starts from: the match, its two teams under their Liquipedia names and the official channels. */
export type MatchExportBase = {
  /** The part of the result that doesn't depend on the game. */
  summary: Omit<LiquipediaMatchWikicode, "wikicode">;
  bestOf: number;
  patch: string | null;
  isForfeit: boolean;
  winnerEntrantId: number | null;
  entrantAId: number | null;
  entrantBId: number | null;
  /** Names as written in the wikicode: the Liquipedia name, else the GC Stats one. */
  opponent1: string;
  opponent2: string;
  twitch: string[];
  youtube: string[];
};

/** The matches in one batch of queries, so a whole stage costs a fixed number. */
export async function loadMatchExportBases(game: GameSlug, matchIds: number[]): Promise<MatchExportBase[]> {
  const { tournaments, stages, stageContainers, matches, entrants, liquipediaTeamNames, matchStreams, streamChannels } = gameTables(game);
  if (matchIds.length === 0) return [];

  const matchRows = await db
    .select({
      id: matches.id,
      round: matches.round,
      label: matches.label,
      bestOf: matches.bestOf,
      patch: matches.patch,
      isForfeit: matches.isForfeit,
      winnerEntrantId: matches.winnerId,
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
    })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(inArray(matches.id, matchIds));
  if (matchRows.length === 0) return [];

  const entrantIds = [...new Set(matchRows.flatMap((m) => [m.entrantAId, m.entrantBId]).filter((id): id is number => id !== null))];
  const [entrantRows, nameRows, streamRows] = await Promise.all([
    entrantIds.length
      ? db.select({ id: entrants.id, teamId: entrants.teamId, displayName: entrants.displayName }).from(entrants).where(inArray(entrants.id, entrantIds))
      : Promise.resolve([]),
    entrantIds.length
      ? db
          .select({ teamId: liquipediaTeamNames.teamId, name: liquipediaTeamNames.name })
          .from(liquipediaTeamNames)
          .innerJoin(entrants, eq(entrants.teamId, liquipediaTeamNames.teamId))
          .where(inArray(entrants.id, entrantIds))
      : Promise.resolve([]),
    db
      .select({ matchId: matchStreams.matchId, name: streamChannels.name, platform: streamChannels.platform, languageCode: streamChannels.languageCode })
      .from(matchStreams)
      .innerJoin(streamChannels, eq(streamChannels.id, matchStreams.streamChannelId))
      .where(and(inArray(matchStreams.matchId, matchIds), eq(streamChannels.type, "official"), eq(streamChannels.isActive, true)))
      .orderBy(asc(streamChannels.id)),
  ]);

  const entrantById = new Map(entrantRows.map((e) => [e.id, e]));
  const nameByTeam = new Map(nameRows.map((r) => [r.teamId, r.name]));

  return matchRows.map((match) => {
    const channelsOf = (platform: string) => streamRows.filter((r) => r.matchId === match.id && r.platform === platform && isInternationalLanguage(r.languageCode)).map((r) => r.name);
    const unlinkedTeams: string[] = [];
    const side = (entrantId: number | null) => {
      const entrant = entrantId !== null ? entrantById.get(entrantId) : undefined;
      if (!entrant) return { display: "TBD", wiki: "TBD" };
      const name = entrant.teamId !== null ? nameByTeam.get(entrant.teamId) : undefined;
      if (!name) unlinkedTeams.push(entrant.displayName);
      return { display: entrant.displayName, wiki: name ?? entrant.displayName };
    };
    const a = side(match.entrantAId);
    const b = side(match.entrantBId);

    return {
      summary: {
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
        scheduledAt: knownScheduledAt(match.scheduledAt),
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        teamAName: a.display,
        teamBName: b.display,
        unlinkedTeams,
      },
      bestOf: match.bestOf,
      patch: match.patch,
      isForfeit: match.isForfeit,
      winnerEntrantId: match.winnerEntrantId,
      entrantAId: match.entrantAId,
      entrantBId: match.entrantBId,
      opponent1: a.wiki,
      opponent2: b.wiki,
      twitch: channelsOf("twitch"),
      youtube: channelsOf("youtube"),
    };
  });
}

async function buildWikicodes(game: GameSlug, matchIds: number[]): Promise<LiquipediaMatchWikicode[]> {
  const { matchVetos, maps, mapRoundsRaw } = valorantTablesOf(game);
  if (matchIds.length === 0) return [];
  const [bases, vetoRows, mapRows] = await Promise.all([
    loadMatchExportBases(game, matchIds),
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
  if (bases.length === 0) return [];
  const firstRounds = mapRows.length
    ? await db
        .selectDistinctOn([mapRoundsRaw.mapId], { mapId: mapRoundsRaw.mapId, atkEntrantId: mapRoundsRaw.atkEntrantId })
        .from(mapRoundsRaw)
        .where(inArray(mapRoundsRaw.mapId, mapRows.map((m) => m.id)))
        .orderBy(asc(mapRoundsRaw.mapId), asc(mapRoundsRaw.roundNumber))
    : [];
  const firstAtkByMap = new Map(firstRounds.map((r) => [r.mapId, r.atkEntrantId]));

  return bases.map(({ summary, bestOf, entrantAId: entrantA, entrantBId: entrantB, opponent1, opponent2, twitch, youtube }) => {
    const matchVetoRows = vetoRows.filter((r) => r.matchId === summary.matchId);

    const veto: WikicodeVetoStep[] = matchVetoRows
      .filter((row) => (row.entrantId === entrantA || row.entrantId === entrantB) && (row.type === "ban" || row.type === "pick" || row.type === "decider"))
      .map((row) => ({ slot: row.entrantId === entrantA ? 1 : 2, mapName: row.mapName, type: row.type as WikicodeVetoStep["type"] }));

    // Starting side from the veto when no round data exists yet.
    const team1DefenseFromVeto = (mapName: string): boolean | null => {
      const row = matchVetoRows.find((r) => r.mapName === mapName && r.side && r.sidePickedBy !== null);
      if (!row) return null;
      return row.sidePickedBy === entrantA ? row.side === "def" : row.side === "atk";
    };

    const matchMaps = mapRows.filter((m) => m.matchId === summary.matchId);
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

    return {
      ...summary,
      wikicode: buildMatchPageWikicode({ scheduledAt: summary.scheduledAt, bestOf, opponent1, opponent2, twitch, youtube, veto, maps: wikicodeMaps }),
    };
  });
}

export async function getLiquipediaMatchWikicode(game: GameSlug, matchId: number): Promise<LiquipediaMatchWikicode | null> {
  const [result] = await buildWikicodes(game, [matchId]);
  return result ?? null;
}
