/**
 * GC-Stats - admin-roster-watch
 *
 * Admin queries for /admin/roster-watch: the signal tabs with their filters
 * and counters, and the followed X accounts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, count, desc, eq, gte, ilike, ne, or, type SQL } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { users, xMonitoredAccounts, xRosterSignals, type XSignalMedia, valorantTables } from "@gc-stats/db";
import { getCurrentLogoUrls } from "@/lib/admin-logos";
import { ROSTER_WATCH_PERIODS, TOPICS, type SignalStatus, type Stage, type Topic, type Verdict } from "@/lib/roster-watch/constants";

const { teams } = valorantTables;

export const ROSTER_WATCH_PAGE_SIZE = 20;

export const ROSTER_WATCH_TABS = ["roster", "unsure", "done"] as const;
export type RosterWatchTab = (typeof ROSTER_WATCH_TABS)[number];

export const ROSTER_WATCH_SORTS = ["tweetedAt", "team"] as const;
export type RosterWatchSort = (typeof ROSTER_WATCH_SORTS)[number];
export type SortDirection = "asc" | "desc";

export type RosterWatchFilters = {
  tab: RosterWatchTab;
  q: string;
  period: (typeof ROSTER_WATCH_PERIODS)[number] | "";
  topic: Topic | "";
  sort: RosterWatchSort;
  direction: SortDirection;
  page: number;
};

export type RosterWatchRow = {
  id: number;
  teamId: number;
  teamName: string;
  teamLogoUrl: string | null;
  tweetUrl: string;
  text: string;
  /** English translation, null for tweets classified before translations existed. */
  textEn: string | null;
  media: XSignalMedia[];
  tweetedAt: string;
  stage: Stage;
  exclusionRuleId: string | null;
  verdict: Verdict | null;
  topic: Topic | null;
  players: string[];
  llmReason: string | null;
  status: SignalStatus;
  reviewTopic: string | null;
  reviewNote: string | null;
  reviewedByUsername: string | null;
  reviewedAt: string | null;
};

function tabCondition(tab: RosterWatchTab): SQL | undefined {
  switch (tab) {
    case "roster":
      return and(eq(xRosterSignals.verdict, "roster"), eq(xRosterSignals.status, "pending"));
    case "unsure":
      return and(eq(xRosterSignals.verdict, "unsure"), eq(xRosterSignals.status, "pending"));
    case "done":
      return ne(xRosterSignals.status, "pending");
  }
}

export function parseTopic(value: string | undefined): Topic | "" {
  return (TOPICS as readonly string[]).includes(value ?? "") ? (value as Topic) : "";
}

export async function listRosterWatchSignals(filters: RosterWatchFilters): Promise<{ rows: RosterWatchRow[]; total: number }> {
  const conditions: (SQL | undefined)[] = [tabCondition(filters.tab)];
  if (filters.q) {
    const pattern = `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(or(ilike(xRosterSignals.text, pattern), ilike(teams.name, pattern)));
  }
  if (filters.topic) conditions.push(eq(xRosterSignals.topic, filters.topic));
  if (filters.period) conditions.push(gte(xRosterSignals.tweetedAt, new Date(Date.now() - Number(filters.period) * 86_400_000)));
  const where = and(...conditions);
  const order = filters.direction === "asc" ? asc : desc;
  const orderBy = filters.sort === "team" ? [order(teams.name), desc(xRosterSignals.tweetedAt)] : [order(xRosterSignals.tweetedAt), order(xRosterSignals.id)];

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: xRosterSignals.id,
        teamId: xRosterSignals.teamId,
        teamName: teams.name,
        tweetUrl: xRosterSignals.tweetUrl,
        text: xRosterSignals.text,
        textEn: xRosterSignals.textEn,
        media: xRosterSignals.media,
        tweetedAt: xRosterSignals.tweetedAt,
        stage: xRosterSignals.stage,
        exclusionRuleId: xRosterSignals.exclusionRuleId,
        verdict: xRosterSignals.verdict,
        topic: xRosterSignals.topic,
        players: xRosterSignals.players,
        llmReason: xRosterSignals.llmReason,
        status: xRosterSignals.status,
        reviewTopic: xRosterSignals.reviewTopic,
        reviewNote: xRosterSignals.reviewNote,
        reviewedByUsername: users.username,
        reviewedAt: xRosterSignals.reviewedAt,
      })
      .from(xRosterSignals)
      .innerJoin(teams, eq(teams.id, xRosterSignals.teamId))
      .leftJoin(users, eq(users.id, xRosterSignals.reviewedBy))
      .where(where)
      .orderBy(...orderBy)
      .limit(ROSTER_WATCH_PAGE_SIZE)
      .offset((filters.page - 1) * ROSTER_WATCH_PAGE_SIZE),
    db.select({ n: count() }).from(xRosterSignals).innerJoin(teams, eq(teams.id, xRosterSignals.teamId)).where(where),
  ]);

  const logos = await getCurrentLogoUrls("team", [...new Set(rows.map((row) => row.teamId))], "valorant");

  return {
    total: totalRow?.n ?? 0,
    rows: rows.map((row) => ({
      ...row,
      stage: row.stage as Stage,
      verdict: row.verdict as Verdict | null,
      topic: row.topic as Topic | null,
      status: row.status as SignalStatus,
      teamLogoUrl: logos.get(row.teamId) ?? null,
      tweetedAt: row.tweetedAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    })),
  };
}

export async function getRosterWatchTabCounts(): Promise<Record<RosterWatchTab, number>> {
  const [[rosterRow], [unsureRow], [doneRow]] = await Promise.all([
    db.select({ n: count() }).from(xRosterSignals).where(tabCondition("roster")),
    db.select({ n: count() }).from(xRosterSignals).where(tabCondition("unsure")),
    db.select({ n: count() }).from(xRosterSignals).where(tabCondition("done")),
  ]);
  return { roster: rosterRow?.n ?? 0, unsure: unsureRow?.n ?? 0, done: doneRow?.n ?? 0 };
}

export type MonitoredAccountRow = {
  id: number;
  teamId: number;
  teamName: string;
  xHandle: string;
  enabled: boolean;
  lastPolledAt: string | null;
  lastError: string | null;
};

export async function listMonitoredAccounts(): Promise<MonitoredAccountRow[]> {
  const rows = await db
    .select({
      id: xMonitoredAccounts.id,
      teamId: xMonitoredAccounts.teamId,
      teamName: teams.name,
      xHandle: xMonitoredAccounts.xHandle,
      enabled: xMonitoredAccounts.enabled,
      lastPolledAt: xMonitoredAccounts.lastPolledAt,
      lastError: xMonitoredAccounts.lastError,
    })
    .from(xMonitoredAccounts)
    .innerJoin(teams, eq(teams.id, xMonitoredAccounts.teamId))
    .orderBy(teams.name);
  return rows.map((row) => ({ ...row, lastPolledAt: row.lastPolledAt?.toISOString() ?? null }));
}
