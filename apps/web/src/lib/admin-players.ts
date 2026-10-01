/**
 * GC-Stats - admin-players
 *
 * Admin queries for /admin/players: paginated, filterable player list with
 * current team and last activity, profile detail, and full team history.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sql, eq, or, and, desc, asc } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { people, teams, rosterMemberships, entrants, matches, maps, mapPlayerStats, users } from "@gc-stats/db";
import { rangeLower, rangeUpper, rangeIsOpen } from "@/lib/daterange";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike, qualifiedColumn } from "@/lib/db-search";

export type PlayerSort = "name" | "country" | "team" | "lastActivity";
export type SortDirection = "asc" | "desc";
export type ActiveWithin = "" | "60d" | "120d";
export type StatusFilter = "" | "active" | "inactive";

export type AdminPlayerRow = {
  id: number;
  handle: string;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  isActive: boolean;
  isGhost: boolean;
  vlrId: number | null;
  currentTeamId: number | null;
  currentTeamName: string | null;
  lastActivityAt: Date | null;
};

// `people` refers to the outer query's FROM table — same correlated-subquery
// pattern as admin-teams.ts / V1's PlayerController::latestMatchSubquery().
const currentTeamSql = sql<number | null>`(
  SELECT rm.team_id FROM ${rosterMemberships} rm
  WHERE rm.person_id = ${qualifiedColumn(people, "id")} AND rm.role = 'player' AND rm.period @> CURRENT_DATE
  LIMIT 1
)`;

// `entrant_members` (tournament-locked roster) was never populated by the V1
// migration, so real per-map stats are the only ground truth for "did this
// person play this match" — same source as getPlayerMatches (player-page-data.ts).
const lastActivitySql = sql<string | null>`(
  SELECT MAX(m.scheduled_at) FROM ${mapPlayerStats} mps
  JOIN ${maps} mp ON mp.id = mps.map_id
  JOIN ${matches} m ON m.id = mp.match_id
  WHERE mps.person_id = ${qualifiedColumn(people, "id")}
)`;

const ACTIVE_WITHIN_DAYS: Record<Exclude<ActiveWithin, "">, number> = { "60d": 60, "120d": 120 };

export const PLAYERS_PAGE_SIZE = 30;

export async function listAdminPlayers(opts: {
  q: string;
  sort: PlayerSort;
  direction: SortDirection;
  activeWithin: ActiveWithin;
  status: StatusFilter;
  page: number;
}): Promise<{ rows: AdminPlayerRow[]; total: number }> {
  const { q, sort, direction, activeWithin, status, page } = opts;
  const conditions = [];

  if (q) {
    const numeric = /^\d+$/.test(q);
    const variants = typoVariants(q.toLowerCase());
    const clauses = variants.map((v) => foldedIlike(people.handle, v));
    if (numeric) {
      const n = Number(q);
      clauses.push(eq(people.id, n), eq(people.vlrId, n));
    }
    conditions.push(or(...clauses));
  }

  if (status === "active") conditions.push(eq(people.isActive, true));
  if (status === "inactive") conditions.push(eq(people.isActive, false));

  if (activeWithin) {
    const days = ACTIVE_WITHIN_DAYS[activeWithin];
    conditions.push(sql`${lastActivitySql} >= NOW() - ${sql.raw(`INTERVAL '${days} days'`)}`);
  }

  const currentTeamNameSql = sql<string | null>`(SELECT t.name FROM ${teams} t WHERE t.id = ${currentTeamSql})`;

  const sortCol = sort === "country" ? people.countryCode : sort === "team" ? currentTeamNameSql : sort === "lastActivity" ? lastActivitySql : people.handle;
  const orderBy = direction === "desc" ? desc(sortCol) : asc(sortCol);
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: people.id,
        handle: people.handle,
        countryCode: people.countryCode,
        secondaryCountryCode: people.secondaryCountryCode,
        isActive: people.isActive,
        isGhost: people.isGhost,
        vlrId: people.vlrId,
        currentTeamId: currentTeamSql,
        currentTeamName: currentTeamNameSql,
        lastActivityAt: lastActivitySql,
      })
      .from(people)
      .where(where)
      .orderBy(orderBy)
      .limit(PLAYERS_PAGE_SIZE)
      .offset((page - 1) * PLAYERS_PAGE_SIZE),
    db.select({ total: sql<number>`count(*)` }).from(people).where(where),
  ]);

  return {
    rows: rows.map((r) => ({
      ...r,
      lastActivityAt: r.lastActivityAt ? new Date(r.lastActivityAt) : null,
    })),
    total: Number(totalRows[0]?.total ?? 0),
  };
}

export type AdminLinkedUser = { id: string; username: string | null; email: string | null };

export type AdminPlayerProfile = {
  id: number;
  handle: string;
  aliases: string[];
  firstName: string | null;
  lastName: string | null;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  pronouns: number | null;
  bio: string | null;
  vlrId: number | null;
  valId: string | null;
  esportsValId: string | null;
  liquipediaLink: string | null;
  isActive: boolean;
  isGhost: boolean;
  socials: Record<string, string>;
  linkedUser: AdminLinkedUser | null;
};

// Current team isn't a profile field — it's managed entirely from the
// team-history panel (an open-ended stint *is* "current"), so getAdminPlayer
// doesn't resolve/return one; see PlayerTeamHistoryPanel.
export async function getAdminPlayer(id: number): Promise<AdminPlayerProfile | null> {
  const [row] = await db
    .select({ person: people, linkedUserId: users.id, linkedUsername: users.username, linkedEmail: users.email })
    .from(people)
    .leftJoin(users, eq(users.id, people.userId))
    .where(eq(people.id, id))
    .limit(1);
  if (!row) return null;

  return {
    id: row.person.id,
    handle: row.person.handle,
    aliases: Array.isArray(row.person.aliases) ? (row.person.aliases as string[]) : [],
    firstName: row.person.firstName,
    lastName: row.person.lastName,
    countryCode: row.person.countryCode,
    secondaryCountryCode: row.person.secondaryCountryCode,
    pronouns: row.person.pronouns,
    bio: row.person.bio,
    vlrId: row.person.vlrId,
    valId: row.person.valId,
    esportsValId: row.person.esportsValId,
    liquipediaLink: row.person.liquipediaLink,
    isActive: row.person.isActive,
    isGhost: row.person.isGhost,
    socials: (row.person.socials as Record<string, string>) ?? {},
    linkedUser: row.linkedUserId ? { id: row.linkedUserId, username: row.linkedUsername, email: row.linkedEmail } : null,
  };
}

export type AdminPlayerTeamHistoryEntry = {
  membershipId: number;
  teamId: number;
  teamName: string;
  teamCountryCode: string | null;
  teamSecondaryCountryCode: string | null;
  role: string;
  since: string | null;
  until: string | null;
  isCurrent: boolean;
  inactiveSince: string | null;
};

/** Every stint, not just the current team — same reasoning as admin-teams.ts::getAdminTeamRoster (join/left/inactive dates editable directly on already-listed entries too, current or past). */
export async function getAdminPlayerTeamHistory(personId: number): Promise<AdminPlayerTeamHistoryEntry[]> {
  const rows = await db
    .select({
      membershipId: rosterMemberships.id,
      teamId: teams.id,
      teamName: teams.name,
      teamCountryCode: teams.countryCode,
      teamSecondaryCountryCode: teams.secondaryCountryCode,
      role: rosterMemberships.role,
      period: rosterMemberships.period,
      inactiveSince: rosterMemberships.inactiveSince,
    })
    .from(rosterMemberships)
    .innerJoin(teams, eq(teams.id, rosterMemberships.teamId))
    .where(eq(rosterMemberships.personId, personId))
    .orderBy(desc(rosterMemberships.id));

  return rows.map((r) => ({
    ...r,
    since: rangeLower(r.period),
    until: rangeUpper(r.period),
    isCurrent: rangeIsOpen(r.period),
  }));
}
