/**
 * GC-Stats - admin-ghost-matches
 *
 * Admin server actions for a GC team's match played in an uncovered mix
 * tournament: creates the ghost tournament, the ghost opponent and any
 * ghost player in one go, and promotes a ghost profile once it's covered.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { tournaments, stages, stageContainers, entrants, entrantMembers, matches, maps, teams, people, rosterMemberships, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { searchTeamsQuery, type TeamPickerResult } from "@/lib/team-search";
import { searchPeopleQuery, type PersonPickerResult } from "@/lib/person-search";
import { GHOST_MATCH_BEST_OF_VALUES, GHOST_MATCH_PLAYER_SLOTS } from "@/lib/ghost-match";
import { parseIsoInstant } from "@/lib/datetime-local";

async function requireTournamentsActor(): Promise<void> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);
}

/** A roster slot: an existing person, or a handle for a new ghost player. */
export type GhostMatchPlayerInput = { personId: number | null; handle: string };

export type GhostMatchInput = {
  tournamentName: string;
  stageName: string;
  scheduledAt: string;
  bestOf: string;
  gcTeamId: number | null;
  opponentTeamId: number | null;
  opponentTeamName: string;
  gcPlayers: GhostMatchPlayerInput[];
  opponentPlayers: GhostMatchPlayerInput[];
};

export type GhostMatchField = "tournamentName" | "stageName" | "scheduledAt" | "bestOf" | "gcTeamId" | "opponent";
export type GhostMatchFieldErrors = Partial<Record<GhostMatchField, string>> & {
  gcPlayers?: Record<number, string>;
  opponentPlayers?: Record<number, string>;
};
export type GhostMatchResult = { ok: true; tournamentId: number; matchId: number } | { ok: false; fieldErrors: GhostMatchFieldErrors };

export async function searchGhostTeams(query: string): Promise<TeamPickerResult[]> {
  await requireTournamentsActor();
  return searchTeamsQuery(query, undefined, "only");
}

export async function searchGhostPeople(query: string): Promise<PersonPickerResult[]> {
  await requireTournamentsActor();
  return searchPeopleQuery(query, undefined, undefined, "only");
}

/** GC side can field an uncovered stand-in, so public and ghost people are both valid. */
export async function searchPeopleIncludingGhosts(query: string): Promise<PersonPickerResult[]> {
  await requireTournamentsActor();
  return searchPeopleQuery(query, undefined, undefined, "include");
}

/** Riot puuid mapping on a map fetch: ghost people are only offered on a ghost tournament's match. */
export async function searchPeopleForMapFetch(mapId: number, query: string): Promise<PersonPickerResult[]> {
  await requireTournamentsActor();
  const [row] = await db
    .select({ isGhost: tournaments.isGhost })
    .from(maps)
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(eq(maps.id, mapId))
    .limit(1);
  return searchPeopleQuery(query, undefined, undefined, row?.isGhost ? "include" : "exclude");
}

/** Current player roster of a GC team, to prefill its side of the form. */
export async function getTeamCurrentPlayers(teamId: number): Promise<{ id: number; handle: string }[]> {
  await requireTournamentsActor();
  return db
    .select({ id: people.id, handle: people.handle })
    .from(rosterMemberships)
    .innerJoin(people, eq(people.id, rosterMemberships.personId))
    .where(
      and(
        eq(rosterMemberships.teamId, teamId),
        inArray(rosterMemberships.role, ["player", "player-igl"]),
        sql`${rosterMemberships.period} @> CURRENT_DATE`,
      ),
    )
    .orderBy(asc(people.handle))
    .limit(GHOST_MATCH_PLAYER_SLOTS);
}

/** Last roster fielded by a ghost team, to prefill the opponent side when reusing it. */
export async function getGhostTeamLastPlayers(teamId: number): Promise<{ id: number; handle: string }[]> {
  await requireTournamentsActor();
  const [last] = await db
    .select({ id: entrants.id })
    .from(entrants)
    .innerJoin(teams, eq(teams.id, entrants.teamId))
    .where(and(eq(entrants.teamId, teamId), eq(teams.isGhost, true)))
    .orderBy(desc(entrants.id))
    .limit(1);
  if (!last) return [];
  return db
    .select({ id: people.id, handle: people.handle })
    .from(entrantMembers)
    .innerJoin(people, eq(people.id, entrantMembers.personId))
    .where(eq(entrantMembers.entrantId, last.id))
    .orderBy(asc(people.handle))
    .limit(GHOST_MATCH_PLAYER_SLOTS);
}

