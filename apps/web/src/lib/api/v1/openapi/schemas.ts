/**
 * GC-Stats - schemas
 *
 * OpenAPI schemas for the public `/api/v1` surface, mirrored from the runtime
 * types in `../entities.ts`, `../logo-response.ts`, `../avg-stats.ts`,
 * `../weapon-stats.ts` and `../queries/{teams,players}.ts`. Documentation
 * only, the runtime routes keep validating through `../params.ts`.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { z } from "./zod";

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "Invalid \"id\": expected a positive integer" }),
  })
  .openapi("ErrorResponse");

export const ApiTeamSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    short_name: z.string().nullable(),
    country_code: z.string().nullable(),
    socials: z.record(z.string(), z.unknown()),
    bio: z.string().nullable(),
    vlr_id: z.number().int().nullable(),
    is_active: z.boolean(),
  })
  .openapi("Team");

export const ApiPlayerSchema = z
  .object({
    id: z.number().int(),
    handle: z.string(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    country_code: z.string().nullable(),
    bio: z.string().nullable(),
    socials: z.record(z.string(), z.unknown()),
    vlr_id: z.number().int().nullable(),
    is_active: z.boolean(),
  })
  .openapi("Player");

export const ApiLogoUrlsSchema = z
  .object({
    url_200x200: z.string().nullable(),
    url_full: z.string().nullable(),
  })
  .openapi("LogoUrls");

export const ApiLogoEntrySchema = z
  .object({
    uuid: z.string(),
    url_200x200: z.string().nullable(),
    url_full: z.string().nullable(),
    from: z.string().nullable(),
    until: z.string().nullable(),
  })
  .openapi("LogoEntry");

export const ApiLogoHistoryResponseSchema = z
  .object({
    current: ApiLogoEntrySchema.nullable(),
    history: z.array(ApiLogoEntrySchema),
  })
  .openapi("LogoHistoryResponse");

export const ApiTeamResponseSchema = ApiTeamSchema.extend({
  logo: ApiLogoUrlsSchema.nullable(),
}).openapi("TeamResponse");

export const ApiPlayerFullResponseSchema = ApiPlayerSchema.extend({
  current_team: ApiTeamSchema.nullable(),
  photo: ApiLogoUrlsSchema.nullable(),
}).openapi("PlayerResponse");

export const ApiPlayerTeamHistorySchema = z
  .object({
    team_id: z.number().int(),
    team_name: z.string(),
    team_short_name: z.string().nullable(),
    team_country: z.string().nullable(),
    role: z.string(),
    joined_at: z.string().nullable(),
    left_at: z.string().nullable(),
  })
  .openapi("PlayerTeamHistoryEntry");

export const ApiTeamPlayersResponseSchema = z
  .object({
    current: z.array(ApiPlayerSchema),
    history: z.array(ApiPlayerSchema),
  })
  .openapi("TeamPlayersResponse");

export const ApiAgentStatsEntrySchema = z
  .object({
    agent_name: z.string(),
    maps_played: z.number().int(),
    pickrate: z.number(),
    total_kills: z.number(),
    avg_kills: z.number(),
    total_deaths: z.number(),
    avg_deaths: z.number(),
    total_assists: z.number(),
    avg_assists: z.number(),
    total_acs: z.number(),
    avg_acs: z.number(),
    total_adr: z.number(),
    avg_adr: z.number(),
    total_kast_percentage: z.number(),
    avg_kast_percentage: z.number(),
    total_headshot_percentage: z.number(),
    avg_headshot_percentage: z.number(),
    total_first_kills: z.number(),
    avg_first_kills: z.number(),
    total_first_deaths: z.number(),
    avg_first_deaths: z.number(),
    kd_ratio: z.number(),
  })
  .openapi("AgentStatsEntry");

export const ApiWeaponStatsEntrySchema = z
  .object({
    weapon: z.string(),
    times_played: z.number().int().nullable(),
    kills: z.number().int(),
  })
  .openapi("WeaponStatsEntry");

export const ApiTeamVetoEntrySchema = z
  .object({
    map_name: z.string(),
    played: z.number().int(),
    banned: z.number().int(),
    pick: z.number().int(),
    decider: z.number().int(),
  })
  .openapi("TeamVetoEntry");

export const ApiSideWinrateSchema = z
  .object({
    rounds_played: z.number().int(),
    rounds_won: z.number().int(),
    winrate: z.number(),
  })
  .openapi("SideWinrate");

export const ApiCompEntrySchema = z
  .object({
    comp: z.array(z.string()),
    times_played: z.number().int(),
    wins: z.number().int(),
    losses: z.number().int(),
    winrate: z.number(),
    atk: ApiSideWinrateSchema,
    def: ApiSideWinrateSchema,
  })
  .openapi("CompEntry");

/** Round win rate per economy tier (loadout value spent) — same tiers as the match page (eco/semi_eco/semi_buy/full_buy). */
export const ApiEcoBreakdownSchema = z
  .object({
    eco: ApiSideWinrateSchema,
    semi_eco: ApiSideWinrateSchema,
    semi_buy: ApiSideWinrateSchema,
    full_buy: ApiSideWinrateSchema,
  })
  .openapi("EcoBreakdown");

