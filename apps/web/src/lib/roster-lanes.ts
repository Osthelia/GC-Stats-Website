/**
 * GC-Stats - roster-lanes
 *
 * Lanes (Top to Support) of League roster entries, in the one table they live in. Reading: the stored lanes come
 * first, then the lanes the person played for the team in imported games within the entry's period, and a tournament
 * roster shows the lanes played in that tournament, the stored ones before its first game. Writing: the admin team
 * and player roster actions and the change request apply path replace an entry's lanes in the same transaction as
 * the entry. Server only.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import type { adminDb } from "@gc-stats/db/client";
import { leagueTables } from "@gc-stats/db";
import { gameHasLanes, type GameSlug } from "@gc-stats/db/game";
import { lanesByGames, lanesPlayedInPeriod, sortLanes, type LaneGames, type LeagueRole, type PlayedLane } from "@gc-stats/lol-stats-engine";
import { rangeLower, rangeUpper } from "@/lib/daterange";
import type { ActivityChanges } from "@/lib/activity-log";
import { ROLES_WITH_LANES, roleHasLanes } from "@/lib/roster-roles";

export type EntryLanes = {
  lanes: LeagueRole[];
  /** True when the lanes come from imported games because none are stored. */
  fromGames: boolean;
};

/** The admin shows the saved lanes apart from the ones taken from games, only the saved ones are editable. */
export function splitEntryLanes(entry: EntryLanes | undefined): { lanes: LeagueRole[]; gameLanes: LeagueRole[] } {
  if (!entry) return { lanes: [], gameLanes: [] };
  return entry.fromGames ? { lanes: [], gameLanes: entry.lanes } : { lanes: entry.lanes, gameLanes: [] };
}

export type RosterEntryRef = { membershipId: number; personId: number; teamId: number; role: string; period: string; hasLeft: boolean };

export async function getStoredLanes(membershipIds: number[]): Promise<Map<number, LeagueRole[]>> {
  const stored = new Map<number, LeagueRole[]>();
  if (membershipIds.length === 0) return stored;
  const { rosterMembershipLanes } = leagueTables;
  const rows = await db
    .select({ membershipId: rosterMembershipLanes.rosterMembershipId, lane: rosterMembershipLanes.lane })
    .from(rosterMembershipLanes)
    .where(inArray(rosterMembershipLanes.rosterMembershipId, membershipIds));
  const byMembership = new Map<number, string[]>();
  for (const row of rows) byMembership.set(row.membershipId, [...(byMembership.get(row.membershipId) ?? []), row.lane]);
  for (const [membershipId, lanes] of byMembership) stored.set(membershipId, sortLanes(lanes));
  return stored;
}

/** The UTC day a game started, as the date and as text (a date column would come back as a JS Date). */
const gameDay = sql`(${leagueTables.games.startedAt} AT TIME ZONE 'UTC')::date`;

async function playedLanesByPersonAndTeam(entries: RosterEntryRef[]): Promise<Map<string, PlayedLane[]>> {
  const played = new Map<string, PlayedLane[]>();
  const { gamePlayerStats, games, entrants } = leagueTables;
  const periods = new Map<string, SQL>();
  for (const entry of entries) {
    const since = rangeLower(entry.period);
    const until = rangeUpper(entry.period);
    if (entry.hasLeft && until === null) continue; // an unknown end has no lanes from games, see lanesPlayedInPeriod
    periods.set(
      `${entry.personId}:${entry.teamId}:${since}:${until}`,
      and(eq(gamePlayerStats.personId, entry.personId), eq(entrants.teamId, entry.teamId), since ? sql`${gameDay} >= ${since}::date` : undefined, until ? sql`${gameDay} < ${until}::date` : undefined)!,
    );
  }
  if (periods.size === 0) return played;

  const rows = await db
    .select({ personId: gamePlayerStats.personId, teamId: entrants.teamId, lane: gamePlayerStats.role, day: sql<string>`${gameDay}::text`, games: sql<number>`count(*)::int` })
    .from(gamePlayerStats)
    .innerJoin(games, eq(games.id, gamePlayerStats.gameId))
    .innerJoin(entrants, eq(entrants.id, gamePlayerStats.entrantId))
    .where(and(isNotNull(gamePlayerStats.role), or(...periods.values())))
    .groupBy(gamePlayerStats.personId, entrants.teamId, gamePlayerStats.role, gameDay);
  for (const row of rows) {
    const key = `${row.personId}:${row.teamId}`;
    played.set(key, [...(played.get(key) ?? []), { lane: row.lane, day: row.day, games: row.games }]);
  }
  return played;
}

/** The lanes of each entry (by membership id): the stored ones, else the lanes played in games within its period. Entries without lanes get an empty list. */
export async function resolveEntryLanes(entries: RosterEntryRef[]): Promise<Map<number, EntryLanes>> {
  const laneEntries = entries.filter((entry) => roleHasLanes(entry.role));
  const stored = await getStoredLanes(laneEntries.map((entry) => entry.membershipId));
  const withoutStored = laneEntries.filter((entry) => !stored.has(entry.membershipId));
  const played = await playedLanesByPersonAndTeam(withoutStored);

  const resolved = new Map<number, EntryLanes>();
  for (const entry of entries) {
    const storedLanes = stored.get(entry.membershipId);
    if (storedLanes) {
      resolved.set(entry.membershipId, { lanes: storedLanes, fromGames: false });
      continue;
    }
    const games = played.get(`${entry.personId}:${entry.teamId}`) ?? [];
    const lanes = roleHasLanes(entry.role) ? lanesPlayedInPeriod(games, { since: rangeLower(entry.period), until: rangeUpper(entry.period), hasLeft: entry.hasLeft }) : [];
    resolved.set(entry.membershipId, { lanes, fromGames: lanes.length > 0 });
  }
  return resolved;
}

