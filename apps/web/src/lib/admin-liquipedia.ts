/**
 * GC-Stats - admin-liquipedia
 *
 * Admin queries for the tournament Liquipedia page: each stage's teams with
 * their current Liquipedia name (if any) and every name they are known under.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, eq, inArray, isNotNull, notInArray, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { rosterPeriodIsDated } from "@/lib/roster-sql";
import type { PersonPickerResult } from "@/lib/person-search";
import { groupBracketContainers } from "@/lib/bracket-group-containers";
import { entrants, entrantMembers, mapPlayerStats, rosterMemberships, tournaments, people, stages, stageContainers, matches, groupEntries, teams, teamNameHistory, liquipediaTeamNames, liquipediaPersonNames, productionCredits } from "@gc-stats/db";

// Roster roles of people who play; every other role is staff.
export const PLAYER_ROLES = ["player", "player-igl", "sub", "stand_in"];

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

export type LiquipediaTournamentPerson = {
  personId: number;
  handle: string;
  /** Team the person plays or works for in this tournament. */
  teamName: string;
  /** Entrant the person appears under in this tournament, null for broadcast talent. */
  entrantId: number | null;
  kind: "player" | "staff";
  /** Exact roster role: player, stand_in, coach, manager, ... */
  role: string;
  countryCode: string | null;
  liquipediaLink: string | null;
  /** Handle, aliases and real name, used for matching. */
  names: string[];
  liquipediaName: string | null;
};

/**
 * Everyone of a tournament's teams (players and staff), with their current Liquipedia name.
 * Same sources as the public page: the locked roster, else the players with recorded stats,
 * plus the staff the team had during the tournament dates and the people credited on the tournament.
 */
export async function getTournamentLiquipediaPeople(tournamentId: number): Promise<LiquipediaTournamentPerson[]> {
  const [tournament] = await db.select({ startDate: tournaments.startDate, endDate: tournaments.endDate }).from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!tournament) return [];

  const entrantRows = await db
    .select({ id: entrants.id, teamId: entrants.teamId, displayName: entrants.displayName })
    .from(entrants)
    .where(eq(entrants.tournamentId, tournamentId));
  const entrantIds = entrantRows.map((e) => e.id);
  const teamIds = [...new Set(entrantRows.map((e) => e.teamId).filter((id): id is number => id !== null))];

  const [memberRows, statRows, staffRows, creditRows] = await Promise.all([
    entrantIds.length ? db.select({ entrantId: entrantMembers.entrantId, personId: entrantMembers.personId, role: entrantMembers.role }).from(entrantMembers).where(inArray(entrantMembers.entrantId, entrantIds)) : Promise.resolve([]),
    entrantIds.length
      ? db
          .selectDistinct({ entrantId: mapPlayerStats.entrantId, personId: mapPlayerStats.personId })
          .from(mapPlayerStats)
          .where(and(inArray(mapPlayerStats.entrantId, entrantIds), isNotNull(mapPlayerStats.personId)))
      : Promise.resolve([]),
    teamIds.length
      ? db
          .selectDistinct({ teamId: rosterMemberships.teamId, personId: rosterMemberships.personId, role: rosterMemberships.role })
          .from(rosterMemberships)
          .where(
            and(
              inArray(rosterMemberships.teamId, teamIds),
              notInArray(rosterMemberships.role, PLAYER_ROLES),
              rosterPeriodIsDated,
              sql`${rosterMemberships.period} && daterange(${tournament.startDate}::date, ${tournament.endDate}::date, '[]')`
            )
          )
      : Promise.resolve([]),
    db.selectDistinct({ personId: productionCredits.personId, role: productionCredits.role }).from(productionCredits).where(eq(productionCredits.tournamentId, tournamentId)),
  ]);

  // person -> the entrant they appear under (first one wins)
  const entrantOfPerson = new Map<number, number>();
  const playerIds = new Set<number>();
  // A player role wins over a staff one for someone who is both.
  const roleOfPerson = new Map<number, string>();
  const setRole = (personId: number, role: string) => {
    const current = roleOfPerson.get(personId);
    if (!current || (!PLAYER_ROLES.includes(current) && PLAYER_ROLES.includes(role))) roleOfPerson.set(personId, role);
  };
  const withMembers = new Set(memberRows.map((r) => r.entrantId));
  for (const row of memberRows) {
    setRole(row.personId, row.role);
    if (PLAYER_ROLES.includes(row.role)) playerIds.add(row.personId);
  }
  for (const row of statRows) {
    if (row.personId === null) continue;
    setRole(row.personId, "player");
    playerIds.add(row.personId);
  }
  for (const row of memberRows) if (!entrantOfPerson.has(row.personId)) entrantOfPerson.set(row.personId, row.entrantId);
  for (const row of statRows) {
    if (row.personId !== null && !withMembers.has(row.entrantId) && !entrantOfPerson.has(row.personId)) entrantOfPerson.set(row.personId, row.entrantId);
  }
  const entrantOfTeam = new Map(entrantRows.filter((e) => e.teamId !== null).map((e) => [e.teamId as number, e.id]));
  for (const row of staffRows) {
    const entrantId = entrantOfTeam.get(row.teamId);
    if (entrantId === undefined) continue;
    setRole(row.personId, row.role);
    if (!entrantOfPerson.has(row.personId)) entrantOfPerson.set(row.personId, entrantId);
  }
  // Broadcast talent has no entrant, someone already on a team keeps their team role.
  const talentIds = new Set<number>();
  for (const row of creditRows) {
    if (!roleOfPerson.has(row.personId)) {
      setRole(row.personId, row.role);
      talentIds.add(row.personId);
    }
  }
  const personIds = [...new Set([...entrantOfPerson.keys(), ...talentIds])];
  if (personIds.length === 0) return [];

  const personRows = await db
    .select({
      personId: people.id,
      handle: people.handle,
      aliases: people.aliases,
      firstName: people.firstName,
      lastName: people.lastName,
      countryCode: people.countryCode,
      liquipediaLink: people.liquipediaLink,
      liquipediaName: liquipediaPersonNames.name,
    })
    .from(people)
    .leftJoin(liquipediaPersonNames, eq(liquipediaPersonNames.personId, people.id))
    .where(inArray(people.id, personIds));

  const teamNameByEntrant = new Map(entrantRows.map((e) => [e.id, e.displayName]));
  return personRows
    .map((row) => {
      const realName = [row.firstName, row.lastName].filter(Boolean).join(" ");
      const aliases = Array.isArray(row.aliases) ? (row.aliases as string[]) : [];
      return {
        personId: row.personId,
        handle: row.handle,
        teamName: teamNameByEntrant.get(entrantOfPerson.get(row.personId) ?? -1) ?? "",
        entrantId: entrantOfPerson.get(row.personId) ?? null,
        role: roleOfPerson.get(row.personId) ?? "player",
        countryCode: row.countryCode,
        liquipediaLink: row.liquipediaLink,
        kind: playerIds.has(row.personId) ? ("player" as const) : ("staff" as const),
        names: [row.handle, ...aliases, ...(realName ? [realName] : [])],
        liquipediaName: row.liquipediaName,
      };
    })
    .sort((x, y) => x.teamName.localeCompare(y.teamName) || x.handle.localeCompare(y.handle));
}

