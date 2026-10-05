/**
 * GC-Stats - match-list-data
 *
 * Query and filters for the public /matches list: status/region/category/date
 * filtering, sorting, pagination, and a fallback to the most recent matches
 * when the active filters match nothing, so the page never renders blank.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import {
  and,
  eq,
  gte,
  lt,
  inArray,
  isNotNull,
  sql,
  type SQL,
  type AnyColumn,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { unstable_cache } from "next/cache";
import { db } from "@gc-stats/db/client";
import {
  matches,
  entrants,
  tournaments,
  stages,
  stageContainers,
} from "@gc-stats/db";
import { normalizeRegion } from "@/lib/tournament-regions";
import { abbreviateTournamentName, type HomeMatch } from "@/lib/home-data";
import { buildTeamDisplayResolver } from "@/lib/historical-team-display";
import { formatSideScore } from "@/lib/match-score-format";
import { TOURNAMENT_FACETS_TAG } from "@/lib/cache-tags";
import { visibleTournament } from "@/lib/ghost-visibility";

export type MatchListStatus = "all" | "live" | "upcoming" | "finished";
export type MatchListSort = "date" | "tournament";
export type SortDirection = "asc" | "desc";

const PAGE_SIZE = 30;

type DbMatchStatus = "pending" | "live" | "completed";

// Same status collapsing as the home feed (MATCH_STATUS in home-data.ts):
// DB has pending/live/completed, the UI only ever shows live/upcoming/finished.
const STATUS_TO_DB: Record<Exclude<MatchListStatus, "all">, DbMatchStatus[]> = {
  live: ["live"],
  upcoming: ["pending"],
  finished: ["completed"],
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Shown instead of a blank page when the active filters match zero matches —
// an empty list reads as broken, the last N results at least prove the page
// still works and gives the visitor something to look at.
const FALLBACK_RESULTS_LIMIT = 30;

// TBD matches have no scheduled date: always last, whatever the direction.
function orderNullsLast(column: AnyColumn, direction: SortDirection): SQL {
  return direction === "asc"
    ? sql`${column} asc nulls last`
    : sql`${column} desc nulls last`;
}

type RawMatchRow = {
  id: number;
  status: DbMatchStatus;
  scheduledAt: Date | null;
  bestOf: number;
  label: string | null;
  scoreA: number | null;
  scoreB: number | null;
  entrantAId: number | null;
  entrantBId: number | null;
  aDisplayName: string;
  aTeamId: number | null;
  bDisplayName: string;
  bTeamId: number | null;
  region: string | null;
  tournamentName: string;
};

const entrantA = alias(entrants, "entrant_a");
const entrantB = alias(entrants, "entrant_b");

const listColumns = {
  id: matches.id,
  status: matches.status,
  scheduledAt: matches.scheduledAt,
  bestOf: matches.bestOf,
  label: matches.label,
  scoreA: matches.scoreA,
  scoreB: matches.scoreB,
  entrantAId: matches.entrantAId,
  entrantBId: matches.entrantBId,
  aDisplayName: entrantA.displayName,
  aTeamId: entrantA.teamId,
  bDisplayName: entrantB.displayName,
  bTeamId: entrantB.teamId,
  region: tournaments.region,
  tournamentName: tournaments.name,
};

// Both entrants are required to render a row, so inner joins drop nothing the list would show.
function selectListRows() {
  return db
    .select(listColumns)
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .innerJoin(entrantA, eq(entrantA.id, matches.entrantAId))
    .innerJoin(entrantB, eq(entrantB.id, matches.entrantBId));
}

// Region/category options, invalidated with the tournament facets.
const getMatchFacets = unstable_cache(
  async (): Promise<{ regions: string[]; categories: string[] }> => {
    const [regionRows, categoryRows] = await Promise.all([
      db
        .selectDistinct({ region: tournaments.region })
        .from(tournaments)
        .where(and(visibleTournament, sql`${tournaments.region} IS NOT NULL`)),
      db
        .selectDistinct({ category: tournaments.category })
        .from(tournaments)
        .where(and(visibleTournament, sql`${tournaments.category} IS NOT NULL`)),
    ]);
    return {
      regions: regionRows
        .map((r) => r.region!)
        .filter(Boolean)
        .sort(),
      categories: categoryRows
        .map((r) => r.category!)
        .filter(Boolean)
        .sort(),
    };
  },
  ["match-facets"],
  { tags: [TOURNAMENT_FACETS_TAG], revalidate: 3600 },
);

async function enrichMatchRows(rows: RawMatchRow[]): Promise<HomeMatch[]> {
  const resolver = await buildTeamDisplayResolver(
    rows
      .flatMap((r) => [r.aTeamId, r.bTeamId])
      .filter((id): id is number => id != null),
  );
  const side = (teamId: number | null, displayName: string, at: Date) => {
    if (teamId == null) {
      return { name: displayName, tag: "?", logoUrl: null, logoUrlLight: null };
    }
    const logos = resolver.logosAt(teamId, at);
    return {
      name: resolver.nameAt(teamId, at, displayName),
      tag: resolver.shortNameOf(teamId) ?? "?",
      logoUrl: logos.dark,
      logoUrlLight: logos.light,
    };
  };

  const homeMatches: HomeMatch[] = [];
  for (const m of rows) {
    if (!m.entrantAId || !m.entrantBId) continue;
    const at = m.scheduledAt ?? new Date();
    const a = side(m.aTeamId, m.aDisplayName, at);
    const b = side(m.bTeamId, m.bDisplayName, at);

    const status: HomeMatch["status"] =
      m.status === "live"
        ? "live"
        : m.status === "completed"
          ? "finished"
          : "upcoming";
    const leader =
      status === "upcoming" ||
      m.scoreA == null ||
      m.scoreB == null ||
      m.scoreA === m.scoreB
        ? null
        : m.scoreA > m.scoreB
          ? "a"
          : "b";

    homeMatches.push({
      id: m.id,
      status,
      time: m.scheduledAt ? m.scheduledAt.toISOString().slice(11, 16) : "",
      format: `BO${m.bestOf}`,
      region: normalizeRegion(m.region),
      aName: a.name,
      aTag: a.tag,
      aScore: formatSideScore(m.scoreA, m.entrantAId),
      aLogoUrl: a.logoUrl,
      aLogoUrlLight: a.logoUrlLight,
      bName: b.name,
      bTag: b.tag,
      bScore: formatSideScore(m.scoreB, m.entrantBId),
      bLogoUrl: b.logoUrl,
      bLogoUrlLight: b.logoUrlLight,
      leader,
      event: abbreviateTournamentName(m.tournamentName),
      stage: m.label ?? "",
      scheduledAt: m.scheduledAt ?? new Date(0),
    });
  }
  return homeMatches;
}

export async function listPublicMatches(opts: {
  status: MatchListStatus;
  region: string;
  category: string;
  dateFrom: string;
  dateTo: string;
  sort: MatchListSort;
  direction: SortDirection;
  page: number;
}): Promise<{
  rows: HomeMatch[];
  total: number;
  regions: string[];
  categories: string[];
  statusCounts: Record<MatchListStatus, number>;
  usedFallback: boolean;
  /** Requested page, clamped to the last one. */
  page: number;
}> {
  // Filters that narrow the counted set regardless of the status tab itself
  // (so switching status tabs never resets the region/category/date the user picked).
  // Matches without both entrants can't be rendered, filtered in SQL so counts and pages stay accurate.
  const baseConditions: SQL[] = [
    isNotNull(matches.entrantAId),
    isNotNull(matches.entrantBId),
    visibleTournament,
  ];
  if (opts.region) baseConditions.push(eq(tournaments.region, opts.region));
  if (opts.category)
    baseConditions.push(eq(tournaments.category, opts.category));
  // Filters on the match's own scheduled date (not the tournament's start/end
  // date) — a tournament can span weeks, but a match falls on exactly one day.
  // `dateTo` is inclusive of the whole day, hence `< dateTo + 1 day` rather
  // than `<= dateTo` (scheduledAt carries a time-of-day component).
  if (opts.dateFrom && DATE_RE.test(opts.dateFrom))
    baseConditions.push(
      gte(matches.scheduledAt, new Date(`${opts.dateFrom}T00:00:00.000Z`)),
    );
  if (opts.dateTo && DATE_RE.test(opts.dateTo)) {
    const upperBound = new Date(`${opts.dateTo}T00:00:00.000Z`);
    upperBound.setUTCDate(upperBound.getUTCDate() + 1);
    baseConditions.push(lt(matches.scheduledAt, upperBound));
  }
  const baseWhere = and(...baseConditions);

  const conditions: SQL[] = [...baseConditions];
  if (opts.status !== "all")
    conditions.push(inArray(matches.status, STATUS_TO_DB[opts.status]));
  const where = and(...conditions);

  const orderBys =
    opts.sort === "tournament"
      ? [
          orderNullsLast(tournaments.name, opts.direction),
          orderNullsLast(matches.scheduledAt, opts.direction),
        ]
      : [orderNullsLast(matches.scheduledAt, opts.direction)];

  const selectPage = (page: number) =>
    selectListRows()
      .where(where)
      .orderBy(...orderBys)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);

  const [requestedRows, facets, statusCountRows] =
    await Promise.all([
      selectPage(opts.page),
      getMatchFacets(),
      db
        .select({ status: matches.status, count: sql<number>`count(*)` })
        .from(matches)
        .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
        .innerJoin(stages, eq(stages.id, stageContainers.stageId))
        .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
        .where(baseWhere)
        .groupBy(matches.status),
    ]);

  const statusCounts: Record<MatchListStatus, number> = {
    all: 0,
    live: 0,
    upcoming: 0,
    finished: 0,
  };
  for (const r of statusCountRows) {
    const n = Number(r.count);
    statusCounts.all += n;
    if (r.status === "live") statusCounts.live += n;
    else if (r.status === "completed") statusCounts.finished += n;
    else statusCounts.upcoming += n;
  }
  const total = statusCounts[opts.status];
  const page = Math.min(opts.page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
  // Only an out of range page needs a second query.
  const rows = page === opts.page ? requestedRows : await selectPage(page);

  let homeMatches = await enrichMatchRows(rows);
  let usedFallback = false;

  // A dead-end filter combination (or just a quiet stretch with nothing
  // live/upcoming) must never render a blank page — fall back to the most
  // recent matches overall, filters dropped entirely, rather than "No match
  // matches these filters." with nothing else to look at.
  // Only when nothing matches at all, not for a page past the last one.
  if (homeMatches.length === 0 && total === 0) {
    const fallbackRows = await selectListRows()
      .where(and(isNotNull(matches.entrantAId), isNotNull(matches.entrantBId), visibleTournament))
      .orderBy(orderNullsLast(matches.scheduledAt, "desc"))
      .limit(FALLBACK_RESULTS_LIMIT);
    homeMatches = await enrichMatchRows(fallbackRows);
    usedFallback = homeMatches.length > 0;
  }

  return {
    rows: homeMatches,
    total,
    ...facets,
    statusCounts,
    usedFallback,
    page,
  };
}

export const MATCHES_PAGE_SIZE = PAGE_SIZE;
