/**
 * GC-Stats - registry
 *
 * Builds the zod-to-openapi registry for the public `/api/v1` surface:
 * registers every schema and route so the OpenAPI document can be generated.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { OpenAPIRegistry, type ResponseConfig, type RouteConfig } from "@asteasolutions/zod-to-openapi";
import { z } from "./zod";
import {
  ErrorResponseSchema,
  ApiPlayerFullResponseSchema,
  ApiPlayerTeamHistorySchema,
  ApiLogoHistoryResponseSchema,
  ApiAgentStatsEntrySchema,
  ApiWeaponStatsEntrySchema,
  ApiAvgStatsSchema,
  ApiTeamResponseSchema,
  ApiTeamPlayersResponseSchema,
  ApiTeamVetoEntrySchema,
  ApiTeamMapEntrySchema,
  ApiTeamStatsResponseSchema,
  ApiPaginatedTeamMatchesSchema,
  idPathParamSchema,
  namePathParamSchema,
  mapsFilterQuerySchema,
  statsFilterQuerySchema,
  matchHistoryFilterQuerySchema,
  ApiTournamentFullResponseSchema,
  ApiMatchFullResponseSchema,
  ApiMatchStatsResponseSchema,
  ApiMatchV3ResponseSchema,
  ApiMapFullResponseSchema,
  ApiRoundFullResponseSchema,
  ApiTeamFullResponseV2Schema,
  ApiPlayerFullResponseV2Schema,
  ApiPaginatedStaffTournamentsSchema,
  paginationQuerySchema,
  ApiTournamentFullResponseV2Schema,
  ApiTournamentMapEntrySchema,
  ApiTournamentStatsEntrySchema,
  tournamentMatchesFilterQuerySchema,
  tournamentScopeFilterQuerySchema,
  tournamentStatsFilterQuerySchema,
  teamMatchesFilterQuerySchema,
  teamMapsFilterQuerySchema,
  ApiOrganizationFullResponseV2Schema,
  ApiPaginatedVodsSchema,
  vodsFilterQuerySchema,
  ApiPaginatedNewsSchema,
  newsFilterQuerySchema,
  ApiPaginatedTeamMatchesSchema as ApiPaginatedMatchesSchema,
  matchesFilterQuerySchema,
  ApiPaginatedTeamsSchema,
  teamsListFilterQuerySchema,
  ApiPaginatedPlayersSchema,
  playersListFilterQuerySchema,
  ApiPaginatedTournamentsSchema,
  tournamentsListFilterQuerySchema,
  ApiSearchResultsSchema,
  searchFilterQuerySchema,
} from "./schemas";

export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "ApiKeyAuth", {
  type: "apiKey",
  in: "header",
  name: "x-api-key",
  description: "API key issued from the dashboard, sent on every request.",
});

function jsonResponseSchema(schema: z.ZodTypeAny, description: string): ResponseConfig {
  return { description, content: { "application/json": { schema } } };
}

const UNAUTHORIZED: ResponseConfig = jsonResponseSchema(ErrorResponseSchema, "Missing or invalid x-api-key header.");
const RATE_LIMITED: ResponseConfig = jsonResponseSchema(ErrorResponseSchema, "Rate limit exceeded for this API key.");
const BAD_REQUEST: ResponseConfig = jsonResponseSchema(ErrorResponseSchema, "A path or query parameter failed validation.");
const NOT_FOUND: ResponseConfig = jsonResponseSchema(ErrorResponseSchema, "No resource matches the given id.");

const commonResponses = { 400: BAD_REQUEST, 401: UNAUTHORIZED, 429: RATE_LIMITED };

type RegisterOpts = {
  method: "get";
  path: string;
  summary: string;
  /** Extra doc body below the summary — used to call out a non-default ratelimit cost (see `../../v2/rate-limit-costs.ts`). */
  description?: string;
  tags: string[];
  request?: RouteConfig["request"];
  response: ResponseConfig;
  notFound?: boolean;
};

function registerRoute({ method, path, summary, description, tags, request, response, notFound }: RegisterOpts) {
  registry.registerPath({
    method,
    path,
    summary,
    description,
    tags,
    security: [{ ApiKeyAuth: [] }],
    request,
    responses: {
      200: response,
      ...commonResponses,
      ...(notFound ? { 404: NOT_FOUND } : {}),
    },
  });
}

const idParams = z.object({ id: idPathParamSchema });
const nameParams = z.object({ name: namePathParamSchema });