/** Person mappings touching either the given people or the given names (case-insensitive), for conflict checks. */
export async function findLiquipediaPersonMappings(personIds: number[], names: string[]): Promise<{ personId: number; name: string; handle: string }[]> {
  const lowered = [...new Set(names.map((n) => n.toLowerCase()))];
  const conditions = [];
  if (personIds.length > 0) conditions.push(inArray(liquipediaPersonNames.personId, personIds));
  if (lowered.length > 0) conditions.push(inArray(sql`lower(${liquipediaPersonNames.name})`, lowered));
  if (conditions.length === 0) return [];
  return db
    .select({ personId: liquipediaPersonNames.personId, name: liquipediaPersonNames.name, handle: people.handle })
    .from(liquipediaPersonNames)
    .innerJoin(people, eq(people.id, liquipediaPersonNames.personId))
    .where(or(...conditions));
}

/** Staff the team ever had, by Liquipedia team name, for the person picker's first suggestions. */
export async function findTeamStaffByLiquipediaName(teamName: string, limit: number): Promise<PersonPickerResult[]> {
  const [team] = await db
    .select({ teamId: liquipediaTeamNames.teamId })
    .from(liquipediaTeamNames)
    .where(sql`lower(${liquipediaTeamNames.name}) = ${teamName.trim().toLowerCase()}`)
    .limit(1);
  if (!team) return [];
  return db
    .selectDistinct({ id: people.id, handle: people.handle, countryCode: people.countryCode, secondaryCountryCode: people.secondaryCountryCode })
    .from(rosterMemberships)
    .innerJoin(people, eq(people.id, rosterMemberships.personId))
    .where(and(eq(rosterMemberships.teamId, team.teamId), notInArray(rosterMemberships.role, PLAYER_ROLES)))
    .orderBy(asc(people.handle))
    .limit(limit);
}

export type LiquipediaBracketGroup = {
  /** Id of the group's first container, stable key of the row. */
  id: number;
  stageName: string;
  /** Group prefix of the container names ("Group A"), empty for the stage's single bracket. */
  label: string;
  containerNames: string[];
  containerIds: number[];
  template: string | null;
};

/** Physical brackets of a tournament (a double elimination spans several containers), with their Liquipedia template. */
export async function getTournamentLiquipediaBrackets(tournamentId: number): Promise<LiquipediaBracketGroup[]> {
  const stageRows = await db
    .select({ id: stages.id, name: stages.name })
    .from(stages)
    .where(eq(stages.tournamentId, tournamentId))
    .orderBy(asc(stages.sequenceOrder), asc(stages.id));
  if (stageRows.length === 0) return [];

  const containerRows = await db
    .select({ id: stageContainers.id, stageId: stageContainers.stageId, name: stageContainers.name, template: stageContainers.liquipediaBracketTemplate })
    .from(stageContainers)
    .where(and(inArray(stageContainers.stageId, stageRows.map((s) => s.id)), eq(stageContainers.containerType, "bracket")))
    .orderBy(asc(stageContainers.displayOrder), asc(stageContainers.id));

  return stageRows.flatMap((stage) =>
    groupBracketContainers(containerRows.filter((c) => c.stageId === stage.id)).map((group) => ({
      id: group.containers[0]!.id,
      stageName: stage.name,
      label: group.label,
      containerNames: group.containers.map((c) => c.name),
      containerIds: group.containers.map((c) => c.id),
      template: group.containers.find((c) => c.template)?.template ?? null,
    }))
  );
}
