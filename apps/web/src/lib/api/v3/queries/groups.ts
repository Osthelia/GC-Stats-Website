/**
 * GC-Stats - groups
 *
 * Query helpers for the API v3 tournament groups endpoint: ranked standings
 * (wins, maps, rounds, buchholz, points) and the match order of every swiss
 * and round robin container of a tournament.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { tournaments, stages, stageContainers, matches, groupEntries, entrants, teams } from "@gc-stats/db";
import { computeContainerStandings } from "@/lib/bracket/standings";
import { parseGroupConfig, type GroupContainerConfig } from "@/lib/bracket/config-types";
import { rejectGhost } from "../../v1/ghost";
import { resolveTournamentIdByName } from "../../v2/queries/tournaments";
import { getContainerRefs, getPhasesByIds, type ApiContainerPathItem, type ApiPhase } from "./phases";

export type ApiGroupTeamRef = { id: number; name: string; short_name: string | null; country_code: string | null };

export type ApiGroupParticipant = {
  entrant_id: number;
  name: string;
  team: ApiGroupTeamRef | null;
};

export type ApiGroupStanding = ApiGroupParticipant & {
  rank: number;
  seed: number | null;
  status: string | null;
  matches_won: number;
  matches_lost: number;
  map_wins: number;
  map_losses: number;
  map_diff: number;
  round_wins: number;
  round_losses: number;
  round_diff: number;
  buchholz: number;
  points: number | null;
};

export type ApiGroupMatch = {
  id: number;
  round_name: string | null;
  status: string;
  best_of: number;
  scheduled_at: string | null;
  team_a: ApiGroupParticipant | null;
  team_b: ApiGroupParticipant | null;
  score_a: number | null;
  score_b: number | null;
  winner_entrant_id: number | null;
  is_forfeit: boolean;
};

export type ApiGroupRound = { round: number; matches: ApiGroupMatch[] };

export type ApiGroupConfig = {
  qualify_at_wins: number | null;
  eliminate_at_losses: number | null;
  max_rounds: number | null;
  tiebreakers: string[];
  uses_points: boolean;
};

export type ApiGroup = {
  id: number;
  name: string;
  format: "swiss" | "round_robin";
  phase: ApiPhase | null;
  path: ApiContainerPathItem[];
  config: ApiGroupConfig;
  standings: ApiGroupStanding[];
  rounds: ApiGroupRound[];
};

export type ApiTournamentGroups = { tournament_id: number; groups: ApiGroup[] };

function toGroupConfig(config: GroupContainerConfig): ApiGroupConfig {
  return {
    qualify_at_wins: config.type === "swiss" ? config.qualifyAtWins : null,
    eliminate_at_losses: config.type === "swiss" ? config.eliminateAtLosses : null,
    max_rounds: config.type === "swiss" ? config.maxRounds : null,
    tiebreakers: config.tiebreakers,
    uses_points: config.pointsConfig !== null,
  };
}

function safeParseGroupConfig(raw: unknown): GroupContainerConfig | null {
  try {
    return parseGroupConfig(raw);
  } catch {
    return null;
  }
}

async function visibleTournamentExists(id: number): Promise<boolean> {
  const [row] = await db.select({ id: tournaments.id, isGhost: tournaments.isGhost }).from(tournaments).where(eq(tournaments.id, id)).limit(1);
  rejectGhost(row, "tournament");
  return !!row;
}

/**
 * Swiss and round robin containers of the tournament, in stage order, each
 * with its read time standings (same calculator as the public tournament
 * page) and its matches grouped by round in play order.
 */
