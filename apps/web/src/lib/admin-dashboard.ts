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

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
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

/** Same 3 buckets as V1's admin dashboard tabs (live/upcoming/inactive) — see resources/views/admin/dashboard.blade.php. */
export async function getDashboardTournaments(): Promise<{ live: DashboardTournamentRow[]; upcoming: DashboardTournamentRow[]; inactive: DashboardTournamentRow[] }> {
  const cols = { id: tournaments.id, name: tournaments.name, region: tournaments.region, startDate: tournaments.startDate, active: tournaments.active };
  const [live, upcoming, inactive] = await Promise.all([
    db.select(cols).from(tournaments).where(eq(tournaments.status, "live")).orderBy(desc(tournaments.startDate)).limit(DASHBOARD_WIDGET_LIMIT),
    db.select(cols).from(tournaments).where(eq(tournaments.status, "upcoming")).orderBy(desc(tournaments.startDate)).limit(DASHBOARD_WIDGET_LIMIT),
    db.select(cols).from(tournaments).where(eq(tournaments.active, false)).orderBy(desc(tournaments.startDate)).limit(DASHBOARD_WIDGET_LIMIT),
  ]);
  return { live, upcoming, inactive };
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

/** Live matches first, then soonest upcoming — mirrors V1's `orderByRaw("FIELD(status, 'live', 'upcoming')")`. */
export async function getDashboardRecentMatches(): Promise<DashboardMatchRow[]> {
  const entrantA = alias(entrants, "dash_entrant_a");
  const entrantB = alias(entrants, "dash_entrant_b");

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
    // `scheduled_at`'s "unknown date" sentinel (1899-12-31 23:50:39, migrated
    // verbatim from MySQL's zero-date, mirrors V1's MatchDisplay::UNKNOWN_DATE)
    // is excluded the same way V1's dashboard query did — no V2-wide helper
    // for this sentinel exists yet, worth revisiting if it surfaces elsewhere.
    .where(and(inArray(matches.status, ["live", "pending"]), sql`(${matches.scheduledAt} is null or ${matches.scheduledAt} > '1900-01-01')`))
    .orderBy(sql`case when ${matches.status} = 'live' then 0 else 1 end`, asc(matches.scheduledAt))
    .limit(DASHBOARD_WIDGET_LIMIT);

  const teamIds = [...new Set(rows.flatMap((r) => [r.aTeamId, r.bTeamId]).filter((id): id is number => id != null))];
  const logos = await getCurrentLogoUrlsThemed("team", teamIds);

  return rows.map((r) => ({
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
 * reading activity_log the same way (logName + subjectType). Sparser than V1 for
 * ordinary edits: V2 has no automatic per-save activity logging (V1 had it via
 * Spatie's LogsActivity trait on every model) — only team/player merges and the
 * auto-activation scheduled job currently write logName='team'/'player' rows, see
 * actions/admin-team-merge.ts, actions/admin-player-merge.ts, lib/scheduled-jobs/log-auto-activation.ts.
 * Widget still reads the real table rather than a stub, so it fills in as more
 * write paths start logging.
 */
export async function getDashboardModifications(subjectType: "team" | "player"): Promise<DashboardModificationRow[]> {
  const rows = await db
    .select({
      id: activityLog.id,
      subjectId: activityLog.subjectId,
      event: activityLog.event,
      properties: activityLog.properties,
      createdAt: activityLog.createdAt,
    })
    .from(activityLog)
    .where(and(eq(activityLog.logName, subjectType), eq(activityLog.subjectType, subjectType)))
    .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
    .limit(DASHBOARD_WIDGET_LIMIT);

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

  return rows.map((r) => {
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
}