export const ApiTeamMapEntrySchema = z
  .object({
    map_name: z.string(),
    times_played: z.number().int(),
    wins: z.number().int(),
    losses: z.number().int(),
    winrate: z.number(),
    atk: ApiSideWinrateSchema,
    def: ApiSideWinrateSchema,
    eco: ApiEcoBreakdownSchema,
    comps: z.array(ApiCompEntrySchema),
  })
  .openapi("TeamMapEntry");

export const ApiSideStatsSchema = z
  .object({
    side: z.enum(["atk", "def"]),
    rounds_played: z.number().int(),
    rounds_won: z.number().int(),
    round_winrate: z.number(),
    total_kills: z.number(),
    avg_kills_per_round: z.number(),
    total_assists: z.number(),
    avg_assists_per_round: z.number(),
    total_score: z.number(),
    avg_acs_per_round: z.number(),
    total_damage: z.number(),
    avg_adr_per_round: z.number(),
    total_headshots: z.number(),
    total_bodyshots: z.number(),
    total_legshots: z.number(),
    headshot_percentage: z.number(),
    first_kills: z.number(),
    first_deaths: z.number(),
  })
  .openapi("SideStats");

export const ApiAvgStatsSchema = z
  .object({
    maps_played: z.number().int(),
    total_kills: z.number(),
    avg_kills: z.number(),
    total_deaths: z.number(),
    avg_deaths: z.number(),
    total_assists: z.number(),
    avg_assists: z.number(),
    total_acs: z.number(),
    avg_acs: z.number(),
    total_adr: z.number(),
    avg_adr: z.number(),
    total_kast_percentage: z.number(),
    avg_kast_percentage: z.number(),
    total_headshot_percentage: z.number(),
    avg_headshot_percentage: z.number(),
    total_first_kills: z.number(),
    avg_first_kills: z.number(),
    total_first_deaths: z.number(),
    avg_first_deaths: z.number(),
    kd_ratio: z.number(),
    by_side: z.object({ atk: ApiSideStatsSchema, def: ApiSideStatsSchema }),
  })
  .openapi("AvgStats");

export const ApiSituationEntrySchema = z
  .object({
    played: z.number().int(),
    won: z.number().int(),
    winrate: z.number(),
  })
  .openapi("SituationEntry");

const situationsBySideSchema = z.record(z.string(), ApiSituationEntrySchema).openapi({
  description: "Keyed by \"<your alive count>v<enemy alive count>\" (e.g. \"3v2\"), from 0v0 to 5v5.",
});

export const ApiSideSituationsSchema = z
  .object({
    atk: situationsBySideSchema,
    def: situationsBySideSchema,
  })
  .openapi("SideSituations");

export const ApiPostPlantStatsSchema = z
  .object({
    played: z.number().int(),
    won: z.number().int(),
    winrate: z.number(),
  })
  .openapi("PostPlantStats");

export const ApiSidePostPlantSchema = z
  .object({
    atk: ApiPostPlantStatsSchema,
    def: ApiPostPlantStatsSchema,
  })
  .openapi("SidePostPlant");

export const ApiTeamStatsResponseSchema = ApiAvgStatsSchema.extend({
  situations: ApiSideSituationsSchema,
  post_plant: ApiSidePostPlantSchema,
}).openapi("TeamStatsResponse");

export const ApiMatchVetoSchema = z
  .object({
    match_id: z.number().int(),
    team_id: z.number().int(),
    map_name: z.string(),
    type: z.string(),
    order: z.number().int(),
  })
  .openapi("MatchVeto");

export const ApiTeamWithScoreSchema = z
  .object({
    team: ApiTeamSchema,
    score: z.number().int().nullable(),
  })
  .openapi("TeamWithScore");

export const ApiTeamMatchEntrySchema = z
  .object({
    id: z.number().int(),
    tournament_id: z.number().int().nullable(),
    phase_id: z.number().int().nullable(),
    round_number: z.number().int().nullable(),
    round_name: z.string().nullable(),
    scheduled_at: z.string().nullable(),
    status: z.string(),
    best_of: z.number().int(),
    patch: z.string().nullable(),
    team_a: ApiTeamWithScoreSchema.nullable(),
    team_b: ApiTeamWithScoreSchema.nullable(),
    vetos: z.array(ApiMatchVetoSchema),
  })
  .openapi("TeamMatchEntry");

export const ApiPaginatedTeamMatchesSchema = z
  .object({
    page: z.number().int(),
    per_page: z.number().int(),
    total: z.number().int(),
    total_pages: z.number().int(),
    data: z.array(ApiTeamMatchEntrySchema),
  })
  .openapi("PaginatedTeamMatches");

/** Path parameter for every `/{id}` route, a positive integer serialized as the URL segment. */
export const idPathParamSchema = z.string().regex(/^\d+$/).openapi({
  param: { name: "id", in: "path" },
  example: "123",
  description: "Positive integer id, passed as a URL path segment (e.g. \"/teams/123\").",
});

export const namePathParamSchema = z.string().openapi({
  param: { name: "name", in: "path" },
  example: "sentinels",
  description: "Case insensitive prefix match.",
});

