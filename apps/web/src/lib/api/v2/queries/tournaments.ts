/**
 * GC-Stats - tournaments
 *
 * Query helpers for the API v2 tournament endpoints: entrants, matches, maps
 * and stats scoped to a tournament, extending the v1 tournament queries.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import { tournaments, entrants, entrantMembers, people, teams, matches, maps, mapPlayerStats, mapTeamRoundSummary, mapRoundsRaw, mapRoundPlayerLoadoutsRaw, stageContainers, stages } from "@gc-stats/db";
import { escapeLike, exclusiveUpperBound } from "../../v1/params";
import { qualifiedColumn } from "@/lib/db-search";
import { getThemedLogoUrls, getThemedLogoUrlsBatch, type ApiThemedLogoUrls } from "../../v1/logo-response";
import { buildPhasesByTournamentWithLiquipedia } from "../../v1/queries/tournaments";
import { toApiTeamFromJoined } from "../../v1/entities";
import { buildVetosByMatch } from "../../v1/queries/match-vetos";
import { sideWinrate, type ApiSideWinrate, type ApiCompEntry, type ApiTeamMatchEntry, type ApiPaginatedTeamMatches, type ApiEcoBreakdown } from "../../v1/queries/teams";
import { ECO_TIERS, loadoutTierFor, type EcoTierKey } from "@/lib/eco-tiers";
import type { TournamentMatchesFilter, TournamentMapsFilter, TournamentStatsFilter, TournamentsListFilter } from "../params";
import { toApiTournamentV2, type ApiTournamentV2, type ApiTournamentPhaseV2 } from "../entities";
import { visibleTournament } from "@/lib/ghost-visibility";
import { rejectGhost } from "@/lib/api/v1/ghost";

export type ApiEntrantRosterPlayer = { person_id: number; handle: string };

export type ApiTournamentEntrant = {
  entrant_id: number;
  team_id: number | null;
  display_name: string;
  short_name: string | null;
  seed: number | null;
  logos: ApiThemedLogoUrls;
  roster: ApiEntrantRosterPlayer[];
};

/**
 * Every entrant ever registered for the tournament (not scoped to a stage —
 * mirrors the public tournament page's "all entrants" behaviour, see
 * `getTournamentParticipants`, `lib/tournament-page-data.ts`).
 *
 * Roster is the locked-for-this-tournament one (`entrant_members`,
 * `is_starter = true`), never the team's ongoing roster — falls back to
 * players with recorded stats for the entrant (`map_player_stats`) for
 * tournaments migrated from V1, which never populated `entrant_members`.
 */
async function getTournamentEntrantsV2(tournamentId: number): Promise<ApiTournamentEntrant[]> {
  const entrantRows = await db
    .select({ id: entrants.id, teamId: entrants.teamId, displayName: entrants.displayName, seed: entrants.seed, shortName: teams.shortName })
    .from(entrants)
    .leftJoin(teams, eq(teams.id, entrants.teamId))
    .where(eq(entrants.tournamentId, tournamentId))
    .orderBy(sql`${entrants.seed} nulls last`, entrants.id);

  if (entrantRows.length === 0) return [];

  const entrantIds = entrantRows.map((e) => e.id);
  const teamIds = [...new Set(entrantRows.map((e) => e.teamId).filter((id): id is number => id != null))];
  const logosByTeamId = await getThemedLogoUrlsBatch("team", teamIds);

  const lockedRows = await db
    .select({ entrantId: entrantMembers.entrantId, personId: people.id, handle: people.handle })
    .from(entrantMembers)
    .innerJoin(people, eq(people.id, entrantMembers.personId))
    .where(and(inArray(entrantMembers.entrantId, entrantIds), eq(entrantMembers.isStarter, true)))
    .orderBy(people.handle);

  const entrantIdsWithLockedRoster = new Set(lockedRows.map((r) => r.entrantId));
  const fallbackEntrantIds = entrantIds.filter((id) => !entrantIdsWithLockedRoster.has(id));

  const fallbackRows = fallbackEntrantIds.length
    ? await db
        .selectDistinct({ entrantId: mapPlayerStats.entrantId, personId: people.id, handle: people.handle })
        .from(mapPlayerStats)
        .innerJoin(people, eq(people.id, mapPlayerStats.personId))
        .where(inArray(mapPlayerStats.entrantId, fallbackEntrantIds))
        .orderBy(people.handle)
    : [];

  const rosterByEntrant = new Map<number, ApiEntrantRosterPlayer[]>();
  for (const r of [...lockedRows, ...fallbackRows]) {
    if (!rosterByEntrant.has(r.entrantId)) rosterByEntrant.set(r.entrantId, []);
    rosterByEntrant.get(r.entrantId)!.push({ person_id: r.personId, handle: r.handle });
  }

  const emptyLogos: ApiThemedLogoUrls = { dark: null, light: null };

  return entrantRows.map((e) => ({
    entrant_id: e.id,
    team_id: e.teamId,
    display_name: e.displayName,
    short_name: e.shortName,
    seed: e.seed,
    logos: e.teamId ? (logosByTeamId.get(e.teamId) ?? emptyLogos) : emptyLogos,
    roster: rosterByEntrant.get(e.id) ?? [],
  }));
}

