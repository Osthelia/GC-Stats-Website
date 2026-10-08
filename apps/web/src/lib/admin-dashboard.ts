/**
 * GC-Stats - admin-dashboard
 *
 * Queries powering the /admin dashboard widgets: tournaments by status,
 * recent/live matches, and recent team/player activity log entries.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, count, desc, eq, gte, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { adminDb as db } from "@gc-stats/db/client";
import { matches, entrants, tournaments, stageContainers, stages, activityLog, teams, people, users } from "@gc-stats/db";
import { getCurrentLogoUrlsThemed } from "@/lib/admin-logos";

const DASHBOARD_WIDGET_LIMIT = 5;

export type DashboardTournamentRow = {
  id: number;
  name: string;
  region: string | null;
  startDate: string;
  active: boolean;
};

export type DashboardTournamentTab = "live" | "upcoming" | "inactive";

export type DashboardPage<T> = { rows: T[]; total: number; page: number; totalPages: number };

const PENDING_MATCH_WINDOW_DAYS = 7;

/** Clamps the requested page to the available range and returns the matching offset. */
function resolvePage(requested: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / DASHBOARD_WIDGET_LIMIT));
  const page = Math.min(Math.max(1, requested), totalPages);
  return { page, totalPages, offset: (page - 1) * DASHBOARD_WIDGET_LIMIT };
}

const tournamentTabFilters: Record<DashboardTournamentTab, SQL> = {
  live: eq(tournaments.status, "live"),
  upcoming: eq(tournaments.status, "upcoming"),
  inactive: eq(tournaments.active, false),
};

/** Same 3 buckets as V1's admin dashboard tabs (live/upcoming/inactive), one paginated tab at a time. */
export async function getDashboardTournaments(tab: DashboardTournamentTab, requestedPage: number): Promise<DashboardPage<DashboardTournamentRow>> {
  const where = tournamentTabFilters[tab];
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(tournaments).where(where);
  const { page, totalPages, offset } = resolvePage(requestedPage, total);
  const rows = await db
    .select({ id: tournaments.id, name: tournaments.name, region: tournaments.region, startDate: tournaments.startDate, active: tournaments.active })
    .from(tournaments)
    .where(where)
    .orderBy(desc(tournaments.startDate), desc(tournaments.id))
    .limit(DASHBOARD_WIDGET_LIMIT)
    .offset(offset);
  return { rows, total, page, totalPages };
}

export type DashboardMatchRow = {
  id: number;
  tournamentId: number;
  tournamentName: string;
  status: "pending" | "live" | "completed";
  scheduledAt: string | null;
  scoreA: number | null;
  scoreB: number | null;
  aName: string;
  bName: string;
  aLogoUrl: string | null;
  bLogoUrl: string | null;
};

