import "server-only";

import { unstable_cache } from "next/cache";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import { entrants, matches, teams, tournaments } from "@gc-stats/db";
import { visibleMatch, visibleTournament } from "@/lib/ghost-visibility";
import { slugify } from "@/lib/entity-id";
import { normalizeRegion, REGIONS } from "./tournament-regions";

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  color: string;
  extendedProps: { href: string };
};

export function isCalendarMonth(value: string): boolean {
  return /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value);
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

// The month argument is part of the cache key. Adjacent page navigations
// reuse their overlapping months without a browser-side data cache.
export const getCalendarMonth = unstable_cache(async (month: string): Promise<CalendarEvent[]> => {
  if (!isCalendarMonth(month)) throw new Error("Invalid calendar month");
  const from = `${month}-01`;
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const to = end.toISOString().slice(0, 10);

  const [matchRows, tournamentRows] = await Promise.all([
    db.select({
      id: matches.id, scheduledAt: matches.scheduledAt,
      nameA: entrantA.displayName, nameB: entrantB.displayName,
      shortNameA: teamA.shortName, shortNameB: teamB.shortName,
    }).from(matches)
      .leftJoin(entrantA, eq(entrantA.id, matches.entrantAId))
      .leftJoin(entrantB, eq(entrantB.id, matches.entrantBId))
      .leftJoin(teamA, eq(teamA.id, entrantA.teamId))
      .leftJoin(teamB, eq(teamB.id, entrantB.teamId))
      .where(and(gte(matches.scheduledAt, start), lt(matches.scheduledAt, end), visibleMatch))
      .orderBy(asc(matches.scheduledAt), asc(matches.id)),
    db.select({ id: tournaments.id, name: tournaments.name, start: tournaments.startDate, end: tournaments.endDate, region: tournaments.region })
      .from(tournaments)
      // Overlap rather than start year: includes tournaments spanning months or years.
      // TODO: filter out not active tournaments
      .where(and(lt(tournaments.startDate, to), gte(tournaments.endDate, from), visibleTournament,))
      .orderBy(asc(tournaments.startDate), asc(tournaments.id)),
  ]);

  return [
    ...tournamentRows.map((tournament) => {
      const exclusiveEnd = new Date(`${tournament.end}T00:00:00Z`);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
      
      const regionMeta = REGIONS[normalizeRegion(tournament.region)];
      const contrastColor = regionMeta.short === "INT" || regionMeta.short === "CN" ? "var(--color-neutral-200)" : "var(--color-neutral-900)"

      return {
        id: `tournament-${tournament.id}`,
        title: tournament.name,
        start: tournament.start,
        // FullCalendar's all-day end is exclusive; the database's is inclusive.
        end: exclusiveEnd.toISOString().slice(0, 10),
        allDay: true,
        color: regionMeta.color,
        contrastColor,
        extendedProps: { href: `/tournaments/${tournament.id}/${slugify(tournament.name, "tournament")}` },
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
}, ["calendar-month"], { revalidate: 60 });