export type ApiTournamentFullResponseV2 = ApiTournamentV2 & {
  phases: ApiTournamentPhaseV2[];
  logos: ApiThemedLogoUrls;
  entrants: ApiTournamentEntrant[];
};

async function buildTournamentFullResponse(row: typeof tournaments.$inferSelect): Promise<ApiTournamentFullResponseV2> {
  const [phasesByTournament, logos, tournamentEntrants] = await Promise.all([
    buildPhasesByTournamentWithLiquipedia([row.id]),
    getThemedLogoUrls("tournament", row.id),
    getTournamentEntrantsV2(row.id),
  ]);

  return {
    ...toApiTournamentV2(row),
    phases: phasesByTournament.get(row.id) ?? [],
    logos,
    entrants: tournamentEntrants,
  };
}

export async function getTournamentByIdV2(id: number): Promise<ApiTournamentFullResponseV2 | null> {
  const [row] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  rejectGhost(row, "tournament");
  if (!row) return null;
  return buildTournamentFullResponse(row);
}

export async function searchTournamentsByNameV2(query: string): Promise<ApiTournamentFullResponseV2[]> {
  const pattern = `${escapeLike(query)}%`;
  const rows = await db.select().from(tournaments).where(and(ilike(tournaments.name, pattern), visibleTournament)).orderBy(asc(tournaments.name)).limit(20);

  return Promise.all(rows.map(buildTournamentFullResponse));
}

async function tournamentExists(id: number): Promise<boolean> {
  const [row] = await db.select({ id: tournaments.id, isGhost: tournaments.isGhost }).from(tournaments).where(eq(tournaments.id, id)).limit(1);
  rejectGhost(row, "tournament");
  return !!row;
}

/** First tournament (by name asc, same order as the search endpoint) whose name starts with the given string — the sub endpoints (matches/maps/stats) resolve a single tournament, unlike the top level `by-name` which returns every match. */
async function resolveTournamentIdByName(query: string): Promise<number | null> {
  const pattern = `${escapeLike(query)}%`;
  const [row] = await db.select({ id: tournaments.id }).from(tournaments).where(and(ilike(tournaments.name, pattern), visibleTournament)).orderBy(asc(tournaments.name)).limit(1);
  return row?.id ?? null;
}

async function getTournamentTeamEntrantIds(tournamentId: number, teamId: number): Promise<number[]> {
  const rows = await db
    .select({ id: entrants.id })
    .from(entrants)
    .where(and(eq(entrants.tournamentId, tournamentId), eq(entrants.teamId, teamId)));
  return rows.map((r) => r.id);
}