registerRoute({
  method: "get",
  path: "/v1/players/by-name/{name}",
  summary: "Search players by handle (V1)",
  tags: ["Players"],
  request: { params: nameParams },
  response: jsonResponseSchema(z.array(ApiPlayerFullResponseSchema), "Up to 20 players whose handle starts with the given name."),
});

registerRoute({
  method: "get",
  path: "/v1/players/{id}",
  summary: "Get a player by id (V1)",
  tags: ["Players"],
  request: { params: idParams },
  response: jsonResponseSchema(ApiPlayerFullResponseSchema, "The player."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v1/players/{id}/teams",
  summary: "Get a player's team history (V1)",
  tags: ["Players"],
  request: { params: idParams },
  response: jsonResponseSchema(z.array(ApiPlayerTeamHistorySchema), "The player's roster stints, most recent first."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v1/players/{id}/photos",
  summary: "Get a player's photo history (V1)",
  tags: ["Players"],
  request: { params: idParams },
  response: jsonResponseSchema(ApiLogoHistoryResponseSchema, "The player's current photo plus its history."),
});

registerRoute({
  method: "get",
  path: "/v1/players/{id}/stats",
  summary: "Get a player's average stats (V1)",
  tags: ["Players"],
  request: { params: idParams, query: statsFilterQuerySchema },
  response: jsonResponseSchema(ApiAvgStatsSchema, "Average stats across the player's recorded maps, broken down by side."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v1/players/{id}/agents",
  summary: "Get a player's per agent stats (V1)",
  tags: ["Players"],
  request: { params: idParams, query: mapsFilterQuerySchema },
  response: jsonResponseSchema(z.array(ApiAgentStatsEntrySchema), "Stats and pickrate for each agent the player has used."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v1/players/{id}/weapons",
  summary: "Get a player's weapon stats (V1)",
  tags: ["Players"],
  request: { params: idParams, query: mapsFilterQuerySchema },
  response: jsonResponseSchema(z.array(ApiWeaponStatsEntrySchema), "Kills and rounds held for each weapon the player has used."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v1/teams/by-name/{name}",
  summary: "Search teams by name (V1)",
  tags: ["Teams"],
  request: { params: nameParams },
  response: jsonResponseSchema(z.array(ApiTeamResponseSchema), "Up to 10 teams whose name or short name starts with the given name."),
});

registerRoute({
  method: "get",
  path: "/v1/teams/{id}",
  summary: "Get a team by id (V1)",
  tags: ["Teams"],
  request: { params: idParams },
  response: jsonResponseSchema(ApiTeamResponseSchema, "The team."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v1/teams/{id}/players",
  summary: "Get a team's roster (V1)",
  tags: ["Teams"],
  request: { params: idParams },
  response: jsonResponseSchema(ApiTeamPlayersResponseSchema, "The team's current and past players."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v1/teams/{id}/logos",
  summary: "Get a team's logo history (V1)",
  tags: ["Teams"],
  request: { params: idParams },
  response: jsonResponseSchema(ApiLogoHistoryResponseSchema, "The team's current logo plus its history."),
});

registerRoute({
  method: "get",
  path: "/v1/teams/{id}/vetos",
  summary: "Get a team's map veto stats (V1)",
  tags: ["Teams"],
  request: { params: idParams, query: mapsFilterQuerySchema },
  response: jsonResponseSchema(z.array(ApiTeamVetoEntrySchema), "Times played, banned, picked and left as decider, per map."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v1/teams/{id}/maps",
  summary: "Get a team's map stats (V1)",
  tags: ["Teams"],
  request: { params: idParams, query: mapsFilterQuerySchema },
  response: jsonResponseSchema(z.array(ApiTeamMapEntrySchema), "Winrate per map, broken down by side and by comp."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v1/teams/{id}/weapons",
  summary: "Get a team's weapon stats (V1)",
  tags: ["Teams"],
  request: { params: idParams, query: mapsFilterQuerySchema },
  response: jsonResponseSchema(z.array(ApiWeaponStatsEntrySchema), "Kills and rounds held for each weapon across the team's entrants."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v1/teams/{id}/stats",
  summary: "Get a team's average stats (V1)",
  tags: ["Teams"],
  request: { params: idParams, query: statsFilterQuerySchema },
  response: jsonResponseSchema(ApiTeamStatsResponseSchema, "Average stats broken down by side, plus XvY situations and post plant winrate."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v1/teams/{id}/matches",
  summary: "Get a team's match history (V1)",
  tags: ["Teams"],
  request: { params: idParams, query: matchHistoryFilterQuerySchema },
  response: jsonResponseSchema(ApiPaginatedTeamMatchesSchema, "Paginated match history, most recent first, each with its map vetoes in order."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v1/tournaments/by-name/{name}",
  summary: "Search tournaments by name (V1)",
  tags: ["Tournaments"],
  request: { params: nameParams },
  response: jsonResponseSchema(z.array(ApiTournamentFullResponseSchema), "Up to 20 tournaments whose name starts with the given name."),
});

registerRoute({
  method: "get",
  path: "/v1/tournaments/{id}",
  summary: "Get a tournament by id (V1)",
  tags: ["Tournaments"],
  request: { params: idParams },
  response: jsonResponseSchema(ApiTournamentFullResponseSchema, "The tournament, with its stages."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v1/tournaments/{id}/logos",
  summary: "Get a tournament's logo history (V1)",
  tags: ["Tournaments"],
  request: { params: idParams },
  response: jsonResponseSchema(ApiLogoHistoryResponseSchema, "The tournament's current logo plus its history."),
});

registerRoute({
  method: "get",
  path: "/v1/matches/{id}",
  summary: "Get a match by id (V1)",
  tags: ["Matches"],
  request: { params: idParams },
  response: jsonResponseSchema(ApiMatchFullResponseSchema, "The match, its maps and its map vetoes."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/matches/{id}",
  summary: "Get a match's full stats (V2)",
  tags: ["Matches"],
  request: { params: idParams },
  response: jsonResponseSchema(ApiMatchStatsResponseSchema, "The match with per map aggregated player stats and a full round by round breakdown."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v3/matches/{id}",
  summary: "Get a match's full stats, encounters, radar chart widget link and pick'em votes (V3)",
  tags: ["Matches"],
  request: { params: idParams },
  response: jsonResponseSchema(
    ApiMatchV3ResponseSchema,
    "The V2 match response, plus past head to head encounters, a link to the OBS head to head radar chart widget, and the pick'em vote split.",
  ),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v1/map/{id}",
  summary: "Get a map by id (V1)",
  tags: ["Maps"],
  request: { params: idParams },
  response: jsonResponseSchema(ApiMapFullResponseSchema, "The map, with its per player stats."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v1/map/{id}/rounds",
  summary: "Get a map's round by round breakdown (V1)",
  tags: ["Maps"],
  request: { params: idParams },
  response: jsonResponseSchema(z.array(ApiRoundFullResponseSchema), "Each round of the map, with its per player stats."),
  notFound: true,
});

const RATELIMIT_COST_10 = "Ratelimit cost: 10 per call (bundles achievements, roster, last matches and press in one response).";

registerRoute({
  method: "get",
  path: "/v2/teams/{id}",
  summary: "Get a team's full profile (V2)",
  description: RATELIMIT_COST_10,
  tags: ["Teams"],
  request: { params: idParams },
  response: jsonResponseSchema(ApiTeamFullResponseV2Schema, "The team plus its Liquipedia link, themed logos, achievements, last 20 matches, current roster, last 10 tournaments (placement, W/L) and last 10 press articles."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/teams/by-name/{name}",
  summary: "Search teams by name, full profile (V2)",
  description: RATELIMIT_COST_10,
  tags: ["Teams"],
  request: { params: nameParams },
  response: jsonResponseSchema(z.array(ApiTeamFullResponseV2Schema), "Teams whose name or short name starts with the given string, each with its full V2 profile."),
});

registerRoute({
  method: "get",
  path: "/v2/teams/{id}/matches",
  summary: "Get a team's match history (V2)",
  tags: ["Teams"],
  request: { params: idParams, query: teamMatchesFilterQuerySchema },
  response: jsonResponseSchema(ApiPaginatedTeamMatchesSchema, "Same as /v1/teams/{id}/matches, with an added round_name filter."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/teams/by-name/{name}/matches",
  summary: "Get a team's match history, resolved by name (V2)",
  tags: ["Teams"],
  request: { params: nameParams, query: teamMatchesFilterQuerySchema },
  response: jsonResponseSchema(ApiPaginatedTeamMatchesSchema, "Same as /v2/teams/{id}/matches, for the first team whose name or short name starts with the given string."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/teams/{id}/maps",
  summary: "Get a team's map stats (V2)",
  tags: ["Teams"],
  request: { params: idParams, query: teamMapsFilterQuerySchema },
  response: jsonResponseSchema(z.array(ApiTeamMapEntrySchema), "Same as /v1/teams/{id}/maps, with added round_name and phase_id filters."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/teams/by-name/{name}/maps",
  summary: "Get a team's map stats, resolved by name (V2)",
  tags: ["Teams"],
  request: { params: nameParams, query: teamMapsFilterQuerySchema },
  response: jsonResponseSchema(z.array(ApiTeamMapEntrySchema), "Same as /v2/teams/{id}/maps, for the first team whose name or short name starts with the given string."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/players/{id}",
  summary: "Get a player's full profile (V2)",
  description: RATELIMIT_COST_10,
  tags: ["Players"],
  request: { params: idParams },
  response: jsonResponseSchema(ApiPlayerFullResponseV2Schema, "The player plus their Liquipedia link, claimed flag, themed photo, achievements, last 20 matches, current and past teams (name and logos at the time, plus current name), last 10 tournaments (placement, W/L) and last 10 press articles."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/players/by-name/{name}",
  summary: "Search players by handle, full profile (V2)",
  description: RATELIMIT_COST_10,
  tags: ["Players"],
  request: { params: nameParams },
  response: jsonResponseSchema(z.array(ApiPlayerFullResponseV2Schema), "Players whose handle starts with the given string, each with their full V2 profile."),
});

registerRoute({
  method: "get",
  path: "/v2/players/{id}/matches",
  summary: "Get a player's match history (V2)",
  tags: ["Players"],
  request: { params: idParams, query: teamMatchesFilterQuerySchema },
  response: jsonResponseSchema(ApiPaginatedTeamMatchesSchema, "Paginated match history for matches this player is confirmed to have played, most recent first."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/players/by-name/{name}/matches",
  summary: "Get a player's match history, resolved by name (V2)",
  tags: ["Players"],
  request: { params: nameParams, query: teamMatchesFilterQuerySchema },
  response: jsonResponseSchema(ApiPaginatedTeamMatchesSchema, "Same as /v2/players/{id}/matches, for the first player whose handle starts with the given string."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/players/{id}/staff-tournaments",
  summary: "Get the tournaments a player followed as team staff (V2)",
  tags: ["Players"],
  request: { params: idParams, query: paginationQuerySchema },
  response: jsonResponseSchema(ApiPaginatedStaffTournamentsSchema, "Tournaments played by a team while this person held a staff role on it (coach, analyst, manager, etc.), most recent first. W/L is the team's, on decided matches."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/players/by-name/{name}/staff-tournaments",
  summary: "Get the tournaments a player followed as team staff, resolved by name (V2)",
  tags: ["Players"],
  request: { params: nameParams, query: paginationQuerySchema },
  response: jsonResponseSchema(ApiPaginatedStaffTournamentsSchema, "Same as /v2/players/{id}/staff-tournaments, for the first player whose handle starts with the given string."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/players/{id}/stats",
  summary: "Get a player's average stats (V2)",
  tags: ["Players"],
  request: { params: idParams, query: statsFilterQuerySchema },
  response: jsonResponseSchema(ApiAvgStatsSchema, "Same as /v1/players/{id}/stats."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/players/by-name/{name}/stats",
  summary: "Get a player's average stats, resolved by name (V2)",
  tags: ["Players"],
  request: { params: nameParams, query: statsFilterQuerySchema },
  response: jsonResponseSchema(ApiAvgStatsSchema, "Same as /v2/players/{id}/stats, for the first player whose handle starts with the given string."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/tournaments/{id}",
  summary: "Get a tournament's full profile (V2)",
  tags: ["Tournaments"],
  request: { params: idParams },
  response: jsonResponseSchema(ApiTournamentFullResponseV2Schema, "The tournament plus its Liquipedia link, themed logos, stages (each with its own Liquipedia link) and entrants with their locked roster."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/tournaments/by-name/{name}",
  summary: "Search tournaments by name, full profile (V2)",
  tags: ["Tournaments"],
  request: { params: nameParams },
  response: jsonResponseSchema(z.array(ApiTournamentFullResponseV2Schema), "Tournaments whose name starts with the given string, each with its full V2 profile."),
});

registerRoute({
  method: "get",
  path: "/v2/tournaments/{id}/matches",
  summary: "Get a tournament's match history (V2)",
  tags: ["Tournaments"],
  request: { params: idParams, query: tournamentMatchesFilterQuerySchema },
  response: jsonResponseSchema(ApiPaginatedTeamMatchesSchema, "Paginated match history for the whole tournament, most recent first, each with its map vetoes in order."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/tournaments/by-name/{name}/matches",
  summary: "Get a tournament's match history, resolved by name (V2)",
  tags: ["Tournaments"],
  request: { params: nameParams, query: tournamentMatchesFilterQuerySchema },
  response: jsonResponseSchema(ApiPaginatedTeamMatchesSchema, "Same as /v2/tournaments/{id}/matches, for the first tournament whose name starts with the given string."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/tournaments/{id}/maps",
  summary: "Get a tournament's map pool stats (V2)",
  tags: ["Tournaments"],
  request: { params: idParams, query: tournamentScopeFilterQuerySchema },
  response: jsonResponseSchema(z.array(ApiTournamentMapEntrySchema), "Times played and comps per map across the tournament, plus a team's own winrate on it when `team_id` is given."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/tournaments/by-name/{name}/maps",
  summary: "Get a tournament's map pool stats, resolved by name (V2)",
  tags: ["Tournaments"],
  request: { params: nameParams, query: tournamentScopeFilterQuerySchema },
  response: jsonResponseSchema(z.array(ApiTournamentMapEntrySchema), "Same as /v2/tournaments/{id}/maps, for the first tournament whose name starts with the given string."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/tournaments/{id}/stats",
  summary: "Get a tournament's per player stats (V2)",
  tags: ["Tournaments"],
  request: { params: idParams, query: tournamentStatsFilterQuerySchema },
  response: jsonResponseSchema(z.array(ApiTournamentStatsEntrySchema), "One row per player who played in the tournament, aggregated across their maps."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/tournaments/by-name/{name}/stats",
  summary: "Get a tournament's per player stats, resolved by name (V2)",
  tags: ["Tournaments"],
  request: { params: nameParams, query: tournamentStatsFilterQuerySchema },
  response: jsonResponseSchema(z.array(ApiTournamentStatsEntrySchema), "Same as /v2/tournaments/{id}/stats, for the first tournament whose name starts with the given string."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/organization/{id}",
  summary: "Get an organization's full profile (V2)",
  description: RATELIMIT_COST_10,
  tags: ["Organizations"],
  request: { params: idParams },
  response: jsonResponseSchema(ApiOrganizationFullResponseV2Schema, "The organization plus its themed logos, members (current/former), stream channels, last 10 VODs and last 10 press articles."),
  notFound: true,
});

registerRoute({
  method: "get",
  path: "/v2/organization/by-name/{name}",
  summary: "Search organizations by name, full profile (V2)",
  description: RATELIMIT_COST_10,
  tags: ["Organizations"],
  request: { params: nameParams },
  response: jsonResponseSchema(z.array(ApiOrganizationFullResponseV2Schema), "Organizations whose name starts with the given string, each with its full V2 profile."),
});

registerRoute({
  method: "get",
  path: "/v2/vods",
  summary: "List VODs (V2)",
  tags: ["VODs"],
  request: { query: vodsFilterQuerySchema },
  response: jsonResponseSchema(ApiPaginatedVodsSchema, "Paginated VOD listing, most recent match first, each with its match and publishing organization."),
});

registerRoute({
  method: "get",
  path: "/v2/news",
  summary: "List published news articles (V2)",
  tags: ["News"],
  request: { query: newsFilterQuerySchema },
  response: jsonResponseSchema(ApiPaginatedNewsSchema, "Paginated published news listing, most recent first."),
});

registerRoute({
  method: "get",
  path: "/v2/matches",
  summary: "List matches (V2)",
  tags: ["Matches"],
  request: { query: matchesFilterQuerySchema },
  response: jsonResponseSchema(ApiPaginatedMatchesSchema, "Paginated match listing, most recent first, each with its vetoes in order."),
});

registerRoute({
  method: "get",
  path: "/v2/teams",
  summary: "List teams (V2)",
  tags: ["Teams"],
  request: { query: teamsListFilterQuerySchema },
  response: jsonResponseSchema(ApiPaginatedTeamsSchema, "Paginated team listing, sorted by name."),
});

registerRoute({
  method: "get",
  path: "/v2/players",
  summary: "List players (V2)",
  tags: ["Players"],
  request: { query: playersListFilterQuerySchema },
  response: jsonResponseSchema(ApiPaginatedPlayersSchema, "Paginated player listing, sorted by handle."),
});

registerRoute({
  method: "get",
  path: "/v2/tournaments",
  summary: "List tournaments (V2)",
  tags: ["Tournaments"],
  request: { query: tournamentsListFilterQuerySchema },
  response: jsonResponseSchema(ApiPaginatedTournamentsSchema, "Paginated tournament listing."),
});

registerRoute({
  method: "get",
  path: "/v2/search",
  summary: "Search teams, players, tournaments and organizations (V2)",
  tags: ["Search"],
  request: { query: searchFilterQuerySchema },
  response: jsonResponseSchema(ApiSearchResultsSchema, "Up to `limit` best matching results per entity type, same ranking as the site's search."),
});
