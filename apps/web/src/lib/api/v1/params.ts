/**
 * GC-Stats - params
 *
 * Shared parsing and validation helpers for API v1 path/query params
 * (ids, dates, pagination), throwing `ApiV1Error` on invalid input.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { ApiV1Error } from "./handler";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Escapes Postgres `LIKE`/`ILIKE` wildcards, mirroring the Rust API's `util::escape_like`. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, "\\$&");
}

export function parsePathId(raw: string, name = "id"): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new ApiV1Error(400, `Invalid "${name}": expected a positive integer`);
  return value;
}

export function parseDateParam(searchParams: URLSearchParams, name: string): string | undefined {
  const raw = searchParams.get(name);
  if (!raw) return undefined;
  if (!DATE_RE.test(raw)) throw new ApiV1Error(400, `Invalid "${name}": expected YYYY-MM-DD`);
  return raw;
}

/** `to` is a calendar date but timestamps have time-of-day — the caller wants the exclusive upper bound (`to` + 1 day) to include all of `to` itself. */
export function exclusiveUpperBound(date: string): Date {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export function parsePositiveIntParam(searchParams: URLSearchParams, name: string): number | undefined {
  const raw = searchParams.get(name);
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new ApiV1Error(400, `Invalid "${name}": expected a positive integer`);
  return value;
}

export type MapsFilter = { from?: string; to?: string; tournamentId?: number };

export function parseMapsFilter(searchParams: URLSearchParams): MapsFilter {
  return {
    from: parseDateParam(searchParams, "from"),
    to: parseDateParam(searchParams, "to"),
    tournamentId: parsePositiveIntParam(searchParams, "tournament_id"),
  };
}

export type StatsFilter = MapsFilter & { agent?: string };

export function parseStatsFilter(searchParams: URLSearchParams): StatsFilter {
  const agent = searchParams.get("agent")?.trim();
  return { ...parseMapsFilter(searchParams), agent: agent || undefined };
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export type MatchHistoryFilter = MapsFilter & {
  opponentId?: number;
  status?: string;
  stageId?: number;
  roundName?: string;
  page: number;
  perPage: number;
};

// V2's own vocabulary (matches.status enum) — kept as-is rather than forcing
// V1's upcoming/live/finished strings, cf. plan's "match.status" decision.
const VALID_MATCH_STATUSES = new Set(["pending", "live", "completed"]);

function parseStatusParam(searchParams: URLSearchParams): string | undefined {
  const raw = searchParams.get("status")?.trim();
  if (!raw) return undefined;
  if (!VALID_MATCH_STATUSES.has(raw)) throw new ApiV1Error(400, `Invalid "status": expected one of ${[...VALID_MATCH_STATUSES].join(", ")}`);
  return raw;
}

/** `phase_id` kept as the query param name (V1 contract) even though it now scopes a V2 `stages` row. */
export function parseMatchHistoryFilter(searchParams: URLSearchParams): MatchHistoryFilter {
  return {
    ...parseMapsFilter(searchParams),
    opponentId: parsePositiveIntParam(searchParams, "opponent_id"),
    status: parseStatusParam(searchParams),
    stageId: parsePositiveIntParam(searchParams, "phase_id"),
    page: parsePositiveIntParam(searchParams, "page") ?? 1,
    perPage: Math.min(parsePositiveIntParam(searchParams, "per_page") ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}