/**
 * The lanes of the people on the rosters of a tournament, by entrant and person. The lanes played in that
 * tournament's games come first (most played first). A person with no game yet gets the lanes of their roster
 * entry for the entrant's team whose period covers the tournament start, stored ones or from earlier games.
 */
export async function getTournamentLanes(
  tournamentId: number,
  startDate: string,
  people: { entrantId: number; teamId: number | null; personId: number }[],
): Promise<Map<string, LeagueRole[]>> {
  const lanes = new Map<string, LeagueRole[]>();
  if (people.length === 0) return lanes;
  const keyOf = (entrantId: number, personId: number) => `${entrantId}:${personId}`;

  const { gamePlayerStats, entrants, rosterMemberships } = leagueTables;
  const playedRows = await db
    .select({ entrantId: gamePlayerStats.entrantId, personId: gamePlayerStats.personId, lane: gamePlayerStats.role, games: sql<number>`count(*)::int` })
    .from(gamePlayerStats)
    .innerJoin(entrants, eq(entrants.id, gamePlayerStats.entrantId))
    .where(and(eq(entrants.tournamentId, tournamentId), inArray(gamePlayerStats.entrantId, [...new Set(people.map((p) => p.entrantId))]), isNotNull(gamePlayerStats.role)))
    .groupBy(gamePlayerStats.entrantId, gamePlayerStats.personId, gamePlayerStats.role);
  const played = new Map<string, LaneGames[]>();
  for (const row of playedRows) {
    if (row.personId === null) continue;
    const key = keyOf(row.entrantId, row.personId);
    played.set(key, [...(played.get(key) ?? []), { lane: row.lane, games: row.games }]);
  }
  for (const [key, playedLanes] of played) lanes.set(key, lanesByGames(playedLanes));

  const withoutGames = people.filter((p) => p.teamId !== null && !lanes.has(keyOf(p.entrantId, p.personId)));
  if (withoutGames.length === 0) return lanes;
  const teamIds = [...new Set(withoutGames.map((p) => p.teamId!))];
  const entryRows = await db
    .select({ membershipId: rosterMemberships.id, personId: rosterMemberships.personId, teamId: rosterMemberships.teamId, role: rosterMemberships.role, period: rosterMemberships.period, hasLeft: rosterMemberships.hasLeft })
    .from(rosterMemberships)
    .where(and(inArray(rosterMemberships.teamId, teamIds), inArray(rosterMemberships.personId, [...new Set(withoutGames.map((p) => p.personId))]), inArray(rosterMemberships.role, [...ROLES_WITH_LANES]), sql`${rosterMemberships.period} @> ${startDate}::date`));
  const resolved = await resolveEntryLanes(entryRows);
  for (const person of withoutGames) {
    const entry = entryRows.find((row) => row.personId === person.personId && row.teamId === person.teamId);
    const entryLanes = entry && resolved.get(entry.membershipId)?.lanes;
    if (entryLanes && entryLanes.length > 0) lanes.set(keyOf(person.entrantId, person.personId), entryLanes);
  }
  return lanes;
}

// A type only: the public pages read lanes through this module and must not load the admin connection.
type Tx = Parameters<Parameters<(typeof adminDb)["transaction"]>[0]>[0];

/** The lanes to store for an entry: none outside League, none for a role without lanes (coach, analyst...). */
export function lanesToStore(game: GameSlug, role: string, lanes: readonly string[]): LeagueRole[] {
  return gameHasLanes(game) && roleHasLanes(role) ? sortLanes(lanes) : [];
}

/**
 * Replaces the lanes of an entry. An empty list clears them, the lanes then come from the games again. Returns the
 * before/after of the lanes when they changed (nothing when they did not), to go into the roster activity log entry.
 */
export async function replaceEntryLanes(game: GameSlug, tx: Tx, membershipId: number, role: string, lanes: readonly string[]): Promise<ActivityChanges> {
  if (!gameHasLanes(game)) return {};
  const { rosterMembershipLanes } = leagueTables;
  const previous = sortLanes((await tx.select({ lane: rosterMembershipLanes.lane }).from(rosterMembershipLanes).where(eq(rosterMembershipLanes.rosterMembershipId, membershipId))).map((row) => row.lane));
  await tx.delete(rosterMembershipLanes).where(eq(rosterMembershipLanes.rosterMembershipId, membershipId));
  const stored = lanesToStore(game, role, lanes);
  if (stored.length > 0) await tx.insert(rosterMembershipLanes).values(stored.map((lane) => ({ rosterMembershipId: membershipId, lane })));
  return previous.join() === stored.join() ? {} : { lanes: { old: previous, new: stored } };
}
