/**
 * GC-Stats - maps-filters
 *
 * Query-param filters of the team/tournament "Maps" tabs (tournament + date range).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { maps, matches, stageContainers, stages } from "@gc-stats/db";

export type MapsFilters = { tournamentId: number | null; dateFrom: string; dateTo: string };

export const EMPTY_MAPS_FILTERS: MapsFilters = { tournamentId: null, dateFrom: "", dateTo: "" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function raw(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function isValidDate(v: unknown): v is string {
  return typeof v === "string" && DATE_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00.000Z`));
}

function parseId(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n > 0 && n <= 2_147_483_647 ? n : null;
}

/** Invalid values are dropped rather than trusted. */
export function parseMapsFilters(sp: Record<string, string | string[] | undefined>): MapsFilters {
  const dateFrom = raw(sp.dateFrom);
  const dateTo = raw(sp.dateTo);
  const tournament = raw(sp.tournament);
  return {
    tournamentId: tournament ? parseId(tournament) : null,
    dateFrom: isValidDate(dateFrom) ? dateFrom : "",
    dateTo: isValidDate(dateTo) ? dateTo : "",
  };
}

/** Strict check for filters coming from a server action payload. */
export function isValidMapsFilters(v: unknown): v is MapsFilters {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Record<string, unknown>;
  return (
    (f.tournamentId === null || parseId(f.tournamentId) !== null) &&
    (f.dateFrom === "" || isValidDate(f.dateFrom)) &&
    (f.dateTo === "" || isValidDate(f.dateTo))
  );
}

export function mapsFiltersHref(basePath: string, filters: MapsFilters, overrides: Partial<MapsFilters> = {}): string {
  const next = { ...filters, ...overrides };
  const qs = new URLSearchParams();
  if (next.tournamentId != null) qs.set("tournament", String(next.tournamentId));
  if (next.dateFrom) qs.set("dateFrom", next.dateFrom);
  if (next.dateTo) qs.set("dateTo", next.dateTo);
  const s = qs.toString();
  return `${basePath}${s ? `?${s}` : ""}`;
}

/** SQL conditions for a query already joining `maps` and `matches`. */
export function mapsFilterConditions(filters: MapsFilters): SQL[] {
  // An unplayed map (decider of a decided series) is completed but has no score.
  const conditions: SQL[] = [isNotNull(maps.teamAScore), isNotNull(maps.teamBScore)];
  // A map without its own start time falls back to the match schedule.
  const playedAt = sql`coalesce(${maps.startedAt}, ${matches.scheduledAt})`;
  if (filters.dateFrom) conditions.push(sql`${playedAt} >= ${`${filters.dateFrom}T00:00:00.000Z`}::timestamptz`);
  if (filters.dateTo) conditions.push(sql`${playedAt} <= ${`${filters.dateTo}T23:59:59.999Z`}::timestamptz`);
  if (filters.tournamentId != null) {
    conditions.push(
      inArray(
        matches.containerId,
        db.select({ id: stageContainers.id }).from(stageContainers).innerJoin(stages, eq(stages.id, stageContainers.stageId)).where(eq(stages.tournamentId, filters.tournamentId)),
      ),
    );
  }
  return conditions;
}