export const mapsFilterQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().openapi({ param: { name: "from", in: "query" }, example: "2026-01-01", description: "Inclusive lower bound (YYYY-MM-DD)." }),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().openapi({ param: { name: "to", in: "query" }, example: "2026-12-31", description: "Inclusive upper bound (YYYY-MM-DD)." }),
  tournament_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "tournament_id", in: "query" }, description: "Restricts to a single tournament." }),
});

export const statsFilterQuerySchema = mapsFilterQuerySchema.extend({
  agent: z.string().optional().openapi({ param: { name: "agent", in: "query" }, description: "Restricts to a single agent name." }),
});

export const matchHistoryFilterQuerySchema = mapsFilterQuerySchema.extend({
  opponent_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "opponent_id", in: "query" }, description: "Restricts to matches against this team id." }),
  status: z.enum(["pending", "live", "completed"]).optional().openapi({ param: { name: "status", in: "query" } }),
  phase_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "phase_id", in: "query" }, description: "Restricts to a single tournament stage." }),
  page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "page", in: "query" }, example: "1", description: "1 indexed, defaults to 1." }),
  per_page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "per_page", in: "query" }, example: "20", description: "Defaults to 20, capped at 50." }),
});

/** V2 team scoped sub endpoints (matches/maps) — `../../v2/queries/teams.ts`, `matchHistoryFilterQuerySchema`/`mapsFilterQuerySchema` widened with `round_name`. */

export const teamMatchesFilterQuerySchema = matchHistoryFilterQuerySchema.extend({
  round_name: z.string().optional().openapi({ param: { name: "round_name", in: "query" }, description: "Restricts to a single round label (e.g. \"Grand Final\")." }),
});

export const teamMapsFilterQuerySchema = mapsFilterQuerySchema.extend({
  round_name: z.string().optional().openapi({ param: { name: "round_name", in: "query" }, description: "Restricts to a single round label (e.g. \"Grand Final\")." }),
  phase_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "phase_id", in: "query" }, description: "Restricts to a single tournament stage." }),
});

export const ApiTournamentSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    region: z.string().nullable(),
    category: z.string().nullable(),
    prize_pool: z.string().nullable(),
    location: z.string().nullable(),
    start_date: z.string(),
    end_date: z.string(),
    status: z.string(),
    description: z.string().nullable(),
  })
  .openapi("Tournament");

export const ApiTournamentPhaseSchema = z
  .object({
    id: z.number().int(),
    tournament_id: z.number().int(),
    name: z.string(),
    format: z.null().openapi({ description: "Always null — a V2 stage has no single format (cf. tournament.phase → stages)." }),
    parent_id: z.null().openapi({ description: "Always null — a V2 stage has no parent." }),
    match_ids: z.array(z.number().int()),
  })
  .openapi("TournamentPhase");

export const ApiTournamentFullResponseSchema = ApiTournamentSchema.extend({
  phases: z.array(ApiTournamentPhaseSchema),
  logo: ApiLogoUrlsSchema.nullable(),
}).openapi("TournamentResponse");

export const ApiGameMapSchema = z
  .object({
    id: z.number().int(),
    match_id: z.number().int(),
    api_match_id: z.string().nullable(),
    map_name: z.string().nullable(),
    team_a_score: z.number().int().nullable(),
    team_b_score: z.number().int().nullable(),
    order: z.number().int(),
    is_completed: z.boolean(),
  })
  .openapi("GameMap");

export const ApiMatchFullResponseSchema = z
  .object({
    id: z.number().int(),
    tournament_id: z.number().int().nullable(),
    phase_id: z.number().int().nullable(),
    round_number: z.number().int().nullable(),
    round_name: z.string().nullable(),
    scheduled_at: z.string().nullable(),
    status: z.string(),
    best_of: z.number().int(),
    patch: z.string().nullable(),
    team_a: ApiTeamWithScoreSchema.nullable(),
    team_b: ApiTeamWithScoreSchema.nullable(),
    maps: z.array(ApiGameMapSchema),
    vetos: z.array(ApiMatchVetoSchema),
  })
  .openapi("MatchFullResponse");

export const ApiMapPlayerStatSchema = z
  .object({
    id: z.number().int(),
    person_id: z.number().int().nullable(),
    team_id: z.number().int(),
    agent_name: z.string().nullable(),
    kills: z.number().int(),
    deaths: z.number().int(),
    assists: z.number().int(),
    acs: z.number().int(),
    adr: z.number().int(),
    first_kills: z.number().int(),
    first_deaths: z.number().int(),
    kast_percentage: z.number(),
    headshot_percentage: z.number(),
  })
  .openapi("MapPlayerStat");

export const ApiRoundKillEventSchema = z
  .object({
    kill_player_id: z.number().int().nullable(),
    victim_player_id: z.number().int(),
    time_ms: z.number().int(),
  })
  .openapi("RoundKillEvent");

export const ApiRoundPlayerStatFullSchema = z
  .object({
    player_id: z.number().int(),
    kills: z.number().int(),
    assists: z.number().int(),
    score: z.number().int(),
    economy_spent: z.number().int().nullable(),
    economy_remaining: z.number().int().nullable(),
    weapon_id: z.string().nullable(),
    armor: z.string().nullable(),
    damage: z.number().int(),
    headshots: z.number().int(),
    bodyshots: z.number().int(),
    legshots: z.number().int(),
  })
  .openapi("RoundPlayerStatFull");

