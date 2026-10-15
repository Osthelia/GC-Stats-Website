import "server-only";

import { unstable_cache } from "next/cache";
import { and, asc, eq, exists, gte, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import { entrants, matches, teams, tournaments, stages, stageContainers } from "@gc-stats/db";
import { visibleTournament } from "@/lib/ghost-visibility";
import { slugify } from "@/lib/entity-id";
import { normalizeRegion, REGIONS } from "./tournament-regions";
import { TOURNAMENT_FACETS_TAG } from "@/lib/cache-tags";

export type CalendarFilters = {
  region: string;
  category: string;
  teamId?: number;
};

export function parseCalendarTeamId(value: string): number | undefined {
  if (!/^[1-9]\d*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}

export async function getCalendarTeam(teamId: number) {
  const [team] = await db.select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.isGhost, false)))
    .limit(1);
  return team ?? null;
}

function getTournamentFilters(filters: CalendarFilters) {
  const conditions = [eq(tournaments.active, true), visibleTournament];
  if (filters.region) conditions.push(eq(tournaments.region, filters.region));
  if (filters.category) conditions.push(eq(tournaments.category, filters.category));
  return and(...conditions);
}

export const getCalendarTournamentFacets = unstable_cache(
  async (): Promise<{ regions: string[]; categories: string[]; years: number[] }> => {
    const [regionRows, categoryRows, yearRows] = await Promise.all([
      db.selectDistinct({ region: tournaments.region }).from(tournaments).where(and(eq(tournaments.active, true), visibleTournament, sql`${tournaments.region} IS NOT NULL`)),
      db.selectDistinct({ category: tournaments.category }).from(tournaments).where(and(eq(tournaments.active, true), visibleTournament, sql`${tournaments.category} IS NOT NULL`)),
      db
        .selectDistinct({ year: sql<number>`EXTRACT(YEAR FROM ${tournaments.startDate})::int` })
        .from(tournaments)
        .where(and(eq(tournaments.active, true), visibleTournament)),
    ]);
    return {
      regions: regionRows.map((r) => r.region!).sort(),
      categories: categoryRows.map((r) => r.category!).sort(),
      years: yearRows.map((r) => r.year).sort((a, b) => b - a),
    };
  },
  ["calendar-tournament-facets"],
  { tags: [TOURNAMENT_FACETS_TAG], revalidate: 3600 },
);

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  color: string;
  extendedProps: { href: string, region?: string };
};

export function isCalendarMonth(value: string): boolean {
  return /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value);
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isCalendarMonth(value.slice(0, 7))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function offsetCalendarMonth(month: string, offset: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

const entrantA = alias(entrants, "calendar_entrant_a");
const entrantB = alias(entrants, "calendar_entrant_b");
const teamA = alias(teams, "calendar_team_a");
const teamB = alias(teams, "calendar_team_b");

export const getCalendarMonth = unstable_cache(async (month: string, filters: CalendarFilters): Promise<CalendarEvent[]> => {
  if (!isCalendarMonth(month)) throw new Error("Invalid calendar month");
  const from = `${month}-01`;
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const to = end.toISOString().slice(0, 10);
  const tournamentFilters = getTournamentFilters(filters);

  const [matchRows, tournamentRows] = await Promise.all([
    db.select({
      id: matches.id, scheduledAt: matches.scheduledAt,
      nameA: entrantA.displayName, nameB: entrantB.displayName,
      shortNameA: teamA.shortName, shortNameB: teamB.shortName,
    }).from(matches)
      .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
      .innerJoin(stages, eq(stages.id, stageContainers.stageId))
      .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
      .leftJoin(entrantA, eq(entrantA.id, matches.entrantAId))
      .leftJoin(entrantB, eq(entrantB.id, matches.entrantBId))
      .leftJoin(teamA, eq(teamA.id, entrantA.teamId))
      .leftJoin(teamB, eq(teamB.id, entrantB.teamId))
      .where(and(
        gte(matches.scheduledAt, start), lt(matches.scheduledAt, end),
        eq(stages.active, true), tournamentFilters,
        filters.teamId === undefined ? undefined : or(
          and(eq(entrantA.teamId, filters.teamId), eq(teamA.isGhost, false)),
          and(eq(entrantB.teamId, filters.teamId), eq(teamB.isGhost, false)),
        ),
      ))
      .orderBy(asc(matches.scheduledAt), asc(matches.id)),
    db.select({ id: tournaments.id, name: tournaments.name, start: tournaments.startDate, end: tournaments.endDate, region: tournaments.region })
      .from(tournaments)
      // Overlap rather than start year: includes tournaments spanning months or years.
      .where(and(
        lt(tournaments.startDate, to), gte(tournaments.endDate, from), tournamentFilters,
        filters.teamId === undefined ? undefined : exists(
          db.select({ id: entrants.id }).from(entrants)
            .innerJoin(teams, eq(teams.id, entrants.teamId))
            .where(and(
              eq(entrants.tournamentId, tournaments.id),
              eq(entrants.teamId, filters.teamId),
              eq(teams.isGhost, false),
            )),
        ),
      ))
      .orderBy(asc(tournaments.startDate), asc(tournaments.id)),
  ]);

  return [
    ...tournamentRows.map((tournament) => {
      const exclusiveEnd = new Date(`${tournament.end}T00:00:00Z`);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
      const regionMeta = REGIONS[normalizeRegion(tournament.region)];

      return {
        id: `tournament-${tournament.id}`,
        title: tournament.name,
        start: tournament.start,
        // FullCalendar's all-day end is exclusive; the database's is inclusive.
        end: exclusiveEnd.toISOString().slice(0, 10),
        allDay: true,
        color: regionMeta.color,
        extendedProps: { href: `/tournaments/${tournament.id}/${slugify(tournament.name, "tournament")}`, region: regionMeta.short },
      };
    }),
    ...matchRows.map((match) => ({
      id: `match-${match.id}`,
      title: `${match.shortNameA || match.nameA || "TBD"} vs ${match.shortNameB || match.nameB || "TBD"}`,
      start: match.scheduledAt!.toISOString(),
      allDay: false,
      color: "#d32d50",
      extendedProps: { href: `/match/${match.id}` },
    })),
  ];
}, ["calendar-month"], { revalidate: 60, tags: [TOURNAMENT_FACETS_TAG] });
