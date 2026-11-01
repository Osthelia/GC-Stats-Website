/**
 * GC-Stats - stats-filters
 *
 * Shared query-param parsing for the player/team stats pages. GET filters,
 * not a mutation form, but still whitelisted/validated server-side before
 * hitting SQL rather than trusting raw strings, same principle as
 * `tournaments/page.tsx`'s sort/direction parsing.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type StatsSearchParams = Record<string, string | string[] | undefined>;

export type ParsedStatsFilters = {
  agent: string;
  map: string;
  days: "0" | "30" | "60";
  startDate: string;
  endDate: string;
};

/**
 * The query names of the two pick filters. The parsed filters and the filter bar keep the Valorant names for them
 * (`agent`, `map`); the URL uses the game's own names, so a shared LoL link reads `?champion=Ahri&role=MIDDLE`.
 */
export type StatsFilterParams = { agent: string; map: string };
export const VALORANT_STATS_FILTER_PARAMS: StatsFilterParams = { agent: "agent", map: "map" };
export const LEAGUE_STATS_FILTER_PARAMS: StatsFilterParams = { agent: "champion", map: "role" };

export type LeagueStatsFilters = Omit<ParsedStatsFilters, "agent" | "map"> & { champion: string; role: string };

export function leagueStatsFilters({ agent, map, ...dates }: ParsedStatsFilters): LeagueStatsFilters {
  return { ...dates, champion: agent, role: map };
}

const DAYS_VALUES = new Set(["0", "30", "60"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function raw(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function parseStatsFilters(searchParams: StatsSearchParams, params: StatsFilterParams = VALORANT_STATS_FILTER_PARAMS): ParsedStatsFilters {
  const days = raw(searchParams.days);
  const startDate = raw(searchParams.startDate);
  const endDate = raw(searchParams.endDate);

  return {
    agent: raw(searchParams[params.agent]),
    map: raw(searchParams[params.map]),
    days: DAYS_VALUES.has(days) ? (days as "0" | "30" | "60") : "0",
    startDate: DATE_RE.test(startDate) ? startDate : "",
    endDate: DATE_RE.test(endDate) ? endDate : "",
  };
}

/** Resolves the filters down to a concrete [from, to) date bound for the SQL query, or null for no date filter. */
export function resolveDateBounds(filters: Pick<ParsedStatsFilters, "days" | "startDate" | "endDate">): { from: Date | null; to: Date | null } {
  if (filters.startDate || filters.endDate) {
    return {
      from: filters.startDate ? new Date(`${filters.startDate}T00:00:00.000Z`) : null,
      to: filters.endDate ? new Date(`${filters.endDate}T23:59:59.999Z`) : null,
    };
  }
  if (filters.days !== "0") {
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - Number(filters.days));
    return { from, to: null };
  }
  return { from: null, to: null };
}