export const ApiRoundStatsFullSchema = z
  .object({
    round_number: z.number().int(),
    winning_team: z.number().int().nullable(),
    win_type: z.string().nullable(),
    atk_team: z.number().int().nullable(),
    def_team: z.number().int().nullable(),
    plant_site: z.string().nullable(),
    player_stats: z.array(ApiRoundPlayerStatFullSchema),
    kills: z.array(ApiRoundKillEventSchema),
  })
  .openapi("RoundStatsFull");

export const ApiMapStatsFullSchema = ApiGameMapSchema.extend({
  player_stats: z.array(ApiMapPlayerStatSchema),
  rounds: z.array(ApiRoundStatsFullSchema),
}).openapi("MapStatsFull");

export const ApiMatchStatsResponseSchema = z
  .object({
    id: z.number().int(),
    tournament_id: z.number().int().nullable(),
    phase_id: z.number().int().nullable(),
    round_number: z.number().int().nullable(),
    round_name: z.string().nullable(),
    scheduled_at: z.string().nullable(),
    status: z.string(),
    best_of: z.number().int(),
    patch: z.string().nullable(),
    team_a: ApiTeamWithScoreSchema.nullable(),
    team_b: ApiTeamWithScoreSchema.nullable(),
    vetos: z.array(ApiMatchVetoSchema),
    maps: z.array(ApiMapStatsFullSchema),
  })
  .openapi("MatchStatsResponse");

export const ApiMatchEncounterSchema = z
  .object({
    match_id: z.number().int(),
    scheduled_at: z.string().nullable(),
    tournament_name: z.string(),
    score_a: z.number().int().nullable(),
    score_b: z.number().int().nullable(),
    result: z.enum(["win", "loss", "draw"]).openapi({ description: "Oriented from team_a's perspective." }),
  })
  .openapi("MatchEncounter");

export const ApiMatchEncountersSchema = z
  .object({
    team_a_wins: z.number().int(),
    team_b_wins: z.number().int(),
    items: z.array(ApiMatchEncounterSchema),
  })
  .openapi("MatchEncounters");

export const ApiPickemVotesSchema = z
  .object({
    team_a: z.number().int(),
    team_b: z.number().int(),
    total: z.number().int(),
    team_a_percentage: z.number(),
    team_b_percentage: z.number(),
  })
  .openapi("PickemVotes");

export const ApiMatchV3ResponseSchema = ApiMatchStatsResponseSchema.extend({
  encounters: ApiMatchEncountersSchema,
  radar_chart_widget_url: z.string().nullable().openapi({ description: "Absolute URL to the OBS head to head radar chart widget for these two teams, null if either side is a bye/TBD." }),
  pickem: ApiPickemVotesSchema,
}).openapi("MatchV3Response");

export const ApiMapFullResponseSchema = ApiGameMapSchema.extend({
  player_stats: z.array(ApiMapPlayerStatSchema),
  team_a: ApiTeamWithScoreSchema.nullable(),
  team_b: ApiTeamWithScoreSchema.nullable(),
}).openapi("MapFullResponse");

export const ApiRoundPlayerStatSchema = z
  .object({
    player_id: z.number().int(),
    kills: z.number().int(),
    assists: z.number().int(),
    score: z.number().int(),
    economy_spent: z.number().int().nullable(),
    economy_remaining: z.number().int().nullable(),
    weapon_id: z.string().nullable(),
    armor: z.string().nullable(),
  })
  .openapi("RoundPlayerStat");

export const ApiRoundFullResponseSchema = z
  .object({
    round_number: z.number().int(),
    winning_team: z.number().int().nullable(),
    win_type: z.string().nullable(),
    player_stats: z.array(ApiRoundPlayerStatSchema),
  })
  .openapi("RoundFullResponse");

/**
 * V2 schemas, mirrored from `../../v2/entities.ts` and `../../v2/queries/*`.
 * V2 responses extend the V1 shapes above rather than duplicating every field.
 */

export const ApiTeamV2Schema = ApiTeamSchema.extend({
  liquipedia_link: z.string().nullable(),
}).openapi("TeamV2");

export const ApiThemedLogoUrlsSchema = z
  .object({
    dark: ApiLogoUrlsSchema.nullable(),
    light: ApiLogoUrlsSchema.nullable(),
  })
  .openapi("ThemedLogoUrls");

export const ApiAchievementEntrySchema = z
  .object({
    tournament_id: z.number().int(),
    tournament_name: z.string(),
    placement: z.number().int(),
    placement_label: z.string().nullable(),
    end_date: z.string(),
  })
  .openapi("AchievementEntry");

export const ApiAchievementsResponseSchema = z
  .object({
    items: z.array(ApiAchievementEntrySchema),
    titles: z.number().int(),
    podiums: z.number().int(),
  })
  .openapi("AchievementsResponse");

export const ApiPressEntrySchema = z
  .object({
    title: z.string(),
    slug: z.string(),
    publisher: z.string(),
    published_at: z.string().nullable(),
    lang: z.string(),
  })
  .openapi("PressEntry");

