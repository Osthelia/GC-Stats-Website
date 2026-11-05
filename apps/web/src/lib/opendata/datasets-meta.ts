/**
 * GC-Stats - opendata datasets-meta
 *
 * Client safe description of the OpenData datasets: column keys, value types
 * and links, shared by the API, the explorer table and the admin monitoring.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const OPENDATA_DATASETS = ["tournaments", "teams", "players", "matches", "maps", "map_players"] as const;
export type OpenDataDataset = (typeof OPENDATA_DATASETS)[number];
export type OpenDataRequestKind = "browse" | "export";
export type OpenDataColumnType = "id" | "text" | "longText" | "number" | "decimal" | "date" | "datetime" | "boolean" | "country" | "url" | "socials" | "matchStatus" | "tournamentStatus";
export type OpenDataColumnMeta = {
  key: string;
  type: OpenDataColumnType;
  /** Public page the value links to, using the id held in `linkIdKey` (or the column itself). */
  link?: { path: "/tournaments" | "/team" | "/player" | "/match"; linkIdKey?: string };
  /** Shown by default in the explorer, the others are one click away in the column picker. */
  defaultVisible: boolean;
};
export type OpenDataDatasetMeta = {
  key: OpenDataDataset;
  columns: OpenDataColumnMeta[];
  defaultSort: string;
  defaultDirection: "asc" | "desc";
};
const col = (key: string, type: OpenDataColumnType, defaultVisible = true, link?: OpenDataColumnMeta["link"]): OpenDataColumnMeta => ({ key, type, defaultVisible, link });
export const OPENDATA_DATASET_META: Record<OpenDataDataset, OpenDataDatasetMeta> = {
  tournaments: {
    key: "tournaments",
    defaultSort: "start_date",
    defaultDirection: "desc",
    columns: [
      col("id", "id", true, { path: "/tournaments" }),
      col("name", "text", true, { path: "/tournaments", linkIdKey: "id" }),
      col("status", "tournamentStatus"),
      col("start_date", "date"),
      col("end_date", "date"),
      col("region", "text"),
      col("category", "text"),
      col("location", "text", false),
      col("prize_pool", "text"),
      col("teams_count", "number"),
      col("organizer_id", "id", false),
      col("organizer_name", "text", false),
      col("liquipedia_link", "url", false),
      col("socials", "socials", false),
    ],
  },
  teams: {
    key: "teams",
    defaultSort: "name",
    defaultDirection: "asc",
    columns: [
      col("id", "id", true, { path: "/team" }),
      col("name", "text", true, { path: "/team", linkIdKey: "id" }),
      col("short_name", "text"),
      col("country_code", "country"),
      col("secondary_country_code", "country", false),
      col("is_active", "boolean"),
      col("players_count", "number"),
      col("matches_count", "number"),
      col("bio", "longText", false),
      col("vlr_id", "number", false),
      col("liquipedia_link", "url", false),
      col("socials", "socials", false),
    ],
  },
  players: {
    key: "players",
    defaultSort: "handle",
    defaultDirection: "asc",
    columns: [
      col("id", "id", true, { path: "/player" }),
      col("handle", "text", true, { path: "/player", linkIdKey: "id" }),
      col("first_name", "text", false),
      col("last_name", "text", false),
      col("country_code", "country"),
      col("secondary_country_code", "country", false),
      col("is_active", "boolean"),
      col("current_team_id", "id", false, { path: "/team" }),
      col("current_team_name", "text", true, { path: "/team", linkIdKey: "current_team_id" }),
      col("current_role", "text"),
      col("bio", "longText", false),
      col("vlr_id", "number", false),
      col("liquipedia_link", "url", false),
      col("socials", "socials", false),
    ],
  },
  matches: {
    key: "matches",
    defaultSort: "scheduled_at",
    defaultDirection: "desc",
    columns: [
      col("id", "id", true, { path: "/match" }),
      col("scheduled_at", "datetime"),
      col("status", "matchStatus"),
      col("tournament_id", "id", false, { path: "/tournaments" }),
      col("tournament_name", "text", true, { path: "/tournaments", linkIdKey: "tournament_id" }),
      col("stage_name", "text"),
      col("bracket_name", "text", false),
      col("round", "number", false),
      col("best_of", "number"),
      col("team_a_id", "id", false, { path: "/team" }),
      col("team_a_name", "text", true, { path: "/team", linkIdKey: "team_a_id" }),
      col("score_a", "number"),
      col("score_b", "number"),
      col("team_b_id", "id", false, { path: "/team" }),
      col("team_b_name", "text", true, { path: "/team", linkIdKey: "team_b_id" }),
      col("winner_team_id", "id", false, { path: "/team" }),
      col("is_forfeit", "boolean", false),
      col("patch", "text", false),
    ],
  },
  maps: {
    key: "maps",
    defaultSort: "started_at",
    defaultDirection: "desc",
    columns: [
      col("id", "id"),
      col("match_id", "id", true, { path: "/match" }),
      col("started_at", "datetime"),
      col("tournament_id", "id", false, { path: "/tournaments" }),
      col("tournament_name", "text", true, { path: "/tournaments", linkIdKey: "tournament_id" }),
      col("map_order", "number"),
      col("map_name", "text", true, { path: "/match", linkIdKey: "match_id" }),
      col("is_completed", "boolean"),
      col("team_a_id", "id", false, { path: "/team" }),
      col("team_a_name", "text", true, { path: "/team", linkIdKey: "team_a_id" }),
      col("score_a", "number"),
      col("score_b", "number"),
      col("team_b_id", "id", false, { path: "/team" }),
      col("team_b_name", "text", true, { path: "/team", linkIdKey: "team_b_id" }),
      col("winner_team_id", "id", false, { path: "/team" }),
      col("team_a_atk_rounds_won", "number", false),
      col("team_a_def_rounds_won", "number", false),
      col("team_b_atk_rounds_won", "number", false),
      col("team_b_def_rounds_won", "number", false),
      col("is_forfeit", "boolean", false),
      col("patch", "text", false),
    ],
  },
  map_players: {
    key: "map_players",
    defaultSort: "started_at",
    defaultDirection: "desc",
    columns: [
      col("id", "id", false),
      col("map_id", "id", false),
      col("match_id", "id", false, { path: "/match" }),
      col("started_at", "datetime", false),
      col("tournament_id", "id", false, { path: "/tournaments" }),
      col("tournament_name", "text", false, { path: "/tournaments", linkIdKey: "tournament_id" }),
      col("map_name", "text", true, { path: "/match", linkIdKey: "match_id" }),
      col("player_id", "id", false, { path: "/player" }),
      col("player_handle", "text", true, { path: "/player", linkIdKey: "player_id" }),
      col("team_id", "id", false, { path: "/team" }),
      col("team_name", "text", true, { path: "/team", linkIdKey: "team_id" }),
      col("agent", "text"),
      col("kills", "number"),
      col("deaths", "number"),
      col("assists", "number"),
      col("acs", "number"),
      col("adr", "number"),
      col("kast_percentage", "decimal"),
      col("headshot_percentage", "decimal"),
      col("first_kills", "number"),
      col("first_deaths", "number"),
      col("clutches_won", "number", false),
      col("clutches_played", "number", false),
      col("multikills_2k", "number", false),
      col("multikills_3k", "number", false),
      col("multikills_4k", "number", false),
      col("multikills_5k", "number", false),
      col("trade_kills", "number", false),
      col("traded_deaths", "number", false),
    ],
  },
};
export const OPENDATA_PAGE_SIZES = [25, 50, 100] as const;
export const OPENDATA_DEFAULT_PAGE_SIZE = 50;
export const OPENDATA_MAX_QUERY_LENGTH = 100;
/** Column filters travel as `f.<column>=<value>` query params, ANDed together. */
export const OPENDATA_FILTER_PREFIX = "f.";
export const OPENDATA_MAX_FILTERS = 10;
export type OpenDataFilter = { column: string; value: string };
/** Types filtered by an exact value picked from a list, the others match on a typed value. */
export const OPENDATA_LIST_VALUES: Partial<Record<OpenDataColumnType, readonly string[]>> = {
  boolean: ["true", "false"],
  matchStatus: ["pending", "live", "completed"],
  tournamentStatus: ["upcoming", "live", "finished"],
};
/** Integer columns match exactly, text ones on a case and accent insensitive substring. */
export function isIntegerColumnType(type: OpenDataColumnType): boolean {
  return type === "id" || type === "number";
}
/** `date` is YYYY-MM-DD, a filtered export says so in its name. */
export function openDataExportFileName(dataset: OpenDataDataset, filtered: boolean, date: string): string {
  return `gcstats-${dataset}${filtered ? "-filtered" : ""}-${date}.json`;
}
export function isOpenDataDataset(value: string): value is OpenDataDataset {
  return (OPENDATA_DATASETS as readonly string[]).includes(value);
}
export type OpenDataRow = Record<string, unknown>;
export type OpenDataPageResponse = {
  dataset: OpenDataDataset;
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  sort: string;
  direction: "asc" | "desc";
  q: string;
  filters: OpenDataFilter[];
  generated_at: string;
  data: OpenDataRow[];
};
/** Error codes returned in `{ error }` by the OpenData API, translated by the explorer. */
export type OpenDataErrorCode = "not_found" | "bad_request" | "disabled" | "account_required" | "rate_limited" | "busy" | "internal_error";
