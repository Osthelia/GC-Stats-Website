/**
 * GC-Stats - admin-teams
 *
 * Admin queries for /admin/teams: paginated, filterable team list with
 * roster size and last activity, profile detail, name history and full
 * roster history.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sql, eq, or, and, desc, asc } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { teams, entrants, matches, rosterMemberships, people, teamNameHistory, organizations } from "@gc-stats/db";
import { rangeLower, rangeUpper, rangeIsOpen } from "@/lib/daterange";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike, qualifiedColumn } from "@/lib/db-search";

export type TeamSort = "name" | "country" | "lastActivity";
export type SortDirection = "asc" | "desc";
export type ActiveWithin = "" | "60d" | "120d";
export type StatusFilter = "" | "active" | "inactive";

export type AdminTeamRow = {
  id: number;
  name: string;
  shortName: string | null;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  isActive: boolean;
  isGhost: boolean;
  vlrId: number | null;
  rosterCount: number;
  lastActivityAt: Date | null;
};

// Correlated subqueries — `teams` here refers to the outer query's FROM
// table, same pattern as V1's PlayerController::latestMatchSubquery().
const lastActivitySql = sql<string | null>`(
  SELECT MAX(m.scheduled_at) FROM ${matches} m
  JOIN ${entrants} e ON (e.id = m.entrant_a_id OR e.id = m.entrant_b_id)
  WHERE e.team_id = ${qualifiedColumn(teams, "id")}
)`;

const rosterCountSql = sql<number>`(
  SELECT COUNT(*) FROM ${rosterMemberships} rm
  WHERE rm.team_id = ${qualifiedColumn(teams, "id")} AND rm.role = 'player' AND rm.period @> CURRENT_DATE
)`;

const ACTIVE_WITHIN_DAYS: Record<Exclude<ActiveWithin, "">, number> = { "60d": 60, "120d": 120 };

export const TEAMS_PAGE_SIZE = 30;

export async function listAdminTeams(opts: {
  q: string;
  sort: TeamSort;
  direction: SortDirection;
  activeWithin: ActiveWithin;
  status: StatusFilter;
  page: number;
}): Promise<{ rows: AdminTeamRow[]; total: number }> {
  const { q, sort, direction, activeWithin, status, page } = opts;
  const conditions = [];

  if (q) {
    const numeric = /^\d+$/.test(q);
    const variants = typoVariants(q.toLowerCase());
    const clauses = variants.flatMap((v) => [foldedIlike(teams.name, v), foldedIlike(teams.shortName, v)]);
    if (numeric) {
      const n = Number(q);
      clauses.push(eq(teams.id, n), eq(teams.vlrId, n));
    }
    conditions.push(or(...clauses));
  }

  if (status === "active") conditions.push(eq(teams.isActive, true));
  if (status === "inactive") conditions.push(eq(teams.isActive, false));

  if (activeWithin) {
    const days = ACTIVE_WITHIN_DAYS[activeWithin];
    conditions.push(sql`${lastActivitySql} >= NOW() - ${sql.raw(`INTERVAL '${days} days'`)}`);
  }

  const sortCol = sort === "country" ? teams.countryCode : sort === "lastActivity" ? lastActivitySql : teams.name;
  const orderBy = direction === "desc" ? desc(sortCol) : asc(sortCol);
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: teams.id,
        name: teams.name,
        shortName: teams.shortName,
        countryCode: teams.countryCode,
        secondaryCountryCode: teams.secondaryCountryCode,
        isActive: teams.isActive,
        isGhost: teams.isGhost,
        vlrId: teams.vlrId,
        rosterCount: rosterCountSql,
        lastActivityAt: lastActivitySql,
      })
      .from(teams)
      .where(where)
      .orderBy(orderBy)
      .limit(TEAMS_PAGE_SIZE)
      .offset((page - 1) * TEAMS_PAGE_SIZE),
    db.select({ total: sql<number>`count(*)` }).from(teams).where(where),
  ]);

  return {
    rows: rows.map((r) => ({
      ...r,
      rosterCount: Number(r.rosterCount),
      lastActivityAt: r.lastActivityAt ? new Date(r.lastActivityAt) : null,
    })),
    total: Number(totalRows[0]?.total ?? 0),
  };
}

export type AdminTeamProfile = {
  id: number;
  name: string;
  shortName: string | null;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  bio: string | null;
  vlrId: number | null;
  liquipediaLink: string | null;
  isActive: boolean;
  isGhost: boolean;
  organizationId: number | null;
  organizationName: string | null;
  socials: Record<string, string>;
  tags: string[];
};

export async function getAdminTeam(id: number): Promise<AdminTeamProfile | null> {
  const [found] = await db
    .select({ team: teams, organizationName: organizations.name })
    .from(teams)
    .leftJoin(organizations, eq(organizations.id, teams.organizationId))
    .where(eq(teams.id, id))
    .limit(1);
  if (!found) return null;
  const row = found.team;
  return {
    organizationId: row.organizationId,
    organizationName: found.organizationName,
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    countryCode: row.countryCode,
    secondaryCountryCode: row.secondaryCountryCode,
    bio: row.bio,
    vlrId: row.vlrId,
    liquipediaLink: row.liquipediaLink,
    isActive: row.isActive,
    isGhost: row.isGhost,
    socials: (row.socials as Record<string, string>) ?? {},
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
  };
}

export type AdminTeamNameHistoryEntry = {
  id: number;
  name: string;
  since: string | null;
  until: string | null;
  isVisible: boolean;
};

export async function getAdminTeamNameHistory(teamId: number): Promise<AdminTeamNameHistoryEntry[]> {
  const rows = await db
    .select({ id: teamNameHistory.id, name: teamNameHistory.name, period: teamNameHistory.period, isVisible: teamNameHistory.isVisible })
    .from(teamNameHistory)
    .where(eq(teamNameHistory.teamId, teamId))
    .orderBy(desc(teamNameHistory.id));

  return rows.map((r) => ({ id: r.id, name: r.name, since: rangeLower(r.period), until: rangeUpper(r.period), isVisible: r.isVisible }));
}

export type AdminTeamRosterMember = {
  membershipId: number;
  personId: number;
  handle: string;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  role: string;
  since: string | null;
  until: string | null;
  isCurrent: boolean;
  inactiveSince: string | null;
};

/** Every stint, not just the current roster — join/left/inactive dates need to be visible directly on already-listed (past) members too, not just the currently active ones. */
export async function getAdminTeamRoster(teamId: number): Promise<AdminTeamRosterMember[]> {
  const rows = await db
    .select({
      membershipId: rosterMemberships.id,
      personId: people.id,
      handle: people.handle,
      countryCode: people.countryCode,
      secondaryCountryCode: people.secondaryCountryCode,
      role: rosterMemberships.role,
      period: rosterMemberships.period,
      inactiveSince: rosterMemberships.inactiveSince,
    })
    .from(rosterMemberships)
    .innerJoin(people, eq(people.id, rosterMemberships.personId))
    .where(eq(rosterMemberships.teamId, teamId))
    .orderBy(desc(rosterMemberships.id));

  return rows.map((r) => ({
    ...r,
    since: rangeLower(r.period),
    until: rangeUpper(r.period),
    isCurrent: rangeIsOpen(r.period),
  }));
}