function tournamentDateConditions(filter: { from?: string; to?: string }) {
  const conditions = [];
  if (filter.from) conditions.push(gte(matches.scheduledAt, new Date(`${filter.from}T00:00:00.000Z`)));
  if (filter.to) conditions.push(lt(matches.scheduledAt, exclusiveUpperBound(filter.to)));
  return conditions;
}

const matchEntrantAAlias = alias(entrants, "tourn_match_entrant_a");
const matchEntrantBAlias = alias(entrants, "tourn_match_entrant_b");
const matchTeamAAlias = alias(teams, "tourn_match_team_a");
const matchTeamBAlias = alias(teams, "tourn_match_team_b");

/** Every match of the tournament, most recent first, with its vetoes — the `getTeamMatches` shape (`../../v1/queries/teams.ts`) scoped to a whole tournament instead of one team, plus round name/team filtering. */
export async function getTournamentMatchesV2(tournamentId: number, filter: TournamentMatchesFilter): Promise<ApiPaginatedTeamMatches | null> {
  if (!(await tournamentExists(tournamentId))) return null;

  const conditions = [eq(stages.tournamentId, tournamentId), ...tournamentDateConditions(filter)];
  if (filter.status) conditions.push(eq(matches.status, filter.status as "pending" | "live" | "completed"));
  if (filter.roundName) conditions.push(eq(matches.label, filter.roundName));
  if (filter.stageId) conditions.push(eq(stages.id, filter.stageId));

  if (filter.teamId) {
    const entrantIds = await getTournamentTeamEntrantIds(tournamentId, filter.teamId);
    conditions.push(entrantIds.length > 0 ? (or(inArray(matches.entrantAId, entrantIds), inArray(matches.entrantBId, entrantIds)) ?? sql`false`) : sql`false`);
  }

  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(and(...conditions));

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
      teamA: matchTeamAAlias,
      teamB: matchTeamBAlias,
    })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .leftJoin(matchEntrantAAlias, eq(matchEntrantAAlias.id, matches.entrantAId))
    .leftJoin(matchTeamAAlias, eq(matchTeamAAlias.id, matchEntrantAAlias.teamId))
    .leftJoin(matchEntrantBAlias, eq(matchEntrantBAlias.id, matches.entrantBId))
    .leftJoin(matchTeamBAlias, eq(matchTeamBAlias.id, matchEntrantBAlias.teamId))
    .where(and(...conditions))
    .orderBy(desc(matches.scheduledAt), desc(matches.id))
    .limit(filter.perPage)
    .offset((filter.page - 1) * filter.perPage);

  const matchIds = rows.map((r) => r.id);
  const vetosByMatch = await buildVetosByMatch(matchIds);

  const data: ApiTeamMatchEntry[] = rows.map((row) => {
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

export async function getTournamentMatchesByNameV2(name: string, filter: TournamentMatchesFilter): Promise<ApiPaginatedTeamMatches | null> {
  const tournamentId = await resolveTournamentIdByName(name);
  if (tournamentId === null) return null;
  return getTournamentMatchesV2(tournamentId, filter);
}

export type ApiTournamentMapCompEntry = { comp: string[]; times_played: number };
export type ApiTournamentTeamMapStats = { wins: number; losses: number; winrate: number; atk: ApiSideWinrate; def: ApiSideWinrate; eco: ApiEcoBreakdown; comps: ApiCompEntry[] };
export type ApiTournamentMapEntry = { map_name: string; times_played: number; comps: ApiTournamentMapCompEntry[]; team_stats: ApiTournamentTeamMapStats | null };

/**
 * Map pool for the whole tournament (times played + comps seen, both sides,
 * no "our" perspective) — unless `team_id` is given, in which case matches
 * are restricted to that team's and `team_stats` mirrors `getTeamMaps`
 * (`../../v1/queries/teams.ts`): winrate, atk/def split, comps from that
 * team's side only.
 */
export async function getTournamentMapsV2(tournamentId: number, filter: TournamentMapsFilter): Promise<ApiTournamentMapEntry[] | null> {
  if (!(await tournamentExists(tournamentId))) return null;

  const teamEntrantIds = filter.teamId ? await getTournamentTeamEntrantIds(tournamentId, filter.teamId) : null;
  if (teamEntrantIds && teamEntrantIds.length === 0) return [];

  const conditions = [eq(stages.tournamentId, tournamentId), eq(maps.isCompleted, true), ...tournamentDateConditions(filter)];
  if (filter.roundName) conditions.push(eq(matches.label, filter.roundName));
  if (filter.stageId) conditions.push(eq(stages.id, filter.stageId));
  if (teamEntrantIds) conditions.push(or(inArray(matches.entrantAId, teamEntrantIds), inArray(matches.entrantBId, teamEntrantIds)) ?? sql`false`);

  const mapRows = await db
    .select({ mapId: maps.id, mapName: maps.mapName, teamAScore: maps.teamAScore, teamBScore: maps.teamBScore, entrantAId: matches.entrantAId, entrantBId: matches.entrantBId })
    .from(maps)
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(and(...conditions));

  if (mapRows.length === 0) return [];
  const mapIds = mapRows.map((r) => r.mapId);

  const [compRows, sideRows, rounds] = await Promise.all([
    db.select({ mapId: mapPlayerStats.mapId, entrantId: mapPlayerStats.entrantId, agentName: mapPlayerStats.agentName }).from(mapPlayerStats).where(inArray(mapPlayerStats.mapId, mapIds)),
    teamEntrantIds
      ? db
          .select({ mapId: mapTeamRoundSummary.mapId, side: mapTeamRoundSummary.side, roundsPlayed: mapTeamRoundSummary.roundsPlayed, roundsWon: mapTeamRoundSummary.roundsWon })
          .from(mapTeamRoundSummary)
          .where(and(inArray(mapTeamRoundSummary.mapId, mapIds), inArray(mapTeamRoundSummary.entrantId, teamEntrantIds)))
      : Promise.resolve([]),
    teamEntrantIds ? db.select({ id: mapRoundsRaw.id, mapId: mapRoundsRaw.mapId, winningEntrantId: mapRoundsRaw.winningEntrantId }).from(mapRoundsRaw).where(inArray(mapRoundsRaw.mapId, mapIds)) : Promise.resolve([]),
  ]);

  const roundIds = rounds.map((r) => r.id);
  const loadouts = roundIds.length
    ? await db
        .select({ mapRoundId: mapRoundPlayerLoadoutsRaw.mapRoundId, entrantId: mapRoundPlayerLoadoutsRaw.entrantId, loadoutValue: mapRoundPlayerLoadoutsRaw.loadoutValue })
        .from(mapRoundPlayerLoadoutsRaw)
        .where(inArray(mapRoundPlayerLoadoutsRaw.mapRoundId, roundIds))
    : [];
  const spentByRoundEntrant = new Map<string, number>();
  for (const l of loadouts) {
    if (l.entrantId == null || l.loadoutValue == null) continue;
    const key = `${l.mapRoundId}:${l.entrantId}`;
    spentByRoundEntrant.set(key, (spentByRoundEntrant.get(key) ?? 0) + l.loadoutValue);
  }
  const roundsByMapId = new Map<number, typeof rounds>();
  for (const r of rounds) roundsByMapId.set(r.mapId, [...(roundsByMapId.get(r.mapId) ?? []), r]);

  const compByMapEntrant = new Map<string, string[]>();
  for (const row of compRows) {
    if (!row.agentName) continue;
    const key = `${row.mapId}:${row.entrantId}`;
    const list = compByMapEntrant.get(key) ?? [];
    if (!list.includes(row.agentName)) list.push(row.agentName);
    compByMapEntrant.set(key, list);
  }
  for (const [key, list] of compByMapEntrant) compByMapEntrant.set(key, [...list].sort());

  const sideByMapId = new Map<number, { atkPlayed: number; atkWon: number; defPlayed: number; defWon: number }>();
  for (const row of sideRows) {
    const entry = sideByMapId.get(row.mapId) ?? { atkPlayed: 0, atkWon: 0, defPlayed: 0, defWon: 0 };
    if (row.side === "atk") {
      entry.atkPlayed += row.roundsPlayed;
      entry.atkWon += row.roundsWon;
    } else {
      entry.defPlayed += row.roundsPlayed;
      entry.defWon += row.roundsWon;
    }
    sideByMapId.set(row.mapId, entry);
  }

  type TeamCompAgg = { timesPlayed: number; wins: number; atkPlayed: number; atkWon: number; defPlayed: number; defWon: number };
  type EcoTally = Record<EcoTierKey, { played: number; won: number }>;
  const emptyEcoTally = (): EcoTally => Object.fromEntries(ECO_TIERS.map((t) => [t.key, { played: 0, won: 0 }])) as EcoTally;
  type MapAgg = {
    mapName: string;
    timesPlayed: number;
    comps: Map<string, number>;
    wins: number;
    atkPlayed: number;
    atkWon: number;
    defPlayed: number;
    defWon: number;
    eco: EcoTally;
    teamComps: Map<string, TeamCompAgg>;
  };

  const byMapName = new Map<string, MapAgg>();
  for (const row of mapRows) {
    const mapName = row.mapName ?? "";
    const agg = byMapName.get(mapName) ?? { mapName, timesPlayed: 0, comps: new Map(), wins: 0, atkPlayed: 0, atkWon: 0, defPlayed: 0, defWon: 0, eco: emptyEcoTally(), teamComps: new Map() };
    agg.timesPlayed += 1;

    for (const entrantId of [row.entrantAId, row.entrantBId]) {
      if (entrantId == null) continue;
      const comp = compByMapEntrant.get(`${row.mapId}:${entrantId}`);
      if (comp && comp.length > 0) {
        const key = comp.join(",");
        agg.comps.set(key, (agg.comps.get(key) ?? 0) + 1);
      }
    }

    if (teamEntrantIds) {
      const isEntrantA = row.entrantAId != null && teamEntrantIds.includes(row.entrantAId);
      const ourEntrantId = isEntrantA ? row.entrantAId : row.entrantBId;
      const ourScore = isEntrantA ? row.teamAScore : row.teamBScore;
      const oppScore = isEntrantA ? row.teamBScore : row.teamAScore;
      const won = ourScore != null && oppScore != null && ourScore > oppScore;
      if (won) agg.wins += 1;

      const side = sideByMapId.get(row.mapId) ?? { atkPlayed: 0, atkWon: 0, defPlayed: 0, defWon: 0 };
      agg.atkPlayed += side.atkPlayed;
      agg.atkWon += side.atkWon;
      agg.defPlayed += side.defPlayed;
      agg.defWon += side.defWon;

      if (ourEntrantId != null) {
        for (const round of roundsByMapId.get(row.mapId) ?? []) {
          const spent = spentByRoundEntrant.get(`${round.id}:${ourEntrantId}`) ?? 0;
          const tier = loadoutTierFor(spent);
          if (!tier) continue;
          agg.eco[tier].played++;
          if (round.winningEntrantId === ourEntrantId) agg.eco[tier].won++;
        }
      }

      const ourComp = ourEntrantId != null ? compByMapEntrant.get(`${row.mapId}:${ourEntrantId}`) : undefined;
      if (ourComp && ourComp.length > 0) {
        const key = ourComp.join(",");
        const c = agg.teamComps.get(key) ?? { timesPlayed: 0, wins: 0, atkPlayed: 0, atkWon: 0, defPlayed: 0, defWon: 0 };
        c.timesPlayed += 1;
        if (won) c.wins += 1;
        c.atkPlayed += side.atkPlayed;
        c.atkWon += side.atkWon;
        c.defPlayed += side.defPlayed;
        c.defWon += side.defWon;
        agg.teamComps.set(key, c);
      }
    }

    byMapName.set(mapName, agg);
  }

  return [...byMapName.values()]
    .map(
      (agg): ApiTournamentMapEntry => ({
        map_name: agg.mapName,
        times_played: agg.timesPlayed,
        comps: [...agg.comps.entries()]
          .map(([key, timesPlayed]) => ({ comp: key.split(","), times_played: timesPlayed }))
          .sort((a, b) => b.times_played - a.times_played),
        team_stats: teamEntrantIds
          ? {
              wins: agg.wins,
              losses: agg.timesPlayed - agg.wins,
              winrate: agg.timesPlayed > 0 ? agg.wins / agg.timesPlayed : 0,
              atk: sideWinrate(agg.atkPlayed, agg.atkWon),
              def: sideWinrate(agg.defPlayed, agg.defWon),
              eco: Object.fromEntries(ECO_TIERS.map((t) => [t.key, sideWinrate(agg.eco[t.key].played, agg.eco[t.key].won)])) as ApiEcoBreakdown,
              comps: [...agg.teamComps.entries()]
                .map(([key, c]) => ({
                  comp: key.split(","),
                  times_played: c.timesPlayed,
                  wins: c.wins,
                  losses: c.timesPlayed - c.wins,
                  winrate: c.timesPlayed > 0 ? c.wins / c.timesPlayed : 0,
                  atk: sideWinrate(c.atkPlayed, c.atkWon),
                  def: sideWinrate(c.defPlayed, c.defWon),
                }))
                .sort((a, b) => b.times_played - a.times_played),
            }
          : null,
      }),
    )
    .sort((a, b) => b.times_played - a.times_played);
}

export async function getTournamentMapsByNameV2(name: string, filter: TournamentMapsFilter): Promise<ApiTournamentMapEntry[] | null> {
  const tournamentId = await resolveTournamentIdByName(name);
  if (tournamentId === null) return null;
  return getTournamentMapsV2(tournamentId, filter);
}

export type ApiTournamentStatsEntry = {
  person_id: number;
  handle: string;
  nationality: string | null;
  team_id: number | null;
  team_name: string | null;
  agents: string[];
  maps_played: number;
  total_kills: number;
  avg_kills: number;
  total_deaths: number;
  avg_deaths: number;
  total_assists: number;
  avg_assists: number;
  total_acs: number;
  avg_acs: number;
  total_adr: number;
  avg_adr: number;
  total_kast_percentage: number;
  avg_kast_percentage: number;
  total_headshot_percentage: number;
  avg_headshot_percentage: number;
  total_first_kills: number;
  avg_first_kills: number;
  total_first_deaths: number;
  avg_first_deaths: number;
  kd_ratio: number;
};

const statsEntrantAlias = alias(entrants, "stats_entrant");

type TournamentStatRow = {
  personId: number | null;
  entrantId: number;
  teamId: number | null;
  teamName: string;
  handle: string;
  countryCode: string | null;
  agentName: string | null;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  adr: number;
  kastPercentage: string;
  headshotPercentage: string;
  firstKills: number;
  firstDeaths: number;
};

/**
 * Per player, every map they played in the tournament, aggregated into one
 * row per person (same principle as the public tournament stats page,
 * `tournamentStatsScope` + `aggregateMapPlayerStatsSql` in
 * `lib/tournament-page-data.ts` / `lib/stats-aggregate-sql.ts`, reimplemented
 * here with identity columns inlined so filtering by team/role/nationality
 * doesn't need a second query). A player who appeared under two entrants
 * (mid tournament roster swap) is attributed to whichever one they have the
 * most map rows for, same rule as the site's `getTournamentStatsPlayerMeta`.
 */
export async function getTournamentStatsV2(tournamentId: number, filter: TournamentStatsFilter): Promise<ApiTournamentStatsEntry[] | null> {
  if (!(await tournamentExists(tournamentId))) return null;

  const conditions = [eq(stages.tournamentId, tournamentId), ...tournamentDateConditions(filter)];
  if (filter.roundName) conditions.push(eq(matches.label, filter.roundName));
  if (filter.stageId) conditions.push(eq(stages.id, filter.stageId));
  if (filter.teamId) conditions.push(eq(statsEntrantAlias.teamId, filter.teamId));
  if (filter.agent) conditions.push(eq(mapPlayerStats.agentName, filter.agent));
  if (filter.nationality) conditions.push(eq(people.countryCode, filter.nationality));
  if (filter.role) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM roster_memberships rm WHERE rm.person_id = ${mapPlayerStats.personId} AND rm.team_id = ${statsEntrantAlias.teamId} AND rm.role = ${filter.role} AND rm.period @> COALESCE(${maps.startedAt}, ${matches.scheduledAt})::date)`,
    );
  }

  const rows: TournamentStatRow[] = await db
    .select({
      personId: mapPlayerStats.personId,
      entrantId: mapPlayerStats.entrantId,
      teamId: statsEntrantAlias.teamId,
      teamName: statsEntrantAlias.displayName,
      handle: people.handle,
      countryCode: people.countryCode,
      agentName: mapPlayerStats.agentName,
      kills: mapPlayerStats.kills,
      deaths: mapPlayerStats.deaths,
      assists: mapPlayerStats.assists,
      acs: mapPlayerStats.acs,
      adr: mapPlayerStats.adr,
      kastPercentage: mapPlayerStats.kastPercentage,
      headshotPercentage: mapPlayerStats.headshotPercentage,
      firstKills: mapPlayerStats.firstKills,
      firstDeaths: mapPlayerStats.firstDeaths,
    })
    .from(mapPlayerStats)
    .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(statsEntrantAlias, eq(statsEntrantAlias.id, mapPlayerStats.entrantId))
    .innerJoin(people, eq(people.id, mapPlayerStats.personId))
    .where(and(...conditions));

  type PersonAgg = {
    handle: string;
    countryCode: string | null;
    agents: Set<string>;
    entrantCounts: Map<number, number>;
    teamByEntrant: Map<number, { teamId: number | null; teamName: string | null }>;
    mapsPlayed: number;
    kills: number;
    deaths: number;
    assists: number;
    acs: number;
    adr: number;
    kast: number;
    hs: number;
    fk: number;
    fd: number;
  };

  const groups = new Map<number, PersonAgg>();
  for (const r of rows) {
    if (r.personId == null) continue;
    let g = groups.get(r.personId);
    if (!g) {
      g = { handle: r.handle, countryCode: r.countryCode, agents: new Set(), entrantCounts: new Map(), teamByEntrant: new Map(), mapsPlayed: 0, kills: 0, deaths: 0, assists: 0, acs: 0, adr: 0, kast: 0, hs: 0, fk: 0, fd: 0 };
      groups.set(r.personId, g);
    }
    g.mapsPlayed += 1;
    g.kills += r.kills;
    g.deaths += r.deaths;
    g.assists += r.assists;
    g.acs += r.acs;
    g.adr += r.adr;
    g.kast += Number(r.kastPercentage) || 0;
    g.hs += Number(r.headshotPercentage) || 0;
    g.fk += r.firstKills;
    g.fd += r.firstDeaths;
    if (r.agentName) g.agents.add(r.agentName);
    g.entrantCounts.set(r.entrantId, (g.entrantCounts.get(r.entrantId) ?? 0) + 1);
    g.teamByEntrant.set(r.entrantId, { teamId: r.teamId, teamName: r.teamName });
  }

  const entries: ApiTournamentStatsEntry[] = [];
  for (const [personId, g] of groups) {
    let dominantEntrant = -1;
    let bestCount = -1;
    for (const [entrantId, count] of g.entrantCounts) {
      if (count > bestCount) {
        bestCount = count;
        dominantEntrant = entrantId;
      }
    }
    const team = g.teamByEntrant.get(dominantEntrant) ?? { teamId: null, teamName: null };

    const avg = (total: number) => (g.mapsPlayed > 0 ? total / g.mapsPlayed : 0);
    const avgKills = avg(g.kills);
    const avgDeaths = avg(g.deaths);

    entries.push({
      person_id: personId,
      handle: g.handle,
      nationality: g.countryCode,
      team_id: team.teamId,
      team_name: team.teamName,
      agents: [...g.agents].sort(),
      maps_played: g.mapsPlayed,
      total_kills: g.kills,
      avg_kills: avgKills,
      total_deaths: g.deaths,
      avg_deaths: avgDeaths,
      total_assists: g.assists,
      avg_assists: avg(g.assists),
      total_acs: g.acs,
      avg_acs: avg(g.acs),
      total_adr: g.adr,
      avg_adr: avg(g.adr),
      total_kast_percentage: g.kast,
      avg_kast_percentage: avg(g.kast),
      total_headshot_percentage: g.hs,
      avg_headshot_percentage: avg(g.hs),
      total_first_kills: g.fk,
      avg_first_kills: avg(g.fk),
      total_first_deaths: g.fd,
      avg_first_deaths: avg(g.fd),
      kd_ratio: avgDeaths > 0 ? avgKills / avgDeaths : avgKills,
    });
  }

  return entries.sort((a, b) => b.avg_acs - a.avg_acs || a.handle.localeCompare(b.handle));
}

export async function getTournamentStatsByNameV2(name: string, filter: TournamentStatsFilter): Promise<ApiTournamentStatsEntry[] | null> {
  const tournamentId = await resolveTournamentIdByName(name);
  if (tournamentId === null) return null;
  return getTournamentStatsV2(tournamentId, filter);
}

export type ApiTournamentListEntry = ApiTournamentV2 & { logos: ApiThemedLogoUrls; teams_count: number };
export type ApiPaginatedTournaments = { page: number; per_page: number; total: number; total_pages: number; data: ApiTournamentListEntry[] };

const listTeamsCountSql = sql<number>`(
  SELECT COUNT(*)::int FROM ${entrants} e
  WHERE e.tournament_id = ${qualifiedColumn(tournaments, "id")} AND e.kind = 'team'
)`;

/**
 * Global tournament listing (`/v2/tournaments`) — same region/category/year
 * vocabulary as the public `/tournaments` page (`lib/tournament-list-data.ts`),
 * `active` left optional so a consumer can also list past/inactive tournaments
 * the public page always hides.
 */
export async function listTournamentsV2(filter: TournamentsListFilter): Promise<ApiPaginatedTournaments> {
  const conditions = [];
  if (filter.region) conditions.push(eq(tournaments.region, filter.region));
  if (filter.category) conditions.push(eq(tournaments.category, filter.category));
  if (filter.year) conditions.push(sql`EXTRACT(YEAR FROM ${tournaments.startDate}) = ${filter.year}`);
  if (filter.active !== undefined) conditions.push(eq(tournaments.active, filter.active));
  const where = conditions.length ? and(...conditions) : undefined;

  const orderCol = filter.sort === "name" ? tournaments.name : tournaments.startDate;
  const orderFn = filter.direction === "desc" ? desc : asc;

  const [countRow, rows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(tournaments).where(and(where, visibleTournament)),
    db
      .select({ tournament: tournaments, teamsCount: listTeamsCountSql })
      .from(tournaments)
      .where(and(where, visibleTournament))
      .orderBy(orderFn(orderCol))
      .limit(filter.perPage)
      .offset((filter.page - 1) * filter.perPage),
  ]);

  const total = Number(countRow[0]?.total ?? 0);
  const totalPages = total > 0 ? Math.ceil(total / filter.perPage) : 0;
  const logosByTournamentId = await getThemedLogoUrlsBatch("tournament", rows.map((r) => r.tournament.id));

  return {
    page: filter.page,
    per_page: filter.perPage,
    total,
    total_pages: totalPages,
    data: rows.map((r) => ({
      ...toApiTournamentV2(r.tournament),
      logos: logosByTournamentId.get(r.tournament.id) ?? { dark: null, light: null },
      teams_count: r.teamsCount,
    })),
  };
}
