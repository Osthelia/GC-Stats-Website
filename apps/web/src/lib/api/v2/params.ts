/**
 * GC-Stats - params
 *
 * Query param parsing for the API v2 surface, layered on top of the v1
 * parsers for pagination, date and scope filters specific to v2 endpoints.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { parseDateParam, parsePositiveIntParam, parseMapsFilter, type MapsFilter, type MatchHistoryFilter } from "../v1/params";
import { ApiV1Error } from "../v1/handler";

/** Filters shared by every V2 tournament scoped sub-endpoint (matches/maps/stats) — team/round/phase/date, the tournament id itself always comes from the path. */
export type TournamentScopeFilter = {
  from?: string;
  to?: string;
  teamId?: number;
  roundName?: string;
  stageId?: number;
};

function parseTournamentScopeFilter(searchParams: URLSearchParams): TournamentScopeFilter {
  return {
    from: parseDateParam(searchParams, "from"),
    to: parseDateParam(searchParams, "to"),
    teamId: parsePositiveIntParam(searchParams, "team_id"),
    roundName: searchParams.get("round_name")?.trim() || undefined,
    stageId: parsePositiveIntParam(searchParams, "phase_id"),
  };
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const VALID_MATCH_STATUSES = new Set(["pending", "live", "completed"]);

export type TournamentMatchesFilter = TournamentScopeFilter & { status?: string; page: number; perPage: number };

export function parseTournamentMatchesFilter(searchParams: URLSearchParams): TournamentMatchesFilter {
  const status = searchParams.get("status")?.trim() || undefined;
  if (status && !VALID_MATCH_STATUSES.has(status)) throw new ApiV1Error(400, `Invalid "status": expected one of ${[...VALID_MATCH_STATUSES].join(", ")}`);

  return {
    ...parseTournamentScopeFilter(searchParams),
    status,
    page: parsePositiveIntParam(searchParams, "page") ?? 1,
    perPage: Math.min(parsePositiveIntParam(searchParams, "per_page") ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

export type TournamentMapsFilter = TournamentScopeFilter;

export function parseTournamentMapsFilter(searchParams: URLSearchParams): TournamentMapsFilter {
  return parseTournamentScopeFilter(searchParams);
}

export type TournamentStatsFilter = TournamentScopeFilter & { agent?: string; role?: string; nationality?: string };

/** Team scoped matches/maps sub endpoints — `getTeamMatches`/`getTeamMaps` (`../v1/queries/teams.ts`) widened with `round_name`, kept consistent with the tournament scoped filters above. */

export type TeamMatchesFilter = MatchHistoryFilter & { roundName?: string };

export function parseTeamMatchesFilter(searchParams: URLSearchParams): TeamMatchesFilter {
  const status = searchParams.get("status")?.trim() || undefined;
  if (status && !VALID_MATCH_STATUSES.has(status)) throw new ApiV1Error(400, `Invalid "status": expected one of ${[...VALID_MATCH_STATUSES].join(", ")}`);

  return {
    ...parseMapsFilter(searchParams),
    opponentId: parsePositiveIntParam(searchParams, "opponent_id"),
    status,
    stageId: parsePositiveIntParam(searchParams, "phase_id"),
    roundName: searchParams.get("round_name")?.trim() || undefined,
    page: parsePositiveIntParam(searchParams, "page") ?? 1,
    perPage: Math.min(parsePositiveIntParam(searchParams, "per_page") ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

export type TeamMapsFilter = MapsFilter & { roundName?: string; stageId?: number };

export function parseTeamMapsFilter(searchParams: URLSearchParams): TeamMapsFilter {
  return {
    ...parseMapsFilter(searchParams),
    roundName: searchParams.get("round_name")?.trim() || undefined,
    stageId: parsePositiveIntParam(searchParams, "phase_id"),
  };
}

const VALID_ROSTER_ROLES = new Set(["player", "player-igl", "sub", "coach", "assistant coach", "performance coach", "analyst", "manager"]);

export function parseTournamentStatsFilter(searchParams: URLSearchParams): TournamentStatsFilter {
  const role = searchParams.get("role")?.trim() || undefined;
  if (role && !VALID_ROSTER_ROLES.has(role)) throw new ApiV1Error(400, `Invalid "role": expected one of ${[...VALID_ROSTER_ROLES].join(", ")}`);

  return {
    ...parseTournamentScopeFilter(searchParams),
    agent: searchParams.get("agent")?.trim() || undefined,
    role,
    nationality: searchParams.get("nationality")?.trim().toUpperCase() || undefined,
  };
}

/** Global listing endpoints (`/v2/vods`, `/v2/news`) — same date range + pagination vocabulary as everything else, entity filters scoped to what each table can actually join on. */

export type VodsFilter = {
  from?: string;
  to?: string;
  tournamentId?: number;
  teamId?: number;
  organizationId?: number;
  matchId?: number;
  languageCode?: string;
  page: number;
  perPage: number;
};

export function parseVodsFilter(searchParams: URLSearchParams): VodsFilter {
  return {
    from: parseDateParam(searchParams, "from"),
    to: parseDateParam(searchParams, "to"),
    tournamentId: parsePositiveIntParam(searchParams, "tournament_id"),
    teamId: parsePositiveIntParam(searchParams, "team_id"),
    organizationId: parsePositiveIntParam(searchParams, "organization_id"),
    matchId: parsePositiveIntParam(searchParams, "match_id"),
    languageCode: searchParams.get("language_code")?.trim() || undefined,
    page: parsePositiveIntParam(searchParams, "page") ?? 1,
    perPage: Math.min(parsePositiveIntParam(searchParams, "per_page") ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

export type NewsFilter = {
  from?: string;
  to?: string;
  lang?: string;
  organizationId?: number;
  teamId?: number;
  personId?: number;
  tournamentId?: number;
  page: number;
  perPage: number;
};

export function parseNewsFilter(searchParams: URLSearchParams): NewsFilter {
  return {
    from: parseDateParam(searchParams, "from"),
    to: parseDateParam(searchParams, "to"),
    lang: searchParams.get("lang")?.trim() || undefined,
    organizationId: parsePositiveIntParam(searchParams, "organization_id"),
    teamId: parsePositiveIntParam(searchParams, "team_id"),
    personId: parsePositiveIntParam(searchParams, "person_id"),
    tournamentId: parsePositiveIntParam(searchParams, "tournament_id"),
    page: parsePositiveIntParam(searchParams, "page") ?? 1,
    perPage: Math.min(parsePositiveIntParam(searchParams, "per_page") ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

/** Global match listing (`/v2/matches`) — always paginated, `team_id` matches either side, same vocabulary as the tournament/team scoped matches endpoints. */

export type MatchesFilter = {
  from?: string;
  to?: string;
  teamId?: number;
  tournamentId?: number;
  stageId?: number;
  roundName?: string;
  status?: string;
  page: number;
  perPage: number;
};

export function parseMatchesFilter(searchParams: URLSearchParams): MatchesFilter {
  const status = searchParams.get("status")?.trim() || undefined;
  if (status && !VALID_MATCH_STATUSES.has(status)) throw new ApiV1Error(400, `Invalid "status": expected one of ${[...VALID_MATCH_STATUSES].join(", ")}`);

  return {
    from: parseDateParam(searchParams, "from"),
    to: parseDateParam(searchParams, "to"),
    teamId: parsePositiveIntParam(searchParams, "team_id"),
    tournamentId: parsePositiveIntParam(searchParams, "tournament_id"),
    stageId: parsePositiveIntParam(searchParams, "phase_id"),
    roundName: searchParams.get("round_name")?.trim() || undefined,
    status,
    page: parsePositiveIntParam(searchParams, "page") ?? 1,
    perPage: Math.min(parsePositiveIntParam(searchParams, "per_page") ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

/** Global team/player listings (`/v2/teams`, `/v2/players`) — a name/handle prefix search, not the fuzzy multi-type `searchGlobal` (see `/v2/search`). */

export type ListSortDirection = "asc" | "desc";

export type TeamsListFilter = { name?: string; countryCode?: string; isActive?: boolean; direction: ListSortDirection; page: number; perPage: number };

function parseBooleanParam(searchParams: URLSearchParams, name: string): boolean | undefined {
  const raw = searchParams.get(name)?.trim();
  if (!raw) return undefined;
  if (raw !== "true" && raw !== "false") throw new ApiV1Error(400, `Invalid "${name}": expected "true" or "false"`);
  return raw === "true";
}

function parseDirectionParam(searchParams: URLSearchParams): ListSortDirection {
  const raw = searchParams.get("direction")?.trim();
  if (!raw) return "asc";
  if (raw !== "asc" && raw !== "desc") throw new ApiV1Error(400, 'Invalid "direction": expected "asc" or "desc"');
  return raw;
}

export function parseTeamsListFilter(searchParams: URLSearchParams): TeamsListFilter {
  return {
    name: searchParams.get("name")?.trim() || undefined,
    countryCode: searchParams.get("country_code")?.trim().toUpperCase() || undefined,
    isActive: parseBooleanParam(searchParams, "is_active"),
    direction: parseDirectionParam(searchParams),
    page: parsePositiveIntParam(searchParams, "page") ?? 1,
    perPage: Math.min(parsePositiveIntParam(searchParams, "per_page") ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

export type PlayersListFilter = { handle?: string; countryCode?: string; isActive?: boolean; direction: ListSortDirection; page: number; perPage: number };

export function parsePlayersListFilter(searchParams: URLSearchParams): PlayersListFilter {
  return {
    handle: searchParams.get("handle")?.trim() || undefined,
    countryCode: searchParams.get("country_code")?.trim().toUpperCase() || undefined,
    isActive: parseBooleanParam(searchParams, "is_active"),
    direction: parseDirectionParam(searchParams),
    page: parsePositiveIntParam(searchParams, "page") ?? 1,
    perPage: Math.min(parsePositiveIntParam(searchParams, "per_page") ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

/** Global tournament listing (`/v2/tournaments`) — same region/category/year vocabulary as the public `/tournaments` page (`lib/tournament-list-data.ts`), `active` left optional so the API can also list past/inactive tournaments the public page always hides. */

export type TournamentsListSort = "date" | "name";

export type TournamentsListFilter = {
  region?: string;
  category?: string;
  year?: number;
  active?: boolean;
  sort: TournamentsListSort;
  direction: ListSortDirection;
  page: number;
  perPage: number;
};

export function parseTournamentsListFilter(searchParams: URLSearchParams): TournamentsListFilter {
  const sortParam = searchParams.get("sort")?.trim();
  if (sortParam && sortParam !== "date" && sortParam !== "name") throw new ApiV1Error(400, 'Invalid "sort": expected "date" or "name"');
  const sort: TournamentsListSort = sortParam === "name" ? "name" : "date";
  const directionParam = searchParams.get("direction")?.trim();
  if (directionParam && directionParam !== "asc" && directionParam !== "desc") throw new ApiV1Error(400, 'Invalid "direction": expected "asc" or "desc"');
  const direction: ListSortDirection = directionParam === "asc" || directionParam === "desc" ? directionParam : sort === "name" ? "asc" : "desc";

  return {
    region: searchParams.get("region")?.trim() || undefined,
    category: searchParams.get("category")?.trim() || undefined,
    year: parsePositiveIntParam(searchParams, "year"),
    active: parseBooleanParam(searchParams, "active"),
    sort,
    direction,
    page: parsePositiveIntParam(searchParams, "page") ?? 1,
    perPage: Math.min(parsePositiveIntParam(searchParams, "per_page") ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

/** Global multi-type search (`/v2/search`) — thin wrapper over `searchGlobal` (`lib/search.ts`), same one behind the site's header dropdown/`/search` page. */

export type SearchFilter = { q: string; limit: number };

const MAX_SEARCH_LIMIT = 20;
const DEFAULT_SEARCH_LIMIT = 5;

export function parseSearchFilter(searchParams: URLSearchParams): SearchFilter {
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) throw new ApiV1Error(400, 'Invalid "q": expected at least 2 characters');
  return { q, limit: Math.min(parsePositiveIntParam(searchParams, "limit") ?? DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT) };
}

export type PaginationFilter = { page: number; perPage: number };

export function parsePaginationFilter(searchParams: URLSearchParams): PaginationFilter {
  return {
    page: parsePositiveIntParam(searchParams, "page") ?? 1,
    perPage: Math.min(parsePositiveIntParam(searchParams, "per_page") ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}
