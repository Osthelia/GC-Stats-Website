/**
 * GC-Stats - liquipedia-transfers-data
 *
 * Loads the roster movements of a month and completes a Liquipedia transfers page with them.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, gte, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { entrantMembers, entrants, liquipediaPersonNames, liquipediaTeamNames, people, rosterMemberships, teams, tournaments } from "@gc-stats/db";
import { rangeLower, rangeUpper } from "@/lib/daterange";
import { liquipediaFlagCode } from "@/lib/countries";
import { liquipediaTitleFromLink } from "@/lib/liquipedia-api";
import { ROSTER_SOURCE_TEXTS } from "@/lib/roster-source";
import { buildTransferEntries, completeTransferPage, type MonthRange, type TransferMembership, type TransferPageError } from "@/lib/liquipedia-transfers-wikicode";

export type TransfersWikicode = {
  wikicode: string;
  addedRows: number;
  alreadyListed: string[];
  /** Teams written with their GCS name because they have no Liquipedia name yet. */
  unlinkedTeams: string[];
  /** People written with their handle because they have no Liquipedia name yet. */
  unlinkedPeople: string[];
  /** People whose movement has no source link. */
  missingSources: string[];
};

/** Memberships with a join, a leave or an inactivity date inside the month. */
type MonthMembership = TransferMembership & { teamId: number; teamHasLiquipediaName: boolean };

async function getMonthMemberships(range: MonthRange): Promise<MonthMembership[]> {
  const rows = await db
    .select({
      personId: people.id,
      handle: people.handle,
      liquipediaName: liquipediaPersonNames.name,
      countryCode: people.countryCode,
      liquipediaLink: people.liquipediaLink,
      teamId: teams.id,
      teamName: teams.name,
      teamLiquipediaName: liquipediaTeamNames.name,
      role: rosterMemberships.role,
      period: rosterMemberships.period,
      hasLeft: rosterMemberships.hasLeft,
      inactiveSince: rosterMemberships.inactiveSince,
      joinSource: rosterMemberships.joinSource,
      leftSource: rosterMemberships.leftSource,
    })
    .from(rosterMemberships)
    .innerJoin(people, eq(people.id, rosterMemberships.personId))
    .innerJoin(teams, eq(teams.id, rosterMemberships.teamId))
    .leftJoin(liquipediaPersonNames, eq(liquipediaPersonNames.personId, people.id))
    .leftJoin(liquipediaTeamNames, eq(liquipediaTeamNames.teamId, teams.id))
    .where(
      and(
        eq(people.isGhost, false),
        eq(teams.isGhost, false),
        or(
          and(sql`lower(${rosterMemberships.period}) >= ${range.start}::date`, sql`lower(${rosterMemberships.period}) < ${range.end}::date`),
          and(eq(rosterMemberships.hasLeft, true), sql`upper(${rosterMemberships.period}) >= ${range.start}::date`, sql`upper(${rosterMemberships.period}) < ${range.end}::date`),
          and(isNotNull(rosterMemberships.inactiveSince), gte(rosterMemberships.inactiveSince, range.start), lt(rosterMemberships.inactiveSince, range.end))
        )
      )
    );

  return rows.map((row) => ({
    personId: row.personId,
    handle: row.handle,
    liquipediaName: row.liquipediaName,
    flag: liquipediaFlagCode(row.countryCode),
    hasPage: Boolean(row.liquipediaLink),
    teamId: row.teamId,
    teamName: row.teamLiquipediaName ?? row.teamName,
    teamHasLiquipediaName: row.teamLiquipediaName !== null,
    role: row.role,
    since: rangeLower(row.period),
    until: rangeUpper(row.period),
    hasLeft: row.hasLeft,
    inactiveSince: row.inactiveSince,
    joinSource: row.joinSource,
    leftSource: row.leftSource,
    joinTournament: null,
    leftTournament: null,
  }));
}

/**
 * Fills the tournament of the memberships whose source says "started / stopped playing at a tournament":
 * the first tournament the person played for the team from their arrival, the last one before their departure.
 * Only tournaments with a Liquipedia link count, the others cannot be referenced.
 */
async function resolveSourceTournaments(memberships: MonthMembership[]): Promise<void> {
  const needing = memberships.filter((m) => m.joinSource === ROSTER_SOURCE_TEXTS.startedTournament || m.leftSource === ROSTER_SOURCE_TEXTS.stoppedTournament);
  if (needing.length === 0) return;

  const played = await db
    .select({ personId: entrantMembers.personId, teamId: entrants.teamId, startDate: tournaments.startDate, liquipediaLink: tournaments.liquipediaLink })
    .from(entrantMembers)
    .innerJoin(entrants, eq(entrants.id, entrantMembers.entrantId))
    .innerJoin(tournaments, eq(tournaments.id, entrants.tournamentId))
    .where(
      and(
        inArray(entrantMembers.personId, [...new Set(needing.map((m) => m.personId))]),
        inArray(entrants.teamId, [...new Set(needing.map((m) => m.teamId))]),
        isNotNull(tournaments.liquipediaLink),
        eq(tournaments.isGhost, false)
      )
    )
    .orderBy(tournaments.startDate);

  const page = (link: string | null) => (link ? liquipediaTitleFromLink(link).replaceAll(" ", "_") : null);
  for (const m of needing) {
    const own = played.filter((p) => p.personId === m.personId && p.teamId === m.teamId);
    if (m.joinSource === ROSTER_SOURCE_TEXTS.startedTournament) m.joinTournament = page(own.find((p) => !m.since || p.startDate >= m.since)?.liquipediaLink ?? null);
    if (m.leftSource === ROSTER_SOURCE_TEXTS.stoppedTournament) m.leftTournament = page(own.filter((p) => !m.until || p.startDate < m.until).at(-1)?.liquipediaLink ?? null);
  }
}

/** Completes the page with the month's roster movements, or returns what is wrong with the page. */
export async function getCompletedTransfersWikicode(wikicode: string, range: MonthRange): Promise<TransfersWikicode | TransferPageError> {
  const memberships = await getMonthMemberships(range);
  await resolveSourceTournaments(memberships);
  const entries = buildTransferEntries(memberships, range);
  const completed = completeTransferPage(wikicode, entries);
  if (typeof completed === "string") return completed;

  const unlinkedTeamNames = new Set(memberships.filter((m) => !m.teamHasLiquipediaName).map((m) => m.teamName));
  const used = new Set(entries.map((e) => e.person.personId));
  const unlinkedPeople = [...new Map(memberships.filter((m) => used.has(m.personId) && !m.liquipediaName).map((m) => [m.personId, m.handle])).values()];
  const usedTeams = new Set(entries.flatMap((e) => [e.from?.team, e.to?.team]));

  return {
    ...completed,
    unlinkedTeams: [...unlinkedTeamNames].filter((name) => usedTeams.has(name)).sort((a, b) => a.localeCompare(b)),
    unlinkedPeople: unlinkedPeople.sort((a, b) => a.localeCompare(b)),
    missingSources: [...new Set(entries.filter((e) => e.refs.length === 0).map((e) => e.person.handle))].sort((a, b) => a.localeCompare(b)),
  };
}