export const ApiPlayerV2Schema = ApiPlayerSchema.extend({
  pronouns: z
    .object({ id: z.number().int().openapi({ description: "0 = she/her, 1 = he/him, 2 = they/them." }), name: z.enum(["she/her", "he/him", "they/them"]) })
    .nullable()
    .openapi({ description: "Pronouns set on the profile, null when unset." }),
  liquipedia_link: z.string().nullable(),
  is_claimed: z.boolean().openapi({ description: "True when the profile is linked to a GC-Stats account (the account itself is never exposed)." }),
}).openapi("PlayerV2");

export const ApiTournamentV2Schema = ApiTournamentSchema.extend({
  liquipedia_link: z.string().nullable(),
}).openapi("TournamentV2");

export const ApiTournamentEntrySchema = z
  .object({
    tournament: ApiTournamentV2Schema,
    logos: ApiThemedLogoUrlsSchema,
    team: ApiTeamSchema.nullable(),
    entrant_name: z.string(),
    placement: z.number().int().nullable().openapi({ description: "Final placement, null when none is recorded." }),
    placement_label: z.string().nullable(),
    wins: z.number().int(),
    losses: z.number().int(),
  })
  .openapi("TournamentEntry");

export const ApiTeamFullResponseV2Schema = ApiTeamV2Schema.extend({
  logos: ApiThemedLogoUrlsSchema,
  achievements: ApiAchievementsResponseSchema,
  last_matches: ApiPaginatedTeamMatchesSchema,
  current_roster: z.array(ApiPlayerSchema),
  last_tournaments: z.array(ApiTournamentEntrySchema).openapi({ description: "Last 10 tournaments the team registered for, most recent first. W/L counts decided matches only." }),
  press: z.array(ApiPressEntrySchema),
}).openapi("TeamFullResponseV2");

export const ApiPlayerTeamHistoryV2Schema = ApiPlayerTeamHistorySchema.extend({
  team_name: z.string().openapi({ description: "Team name at the time: as of the last day of the stint for past teams, current name otherwise." }),
  current_name: z.string().openapi({ description: "The team's current name." }),
  logos: ApiThemedLogoUrlsSchema.openapi({ description: "Team logos at the time (last day of the stint for past teams), current logos otherwise." }),
}).openapi("PlayerTeamHistoryEntryV2");

export const ApiStaffTournamentEntrySchema = ApiTournamentEntrySchema.extend({
  roles: z.array(z.string()).openapi({ description: "Staff roles the person held on the team during the tournament." }),
}).openapi("StaffTournamentEntry");

export const ApiPaginatedStaffTournamentsSchema = z
  .object({
    page: z.number().int(),
    per_page: z.number().int(),
    total: z.number().int(),
    total_pages: z.number().int(),
    data: z.array(ApiStaffTournamentEntrySchema),
  })
  .openapi("PaginatedStaffTournaments");

export const paginationQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "page", in: "query" }, example: "1", description: "1 indexed, defaults to 1." }),
  per_page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "per_page", in: "query" }, example: "20", description: "Defaults to 20, capped at 50." }),
});

export const ApiPlayerFullResponseV2Schema = ApiPlayerV2Schema.extend({
  logos: ApiThemedLogoUrlsSchema,
  achievements: ApiAchievementsResponseSchema,
  last_matches: ApiPaginatedTeamMatchesSchema,
  current_teams: z.array(ApiPlayerTeamHistoryV2Schema),
  past_teams: z.array(ApiPlayerTeamHistoryV2Schema),
  last_tournaments: z.array(ApiTournamentEntrySchema),
  press: z.array(ApiPressEntrySchema),
}).openapi("PlayerFullResponseV2");

export const ApiTournamentPhaseV2Schema = ApiTournamentPhaseSchema.extend({
  liquipedia_link: z.string().nullable(),
}).openapi("TournamentPhaseV2");

export const ApiOrganizationMemberEntrySchema = z
  .object({
    membership_id: z.number().int(),
    person_id: z.number().int(),
    handle: z.string(),
    country_code: z.string().nullable(),
    secondary_country_code: z.string().nullable(),
    role: z.string(),
    since: z.string().nullable(),
    until: z.string().nullable(),
  })
  .openapi("OrganizationMemberEntry");

export const ApiOrganizationMembersResponseSchema = z
  .object({
    current: z.array(ApiOrganizationMemberEntrySchema),
    formers: z.array(ApiOrganizationMemberEntrySchema),
  })
  .openapi("OrganizationMembersResponse");

export const ApiStreamChannelEntrySchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    platform: z.string(),
    type: z.enum(["official", "watchparty"]),
    url: z.string(),
    language_code: z.string(),
  })
  .openapi("StreamChannelEntry");

export const ApiOrganizationVodEntrySchema = z
  .object({
    id: z.number().int(),
    url: z.string(),
    language_code: z.string(),
    match_id: z.number().int(),
    match_label: z.string(),
  })
  .openapi("OrganizationVodEntry");

export const ApiOrganizationFullResponseV2Schema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    slug: z.string(),
    tags: z.array(z.string()),
    country_code: z.string().nullable(),
    secondary_country_code: z.string().nullable(),
    bio: z.string().nullable(),
    socials: z.record(z.string(), z.string()),
    logos: ApiThemedLogoUrlsSchema,
    members: ApiOrganizationMembersResponseSchema,
    stream_channels: z.array(ApiStreamChannelEntrySchema),
    vods: z.array(ApiOrganizationVodEntrySchema),
    press: z.array(ApiPressEntrySchema),
  })
  .openapi("OrganizationFullResponseV2");