async function validatePlayers(rows: GhostMatchPlayerInput[], ghostOnly: boolean): Promise<Record<number, string>> {
  const errors: Record<number, string> = {};
  if (rows.length !== GHOST_MATCH_PLAYER_SLOTS) {
    for (let i = 0; i < GHOST_MATCH_PLAYER_SLOTS; i++) errors[i] = "required";
    return errors;
  }

  const ids = rows.map((r) => r.personId).filter((id): id is number => id !== null);
  const found = ids.length ? await db.select({ id: people.id, isGhost: people.isGhost }).from(people).where(inArray(people.id, ids)) : [];
  const byId = new Map(found.map((p) => [p.id, p]));
  const seen = new Set<number>();

  rows.forEach((row, i) => {
    if (row.personId !== null) {
      const person = byId.get(row.personId);
      if (!person) errors[i] = "notFound";
      else if (ghostOnly && !person.isGhost) errors[i] = "notGhost";
      else if (seen.has(row.personId)) errors[i] = "duplicate";
      seen.add(row.personId);
      return;
    }
    const handle = row.handle.trim();
    if (!handle) errors[i] = "required";
    else if (handle.length > 100) errors[i] = "tooLong";
  });
  return errors;
}

export async function createGhostMatch(input: GhostMatchInput): Promise<GhostMatchResult> {
  await requireTournamentsActor();

  const fieldErrors: GhostMatchFieldErrors = {};

  const tournamentName = input.tournamentName.trim();
  if (!tournamentName) fieldErrors.tournamentName = "required";
  else if (tournamentName.length > 255) fieldErrors.tournamentName = "tooLong";

  const stageName = input.stageName.trim();
  if (!stageName) fieldErrors.stageName = "required";
  else if (stageName.length > 255) fieldErrors.stageName = "tooLong";

  const scheduledAt = input.scheduledAt ? parseIsoInstant(input.scheduledAt) : null;
  if (!input.scheduledAt) fieldErrors.scheduledAt = "required";
  else if (!scheduledAt) fieldErrors.scheduledAt = "invalid";

  const bestOf = Number(input.bestOf);
  if (!(GHOST_MATCH_BEST_OF_VALUES as readonly string[]).includes(input.bestOf)) fieldErrors.bestOf = "invalid";

  let gcTeam: { id: number; name: string } | undefined;
  if (input.gcTeamId === null) fieldErrors.gcTeamId = "required";
  else {
    const [row] = await db.select({ id: teams.id, name: teams.name, isGhost: teams.isGhost }).from(teams).where(eq(teams.id, input.gcTeamId)).limit(1);
    if (!row) fieldErrors.gcTeamId = "notFound";
    else if (row.isGhost) fieldErrors.gcTeamId = "ghostTeam";
    else gcTeam = row;
  }

  const opponentTeamName = input.opponentTeamName.trim();
  let opponentTeam: { id: number; name: string } | undefined;
  if (input.opponentTeamId !== null) {
    const [row] = await db.select({ id: teams.id, name: teams.name, isGhost: teams.isGhost }).from(teams).where(eq(teams.id, input.opponentTeamId)).limit(1);
    if (!row) fieldErrors.opponent = "notFound";
    else if (!row.isGhost) fieldErrors.opponent = "notGhost";
    else opponentTeam = row;
  } else if (!opponentTeamName) fieldErrors.opponent = "required";
  else if (opponentTeamName.length > 255) fieldErrors.opponent = "tooLong";

  const gcPlayerErrors = await validatePlayers(input.gcPlayers, false);
  if (Object.keys(gcPlayerErrors).length > 0) fieldErrors.gcPlayers = gcPlayerErrors;
  const opponentPlayerErrors = await validatePlayers(input.opponentPlayers, true);
  if (Object.keys(opponentPlayerErrors).length > 0) fieldErrors.opponentPlayers = opponentPlayerErrors;

  // A person can't play on both sides of the same match.
  const gcIds = new Set(input.gcPlayers.map((r) => r.personId).filter((id) => id !== null));
  input.opponentPlayers.forEach((r, i) => {
    if (r.personId !== null && gcIds.has(r.personId)) (fieldErrors.opponentPlayers ??= {})[i] = "duplicate";
  });

  if (Object.keys(fieldErrors).length > 0 || !gcTeam || !scheduledAt) return { ok: false, fieldErrors };

  const day = scheduledAt.toISOString().slice(0, 10);
  const status = scheduledAt.getTime() < Date.now() ? "finished" : "upcoming";

  const created = await db.transaction(async (tx) => {
    // Several GC matches can come from the same mix event: reuse it by name.
    let [tournament] = await tx
      .select({ id: tournaments.id, startDate: tournaments.startDate, endDate: tournaments.endDate })
      .from(tournaments)
      .where(and(eq(tournaments.isGhost, true), sql`lower(${tournaments.name}) = lower(${tournamentName})`))
      .limit(1);
    if (tournament) {
      await tx
        .update(tournaments)
        .set({ startDate: day < tournament.startDate ? day : tournament.startDate, endDate: day > tournament.endDate ? day : tournament.endDate })
        .where(eq(tournaments.id, tournament.id));
    } else {
      [tournament] = await tx
        .insert(tournaments)
        .values({ name: tournamentName, startDate: day, endDate: day, status, active: true, isGhost: true })
        .returning({ id: tournaments.id, startDate: tournaments.startDate, endDate: tournaments.endDate });
    }
    const tournamentId = tournament!.id;

    let [stage] = await tx
      .select({ id: stages.id })
      .from(stages)
      .where(and(eq(stages.tournamentId, tournamentId), sql`lower(${stages.name}) = lower(${stageName})`))
      .limit(1);
    if (!stage) {
      const [order] = await tx.select({ next: sql<number>`coalesce(max(${stages.sequenceOrder}), 0) + 1` }).from(stages).where(eq(stages.tournamentId, tournamentId));
      [stage] = await tx.insert(stages).values({ tournamentId, name: stageName, sequenceOrder: Number(order?.next ?? 1) }).returning({ id: stages.id });
    }

    let [container] = await tx.select({ id: stageContainers.id }).from(stageContainers).where(eq(stageContainers.stageId, stage!.id)).limit(1);
    if (!container) {
      [container] = await tx.insert(stageContainers).values({ stageId: stage!.id, name: stageName, containerType: "bracket" }).returning({ id: stageContainers.id });
    }

    if (!opponentTeam) {
      const [row] = await tx.insert(teams).values({ name: opponentTeamName, isGhost: true, isActive: true, socials: {}, tags: [] }).returning({ id: teams.id, name: teams.name });
      opponentTeam = row!;
    }

    const entrantFor = async (team: { id: number; name: string }) => {
      const [existing] = await tx
        .select({ id: entrants.id })
        .from(entrants)
        .where(and(eq(entrants.tournamentId, tournamentId), eq(entrants.teamId, team.id)))
        .limit(1);
      if (existing) return existing.id;
      const [row] = await tx.insert(entrants).values({ tournamentId, kind: "team", teamId: team.id, displayName: team.name }).returning({ id: entrants.id });
      return row!.id;
    };
    const gcEntrantId = await entrantFor(gcTeam!);
    const opponentEntrantId = await entrantFor(opponentTeam);

    const lockRoster = async (entrantId: number, rows: GhostMatchPlayerInput[]) => {
      for (const row of rows) {
        let personId = row.personId;
        if (personId === null) {
          const [person] = await tx.insert(people).values({ handle: row.handle.trim(), isGhost: true, isActive: true, socials: {} }).returning({ id: people.id });
          personId = person!.id;
        }
        await tx.insert(entrantMembers).values({ entrantId, personId, role: "player" }).onConflictDoNothing();
      }
    };
    await lockRoster(gcEntrantId, input.gcPlayers);
    await lockRoster(opponentEntrantId, input.opponentPlayers);

    const [match] = await tx
      .insert(matches)
      .values({ containerId: container!.id, round: 1, bestOf, status: "pending", entrantAId: gcEntrantId, entrantBId: opponentEntrantId, scheduledAt })
      .returning({ id: matches.id });

    return { tournamentId, matchId: match!.id };
  });

  return { ok: true, ...created };
}

export type PromoteGhostResult = { ok: true } | { ok: false; error: "notFound" };

/** A ghost profile that ends up covered becomes a regular public one, stats included. */
export async function promoteGhostTeam(teamId: number): Promise<PromoteGhostResult> {
  await requireActorPermission(PERMISSIONS.teamsEdit);
  const updated = await db.update(teams).set({ isGhost: false }).where(and(eq(teams.id, teamId), eq(teams.isGhost, true))).returning({ id: teams.id });
  return updated.length ? { ok: true } : { ok: false, error: "notFound" };
}

export async function promoteGhostPlayer(personId: number): Promise<PromoteGhostResult> {
  await requireActorPermission(PERMISSIONS.playersEdit);
  const updated = await db.update(people).set({ isGhost: false }).where(and(eq(people.id, personId), eq(people.isGhost, true))).returning({ id: people.id });
  return updated.length ? { ok: true } : { ok: false, error: "notFound" };
}