/** Live matches always, then pending ones scheduled in the future or less than 7 days ago. Live first, then by date. */
export async function getDashboardRecentMatches(requestedPage: number): Promise<DashboardPage<DashboardMatchRow>> {
  const entrantA = alias(entrants, "dash_entrant_a");
  const entrantB = alias(entrants, "dash_entrant_b");

  const pendingSince = new Date(Date.now() - PENDING_MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const where = or(
    and(eq(matches.status, "live"), or(isNull(matches.scheduledAt), sql`${matches.scheduledAt} > '1900-01-01'`)),
    and(eq(matches.status, "pending"), gte(matches.scheduledAt, pendingSince)),
  );

  const [{ total } = { total: 0 }] = await db
    .select({ total: count() })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(where);
  const { page, totalPages, offset } = resolvePage(requestedPage, total);

  const rows = await db
    .select({
      id: matches.id,
      status: matches.status,
      scheduledAt: matches.scheduledAt,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      aTeamId: entrantA.teamId,
      aName: entrantA.displayName,
      bTeamId: entrantB.teamId,
      bName: entrantB.displayName,
    })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .leftJoin(entrantA, eq(entrantA.id, matches.entrantAId))
    .leftJoin(entrantB, eq(entrantB.id, matches.entrantBId))
    .where(where)
    .orderBy(sql`case when ${matches.status} = 'live' then 0 else 1 end`, asc(matches.scheduledAt), asc(matches.id))
    .limit(DASHBOARD_WIDGET_LIMIT)
    .offset(offset);

  const teamIds = [...new Set(rows.flatMap((r) => [r.aTeamId, r.bTeamId]).filter((id): id is number => id != null))];
  const logos = await getCurrentLogoUrlsThemed("team", teamIds);

  const mapped = rows.map((r) => ({
    id: r.id,
    tournamentId: r.tournamentId,
    tournamentName: r.tournamentName,
    status: r.status,
    scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
    scoreA: r.scoreA,
    scoreB: r.scoreB,
    aName: r.aName ?? "?",
    bName: r.bName ?? "?",
    aLogoUrl: (r.aTeamId != null ? logos.get(r.aTeamId)?.dark : null) ?? null,
    bLogoUrl: (r.bTeamId != null ? logos.get(r.bTeamId)?.dark : null) ?? null,
  }));
  return { rows: mapped, total, page, totalPages };
}

export type DashboardModificationRow = {
  id: number;
  subjectId: number | null;
  subjectName: string | null;
  subjectLogoUrl: string | null;
  event: string | null;
  causerUsername: string | null;
  createdAt: string;
};

/**
 * Recent team/player edits — same widget as V1's dashboard-modifications-widget.blade.php,
 * reading activity_log the same way (logName + subjectType). Rows are written
 * by the edit actions through lib/activity-log.ts.
 */
export async function getDashboardModifications(subjectType: "team" | "player", requestedPage: number): Promise<DashboardPage<DashboardModificationRow>> {
  const where = and(eq(activityLog.logName, subjectType), eq(activityLog.subjectType, subjectType));
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(activityLog).where(where);
  const { page, totalPages, offset } = resolvePage(requestedPage, total);

  const rows = await db
    .select({
      id: activityLog.id,
      subjectId: activityLog.subjectId,
      event: activityLog.event,
      properties: activityLog.properties,
      createdAt: activityLog.createdAt,
    })
    .from(activityLog)
    .where(where)
    .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
    .limit(DASHBOARD_WIDGET_LIMIT)
    .offset(offset);

  const subjectIds = [...new Set(rows.map((r) => (r.subjectId ? Number(r.subjectId) : null)).filter((id): id is number => id != null))];
  const actorUserIds = [...new Set(rows.map((r) => (r.properties as { actorUserId?: string } | null)?.actorUserId).filter((id): id is string => !!id))];

  const [subjectRows, logos, actorRows] = await Promise.all([
    subjectIds.length
      ? subjectType === "team"
        ? db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, subjectIds))
        : db.select({ id: people.id, name: people.handle }).from(people).where(inArray(people.id, subjectIds))
      : Promise.resolve([]),
    subjectIds.length ? getCurrentLogoUrlsThemed(subjectType === "team" ? "team" : "person", subjectIds) : Promise.resolve(new Map()),
    actorUserIds.length ? db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, actorUserIds)) : Promise.resolve([]),
  ]);
  const subjectById = new Map(subjectRows.map((s) => [s.id, s.name]));
  const actorById = new Map(actorRows.map((a) => [a.id, a.username]));

  const mapped = rows.map((r) => {
    const subjectId = r.subjectId ? Number(r.subjectId) : null;
    const actorUserId = (r.properties as { actorUserId?: string } | null)?.actorUserId ?? null;
    return {
      id: r.id,
      subjectId,
      subjectName: subjectId != null ? (subjectById.get(subjectId) ?? null) : null,
      subjectLogoUrl: subjectId != null ? (logos.get(subjectId)?.dark ?? null) : null,
      event: r.event,
      causerUsername: actorUserId ? (actorById.get(actorUserId) ?? null) : null,
      createdAt: r.createdAt.toISOString(),
    };
  });
  return { rows: mapped, total, page, totalPages };
}