export async function getTournamentGroupsV3(tournamentId: number, stageId?: number): Promise<ApiTournamentGroups | null> {
  if (!(await visibleTournamentExists(tournamentId))) return null;

  if (stageId) {
    const [stage] = await db.select({ id: stages.id }).from(stages).where(and(eq(stages.id, stageId), eq(stages.tournamentId, tournamentId))).limit(1);
    if (!stage) return null;
  }

  const conditions = [eq(stages.tournamentId, tournamentId), eq(stageContainers.containerType, "group")];
  if (stageId) conditions.push(eq(stages.id, stageId));

  const containerRows = await db
    .select({ id: stageContainers.id, name: stageContainers.name, config: stageContainers.config, stageId: stages.id })
    .from(stageContainers)
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(and(...conditions))
    .orderBy(asc(stages.sequenceOrder), asc(stageContainers.displayOrder), asc(stageContainers.id));

  const containers = containerRows.flatMap((row) => {
    const config = safeParseGroupConfig(row.config);
    if (!config) console.error("[api v3 groups] unreadable group config (container #%d)", row.id);
    return config ? [{ ...row, parsedConfig: config }] : [];
  });
  if (containers.length === 0) return { tournament_id: tournamentId, groups: [] };

  const containerIds = containers.map((c) => c.id);
  const [matchRows, entryRows, standingsByContainer, phases, containerRefs] = await Promise.all([
    db.select().from(matches).where(inArray(matches.containerId, containerIds)).orderBy(asc(matches.round), asc(matches.displayOrder), asc(matches.id)),
    db.select({ containerId: groupEntries.containerId, entrantId: groupEntries.entrantId, status: groupEntries.status }).from(groupEntries).where(inArray(groupEntries.containerId, containerIds)),
    Promise.all(containers.map(async (c) => [c.id, await computeContainerStandings(db, c.id, c.config)] as const)),
    getPhasesByIds(containers.map((c) => c.stageId)),
    getContainerRefs(containerIds),
  ]);
  const standingsById = new Map(standingsByContainer);
  const statusByEntry = new Map(entryRows.map((e) => [`${e.containerId}:${e.entrantId}`, e.status]));

  const entrantIds = new Set<number>();
  for (const standings of standingsById.values()) for (const s of standings) entrantIds.add(Number(s.id));
  for (const m of matchRows) {
    if (m.entrantAId != null) entrantIds.add(m.entrantAId);
    if (m.entrantBId != null) entrantIds.add(m.entrantBId);
  }

  const entrantRows = entrantIds.size
    ? await db
        .select({ id: entrants.id, displayName: entrants.displayName, teamId: teams.id, teamName: teams.name, shortName: teams.shortName, countryCode: teams.countryCode })
        .from(entrants)
        .leftJoin(teams, eq(teams.id, entrants.teamId))
        .where(inArray(entrants.id, [...entrantIds]))
    : [];
  const participantById = new Map<number, ApiGroupParticipant>(
    entrantRows.map((e) => [
      e.id,
      {
        entrant_id: e.id,
        name: e.teamName ?? e.displayName,
        team: e.teamId != null ? { id: e.teamId, name: e.teamName ?? e.displayName, short_name: e.shortName, country_code: e.countryCode } : null,
      },
    ]),
  );
  const participantOf = (entrantId: number): ApiGroupParticipant | null => participantById.get(entrantId) ?? null;

  const matchesByContainer = new Map<number, typeof matchRows>();
  for (const m of matchRows) {
    const list = matchesByContainer.get(m.containerId) ?? [];
    list.push(m);
    matchesByContainer.set(m.containerId, list);
  }

  const groups: ApiGroup[] = containers.map((c) => {
    const standings: ApiGroupStanding[] = (standingsById.get(c.id) ?? []).flatMap((s) => {
      const entrantId = Number(s.id);
      const participant = participantOf(entrantId);
      if (!participant) return [];
      return [{
        ...participant,
        rank: s.rank,
        seed: s.seed > 0 ? s.seed : null,
        status: statusByEntry.get(`${c.id}:${entrantId}`) ?? null,
        matches_won: s.wins,
        matches_lost: s.losses,
        map_wins: s.mapWins,
        map_losses: s.mapLosses,
        map_diff: s.mapWins - s.mapLosses,
        round_wins: s.roundWins,
        round_losses: s.roundLosses,
        round_diff: s.roundWins - s.roundLosses,
        // Stored in hundredths.
        buchholz: s.buchholz / 100,
        points: c.parsedConfig.pointsConfig ? (s.points ?? 0) : null,
      }];
    });

    const rounds: ApiGroupRound[] = [];
    for (const m of matchesByContainer.get(c.id) ?? []) {
      let round = rounds[rounds.length - 1];
      if (!round || round.round !== m.round) {
        round = { round: m.round, matches: [] };
        rounds.push(round);
      }
      round.matches.push({
        id: m.id,
        round_name: m.label,
        status: m.status,
        best_of: m.bestOf,
        scheduled_at: m.scheduledAt ? m.scheduledAt.toISOString() : null,
        team_a: m.entrantAId != null ? participantOf(m.entrantAId) : null,
        team_b: m.entrantBId != null ? participantOf(m.entrantBId) : null,
        score_a: m.scoreA,
        score_b: m.scoreB,
        winner_entrant_id: m.winnerId,
        is_forfeit: m.isForfeit,
      });
    }

    return {
      id: c.id,
      name: c.name,
      format: c.parsedConfig.type,
      phase: phases.get(c.stageId) ?? null,
      path: containerRefs.get(c.id)?.path ?? [],
      config: toGroupConfig(c.parsedConfig),
      standings,
      rounds,
    };
  });

  return { tournament_id: tournamentId, groups };
}

export async function getTournamentGroupsByNameV3(name: string, stageId?: number): Promise<ApiTournamentGroups | null> {
  const tournamentId = await resolveTournamentIdByName(name);
  return tournamentId === null ? null : getTournamentGroupsV3(tournamentId, stageId);
}