export const ApiEntrantRosterPlayerSchema = z
  .object({
    person_id: z.number().int(),
    handle: z.string(),
  })
  .openapi("EntrantRosterPlayer");

export const ApiTournamentEntrantSchema = z
  .object({
    entrant_id: z.number().int(),
    team_id: z.number().int().nullable(),
    display_name: z.string(),
    short_name: z.string().nullable(),
    seed: z.number().int().nullable(),
    logos: ApiThemedLogoUrlsSchema,
    roster: z.array(ApiEntrantRosterPlayerSchema),
  })
  .openapi("TournamentEntrant");

export const ApiTournamentFullResponseV2Schema = ApiTournamentV2Schema.extend({
  phases: z.array(ApiTournamentPhaseV2Schema),
  logos: ApiThemedLogoUrlsSchema,
  entrants: z.array(ApiTournamentEntrantSchema),
}).openapi("TournamentFullResponseV2");

/** Tournament scoped sub endpoints (matches/maps/stats) — `../../v2/queries/tournaments.ts`. */

export const tournamentScopeFilterQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().openapi({ param: { name: "from", in: "query" }, example: "2026-01-01", description: "Inclusive lower bound (YYYY-MM-DD)." }),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().openapi({ param: { name: "to", in: "query" }, example: "2026-12-31", description: "Inclusive upper bound (YYYY-MM-DD)." }),
  team_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "team_id", in: "query" }, description: "Restricts to a single team's entrant(s)." }),
  round_name: z.string().optional().openapi({ param: { name: "round_name", in: "query" }, description: "Restricts to a single round label (e.g. \"Grand Final\")." }),
  phase_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "phase_id", in: "query" }, description: "Restricts to a single tournament stage." }),
});

export const tournamentMatchesFilterQuerySchema = tournamentScopeFilterQuerySchema.extend({
  status: z.enum(["pending", "live", "completed"]).optional().openapi({ param: { name: "status", in: "query" } }),
  page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "page", in: "query" }, example: "1", description: "1 indexed, defaults to 1." }),
  per_page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "per_page", in: "query" }, example: "20", description: "Defaults to 20, capped at 50." }),
});

export const tournamentStatsFilterQuerySchema = tournamentScopeFilterQuerySchema.extend({
  agent: z.string().optional().openapi({ param: { name: "agent", in: "query" }, description: "Restricts to a single agent name." }),
  role: z.string().optional().openapi({ param: { name: "role", in: "query" }, description: "Restricts to players holding this roster role for their team at the time of the match (e.g. \"player\", \"player-igl\", \"coach\")." }),
  nationality: z.string().optional().openapi({ param: { name: "nationality", in: "query" }, description: "Restricts to players with this country code (ISO 3166-1 alpha-3, e.g. \"USA\")." }),
});

export const ApiTournamentMapCompEntrySchema = z
  .object({
    comp: z.array(z.string()),
    times_played: z.number().int(),
  })
  .openapi("TournamentMapCompEntry");

export const ApiTournamentTeamMapStatsSchema = z
  .object({
    wins: z.number().int(),
    losses: z.number().int(),
    winrate: z.number(),
    atk: ApiSideWinrateSchema,
    def: ApiSideWinrateSchema,
    eco: ApiEcoBreakdownSchema,
    comps: z.array(ApiCompEntrySchema),
  })
  .openapi("TournamentTeamMapStats");

export const ApiTournamentMapEntrySchema = z
  .object({
    map_name: z.string(),
    times_played: z.number().int(),
    comps: z.array(ApiTournamentMapCompEntrySchema),
    team_stats: ApiTournamentTeamMapStatsSchema.nullable().openapi({ description: "Present only when the `team_id` filter is given: that team's winrate, side split and comps for this map." }),
  })
  .openapi("TournamentMapEntry");

export const ApiTournamentStatsEntrySchema = z
  .object({
    person_id: z.number().int(),
    handle: z.string(),
    nationality: z.string().nullable(),
    team_id: z.number().int().nullable(),
    team_name: z.string().nullable(),
    agents: z.array(z.string()),
    maps_played: z.number().int(),
    total_kills: z.number(),
    avg_kills: z.number(),
    total_deaths: z.number(),
    avg_deaths: z.number(),
    total_assists: z.number(),
    avg_assists: z.number(),
    total_acs: z.number(),
    avg_acs: z.number(),
    total_adr: z.number(),
    avg_adr: z.number(),
    total_kast_percentage: z.number(),
    avg_kast_percentage: z.number(),
    total_headshot_percentage: z.number(),
    avg_headshot_percentage: z.number(),
    total_first_kills: z.number(),
    avg_first_kills: z.number(),
    total_first_deaths: z.number(),
    avg_first_deaths: z.number(),
    kd_ratio: z.number(),
  })
  .openapi("TournamentStatsEntry");

/** Global listing endpoints (`/v2/vods`, `/v2/news`) — `../../v2/queries/vods.ts` / `../../v2/queries/news.ts`. */

export const ApiVodMatchRefSchema = z
  .object({
    id: z.number().int(),
    tournament_id: z.number().int(),
    round_name: z.string().nullable(),
    scheduled_at: z.string().nullable(),
    team_a: ApiTeamSchema.nullable(),
    team_b: ApiTeamSchema.nullable(),
  })
  .openapi("VodMatchRef");

export const ApiVodOrganizationRefSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    logos: ApiThemedLogoUrlsSchema,
  })
  .openapi("VodOrganizationRef");

export const ApiVodEntrySchema = z
  .object({
    id: z.number().int(),
    url: z.string(),
    language_code: z.string(),
    map_id: z.number().int().nullable(),
    organization: ApiVodOrganizationRefSchema.nullable(),
    match: ApiVodMatchRefSchema,
  })
  .openapi("VodEntry");

export const ApiPaginatedVodsSchema = z
  .object({
    page: z.number().int(),
    per_page: z.number().int(),
    total: z.number().int(),
    total_pages: z.number().int(),
    data: z.array(ApiVodEntrySchema),
  })
  .openapi("PaginatedVods");

export const vodsFilterQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().openapi({ param: { name: "from", in: "query" }, example: "2026-01-01", description: "Inclusive lower bound on the match date (YYYY-MM-DD)." }),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().openapi({ param: { name: "to", in: "query" }, example: "2026-12-31", description: "Inclusive upper bound on the match date (YYYY-MM-DD)." }),
  tournament_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "tournament_id", in: "query" }, description: "Restricts to a single tournament." }),
  team_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "team_id", in: "query" }, description: "Restricts to VODs of matches where this team played, either side." }),
  organization_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "organization_id", in: "query" }, description: "Restricts to VODs published by this organization." }),
  match_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "match_id", in: "query" }, description: "Restricts to a single match." }),
  language_code: z.string().optional().openapi({ param: { name: "language_code", in: "query" }, description: "Restricts to a single VOD language (e.g. \"en\")." }),
  page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "page", in: "query" }, example: "1", description: "1 indexed, defaults to 1." }),
  per_page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "per_page", in: "query" }, example: "20", description: "Defaults to 20, capped at 50." }),
});

export const ApiNewsOrganizationRefSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    logos: ApiThemedLogoUrlsSchema,
  })
  .openapi("NewsOrganizationRef");

export const ApiNewsEntrySchema = z
  .object({
    id: z.number().int(),
    title: z.string(),
    slug: z.string(),
    excerpt: z.string().nullable(),
    image_cover: z.string().nullable(),
    lang: z.string(),
    is_featured: z.boolean(),
    published_at: z.string().nullable(),
    organization: ApiNewsOrganizationRefSchema.nullable(),
  })
  .openapi("NewsEntry");

export const ApiPaginatedNewsSchema = z
  .object({
    page: z.number().int(),
    per_page: z.number().int(),
    total: z.number().int(),
    total_pages: z.number().int(),
    data: z.array(ApiNewsEntrySchema),
  })
  .openapi("PaginatedNews");

export const newsFilterQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().openapi({ param: { name: "from", in: "query" }, example: "2026-01-01", description: "Inclusive lower bound on the publish date (YYYY-MM-DD)." }),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().openapi({ param: { name: "to", in: "query" }, example: "2026-12-31", description: "Inclusive upper bound on the publish date (YYYY-MM-DD)." }),
  lang: z.string().optional().openapi({ param: { name: "lang", in: "query" }, description: "Restricts to a single article language (e.g. \"en\")." }),
  organization_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "organization_id", in: "query" }, description: "Restricts to articles published by this organization." }),
  team_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "team_id", in: "query" }, description: "Restricts to articles about this team." }),
  person_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "person_id", in: "query" }, description: "Restricts to articles about this player." }),
  tournament_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "tournament_id", in: "query" }, description: "Restricts to articles about this tournament." }),
  page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "page", in: "query" }, example: "1", description: "1 indexed, defaults to 1." }),
  per_page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "per_page", in: "query" }, example: "20", description: "Defaults to 20, capped at 50." }),
});

export const matchesFilterQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().openapi({ param: { name: "from", in: "query" }, example: "2026-01-01", description: "Inclusive lower bound on the match date (YYYY-MM-DD)." }),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().openapi({ param: { name: "to", in: "query" }, example: "2026-12-31", description: "Inclusive upper bound on the match date (YYYY-MM-DD)." }),
  team_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "team_id", in: "query" }, description: "Restricts to matches where this team played, either side." }),
  tournament_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "tournament_id", in: "query" }, description: "Restricts to a single tournament." }),
  phase_id: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "phase_id", in: "query" }, description: "Restricts to a single stage." }),
  round_name: z.string().optional().openapi({ param: { name: "round_name", in: "query" }, description: "Restricts to a single round label (e.g. \"Grand Final\")." }),
  status: z.enum(["pending", "live", "completed"]).optional().openapi({ param: { name: "status", in: "query" } }),
  page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "page", in: "query" }, example: "1", description: "1 indexed, defaults to 1." }),
  per_page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "per_page", in: "query" }, example: "20", description: "Defaults to 20, capped at 50." }),
});

export const ApiTeamListEntrySchema = ApiTeamV2Schema.extend({
  logos: ApiThemedLogoUrlsSchema,
}).openapi("TeamListEntry");

export const ApiPaginatedTeamsSchema = z
  .object({
    page: z.number().int(),
    per_page: z.number().int(),
    total: z.number().int(),
    total_pages: z.number().int(),
    data: z.array(ApiTeamListEntrySchema),
  })
  .openapi("PaginatedTeams");

export const teamsListFilterQuerySchema = z.object({
  name: z.string().optional().openapi({ param: { name: "name", in: "query" }, description: "Prefix match on the team's name or short name." }),
  country_code: z.string().optional().openapi({ param: { name: "country_code", in: "query" }, description: "Alpha 3 country code (e.g. \"FRA\")." }),
  is_active: z.enum(["true", "false"]).optional().openapi({ param: { name: "is_active", in: "query" } }),
  direction: z.enum(["asc", "desc"]).optional().openapi({ param: { name: "direction", in: "query" }, description: "Sort by name, defaults to \"asc\"." }),
  page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "page", in: "query" }, example: "1", description: "1 indexed, defaults to 1." }),
  per_page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "per_page", in: "query" }, example: "20", description: "Defaults to 20, capped at 50." }),
});

export const ApiPlayerListEntrySchema = ApiPlayerV2Schema.extend({
  logos: ApiThemedLogoUrlsSchema,
}).openapi("PlayerListEntry");

export const ApiPaginatedPlayersSchema = z
  .object({
    page: z.number().int(),
    per_page: z.number().int(),
    total: z.number().int(),
    total_pages: z.number().int(),
    data: z.array(ApiPlayerListEntrySchema),
  })
  .openapi("PaginatedPlayers");

export const playersListFilterQuerySchema = z.object({
  handle: z.string().optional().openapi({ param: { name: "handle", in: "query" }, description: "Prefix match on the player's handle." }),
  country_code: z.string().optional().openapi({ param: { name: "country_code", in: "query" }, description: "Alpha 3 country code (e.g. \"FRA\")." }),
  is_active: z.enum(["true", "false"]).optional().openapi({ param: { name: "is_active", in: "query" } }),
  direction: z.enum(["asc", "desc"]).optional().openapi({ param: { name: "direction", in: "query" }, description: "Sort by handle, defaults to \"asc\"." }),
  page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "page", in: "query" }, example: "1", description: "1 indexed, defaults to 1." }),
  per_page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "per_page", in: "query" }, example: "20", description: "Defaults to 20, capped at 50." }),
});

export const ApiTournamentListEntrySchema = ApiTournamentV2Schema.extend({
  logos: ApiThemedLogoUrlsSchema,
  teams_count: z.number().int(),
}).openapi("TournamentListEntry");

export const ApiPaginatedTournamentsSchema = z
  .object({
    page: z.number().int(),
    per_page: z.number().int(),
    total: z.number().int(),
    total_pages: z.number().int(),
    data: z.array(ApiTournamentListEntrySchema),
  })
  .openapi("PaginatedTournaments");

export const tournamentsListFilterQuerySchema = z.object({
  region: z.string().optional().openapi({ param: { name: "region", in: "query" } }),
  category: z.string().optional().openapi({ param: { name: "category", in: "query" } }),
  year: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "year", in: "query" }, description: "Calendar year of the tournament's start date." }),
  active: z.enum(["true", "false"]).optional().openapi({ param: { name: "active", in: "query" }, description: "Left unset returns both active and inactive tournaments." }),
  sort: z.enum(["date", "name"]).optional().openapi({ param: { name: "sort", in: "query" }, description: "Defaults to \"date\" (start_date)." }),
  direction: z.enum(["asc", "desc"]).optional().openapi({ param: { name: "direction", in: "query" }, description: "Defaults to \"desc\" for date, \"asc\" for name." }),
  page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "page", in: "query" }, example: "1", description: "1 indexed, defaults to 1." }),
  per_page: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "per_page", in: "query" }, example: "20", description: "Defaults to 20, capped at 50." }),
});

export const ApiSearchResultItemSchema = z
  .object({
    type: z.enum(["team", "player", "tournament", "organization"]),
    id: z.number().int(),
    title: z.string(),
    subtitle: z.string().nullable(),
    country_code: z.string().nullable(),
    secondary_country_code: z.string().nullable(),
    logo_url: z.string().nullable(),
    logo_url_light: z.string().nullable(),
    path: z.string(),
    score: z.number().int(),
    popularity: z.number().int(),
  })
  .openapi("SearchResultItem");

export const ApiSearchResultsSchema = z
  .object({
    team: z.array(ApiSearchResultItemSchema),
    player: z.array(ApiSearchResultItemSchema.extend({ is_claimed: z.boolean() }).openapi("PlayerSearchResultItem")),
    tournament: z.array(ApiSearchResultItemSchema),
    organization: z.array(ApiSearchResultItemSchema),
  })
  .openapi("SearchResults");

export const searchFilterQuerySchema = z.object({
  q: z.string().min(2).openapi({ param: { name: "q", in: "query" }, example: "liquid", description: "Search term, at least 2 characters." }),
  limit: z.string().regex(/^\d+$/).optional().openapi({ param: { name: "limit", in: "query" }, example: "5", description: "Max results per entity type, defaults to 5, capped at 20." }),
});
