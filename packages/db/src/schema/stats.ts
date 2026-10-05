/**
 * GC-Stats — stats module
 *
 * Match maps and the raw/aggregated game stats layers ingested from the
 * Riot relay: per-round kills/damages/alive states/player positions/
 * loadouts (raw), and map_player_stats/map_team_round_summary
 * (aggregated).
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgTable, bigserial, bigint, integer, smallint, text, boolean, real, numeric, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { matches, entrants } from "./bracket";
import { people } from "./people";

// Weapon/agent/map names are stored as plain display text directly on the
// raw/aggregated rows — no separate reference table for any of them (not a
// useful metric to normalize), and Riot's content UUIDs aren't known for
// historical (V1-migrated) data anyway.

// --- Maps (one per bracket-engine match, best-of-N) -----------------------
export const maps = pgTable("maps", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  matchId: bigint("match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
  apiMatchId: text("api_match_id").unique(), // Riot match id, or RiotRelay's synthetic "GCS-..." merged id
  mapName: text("map_name"), // display name, e.g. "Ascent" — see reference tables note above
  gameMode: text("game_mode"), // matchInfo.gameMode from Riot payload — stored even though only Bomb is used today
  teamAScore: integer("team_a_score"),
  teamBScore: integer("team_b_score"),
  order: integer("order").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  startedAt: timestamp("started_at", { withTimezone: true }),
  note: text("note"),
  // Same purpose as matches.isForfeit, one level down — a map-win point
  // value can differ from a map-forfeit-win value in a group container's
  // points tiebreaker (apps/web/src/lib/bracket/points.ts).
  isForfeit: boolean("is_forfeit").notNull().default(false),
}, (t) => [
  index("maps_match_id_idx").on(t.matchId),
]);

// --- RAW layer -------------------------------------------------------------
// Ingested directly from the Riot relay. Never queried by the app directly
// except map_round_player_positions_raw (heatmaps) — see DATABASES.MD §4.1.
// Partitioning (by map_id or tournament date range) deferred to a follow-up
// migration once real volume is known (DATABASES.MD §9 open question).

export const mapRoundsRaw = pgTable("map_rounds_raw", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  mapId: bigint("map_id", { mode: "number" }).notNull().references(() => maps.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  winningEntrantId: bigint("winning_entrant_id", { mode: "number" }).references(() => entrants.id),
  winType: text("win_type"), // elimination | defuse | detonate | time
  atkEntrantId: bigint("atk_entrant_id", { mode: "number" }).references(() => entrants.id),
  defEntrantId: bigint("def_entrant_id", { mode: "number" }).references(() => entrants.id),
  plantSite: text("plant_site"),
  plantX: integer("plant_x"),
  plantY: integer("plant_y"),
  plantTimeMs: integer("plant_time_ms"),
}, (t) => [
  index("map_rounds_raw_map_id_idx").on(t.mapId),
]);

export const mapRoundKillsRaw = pgTable("map_round_kills_raw", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  mapRoundId: bigint("map_round_id", { mode: "number" }).notNull().references(() => mapRoundsRaw.id, { onDelete: "cascade" }),
  killerPersonId: bigint("killer_person_id", { mode: "number" }).references(() => people.id),
  victimPersonId: bigint("victim_person_id", { mode: "number" }).notNull().references(() => people.id),
  timeMs: integer("time_ms").notNull(),
  weapon: text("weapon"), // display name, e.g. "Vandal" — see reference tables note above
  damageType: text("damage_type"), // Weapon | Ability | Bomb | Melee | Fall
  isSecondaryFire: boolean("is_secondary_fire"),
  assistantPersonIds: bigint("assistant_person_ids", { mode: "number" }).array(),
}, (t) => [
  index("map_round_kills_raw_map_round_id_idx").on(t.mapRoundId),
]);

export const mapRoundDamagesRaw = pgTable("map_round_damages_raw", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  mapRoundId: bigint("map_round_id", { mode: "number" }).notNull().references(() => mapRoundsRaw.id, { onDelete: "cascade" }),
  attackerPersonId: bigint("attacker_person_id", { mode: "number" }).references(() => people.id),
  receiverPersonId: bigint("receiver_person_id", { mode: "number" }).notNull().references(() => people.id),
  damage: integer("damage").notNull(),
  headshots: integer("headshots").notNull().default(0),
  bodyshots: integer("bodyshots").notNull().default(0),
  legshots: integer("legshots").notNull().default(0),
}, (t) => [
  index("map_round_damages_raw_map_round_id_idx").on(t.mapRoundId),
]);

export const mapRoundAliveStatesRaw = pgTable("map_round_alive_states_raw", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  mapRoundId: bigint("map_round_id", { mode: "number" }).notNull().references(() => mapRoundsRaw.id, { onDelete: "cascade" }),
  sequence: smallint("sequence").notNull(),
  timeMs: integer("time_ms").notNull(),
  atkAlive: smallint("atk_alive").notNull(),
  defAlive: smallint("def_alive").notNull(),
  winnerSide: text("winner_side"), // 'atk' | 'def'
}, (t) => [
  index("map_round_alive_states_raw_map_round_id_idx").on(t.mapRoundId),
]);

// The heatmap exception — full granularity kept indefinitely, never archived
// (see DATABASES.MD §4.1). `playerLocations` on a real Riot kill event
// includes every alive player, not just killer/victim — hence `role`
// covering 'bystander' too (see DATABASES.MD §4.4).
export const mapRoundPlayerPositionsRaw = pgTable("map_round_player_positions_raw", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  mapRoundId: bigint("map_round_id", { mode: "number" }).notNull().references(() => mapRoundsRaw.id, { onDelete: "cascade" }),
  mapId: bigint("map_id", { mode: "number" }).notNull().references(() => maps.id), // denormalized for indexed heatmap filtering
  eventType: text("event_type").notNull(), // 'kill' | 'plant' | 'defuse'
  mapRoundKillId: bigint("map_round_kill_id", { mode: "number" }).references(() => mapRoundKillsRaw.id, { onDelete: "set null" }),
  personId: bigint("person_id", { mode: "number" }).notNull().references(() => people.id),
  role: text("role"), // 'killer' | 'victim' | 'bystander' | 'planter' | 'defuser'
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  viewRadians: real("view_radians"),
  timeMs: integer("time_ms"),
}, (t) => [
  index("map_round_player_positions_raw_map_round_id_idx").on(t.mapRoundId),
  index("map_round_player_positions_raw_map_round_kill_id_idx").on(t.mapRoundKillId),
]);

export const mapRoundPlayerLoadoutsRaw = pgTable("map_round_player_loadouts_raw", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  mapRoundId: bigint("map_round_id", { mode: "number" }).notNull().references(() => mapRoundsRaw.id, { onDelete: "cascade" }),
  personId: bigint("person_id", { mode: "number" }).notNull().references(() => people.id, { onDelete: "cascade" }),
  entrantId: bigint("entrant_id", { mode: "number" }).references(() => entrants.id),
  kills: integer("kills").notNull().default(0),
  assists: integer("assists").notNull().default(0),
  score: integer("score").notNull().default(0),
  loadoutValue: integer("loadout_value"),
  economySpent: integer("economy_spent"),
  economyRemaining: integer("economy_remaining"),
  weapon: text("weapon"), // display name — see reference tables note above
  armor: text("armor"),
}, (t) => [
  index("map_round_player_loadouts_raw_map_round_id_idx").on(t.mapRoundId),
]);

// --- Aggregated layer — what the app/API actually queries -----------------
// Upserted by the ingestion pipeline's aggregation job after each completed
// map; can be safely recomputed from the RAW layer at any time (successor
// of V1's RecalculateMapStats). See DATABASES.MD §4.2/§4.3.

export const mapPlayerStats = pgTable("map_player_stats", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  mapId: bigint("map_id", { mode: "number" }).notNull().references(() => maps.id, { onDelete: "cascade" }),
  personId: bigint("person_id", { mode: "number" }).references(() => people.id),
  entrantId: bigint("entrant_id", { mode: "number" }).notNull().references(() => entrants.id),
  agentName: text("agent_name"), // display name, e.g. "Jett" — see reference tables note above
  valName: text("val_name"),
  kills: integer("kills").notNull().default(0),
  deaths: integer("deaths").notNull().default(0),
  assists: integer("assists").notNull().default(0),
  acs: integer("acs").notNull().default(0),
  adr: integer("adr").notNull().default(0),
  kastPercentage: numeric("kast_percentage", { precision: 5, scale: 2 }).notNull().default("0"),
  firstKills: integer("first_kills").notNull().default(0),
  firstDeaths: integer("first_deaths").notNull().default(0),
  headshotPercentage: numeric("headshot_percentage", { precision: 5, scale: 2 }).notNull().default("0"),
  clutches: jsonb("clutches").notNull().default({}), // {"1v1": {won, total}, ...}
  multikills: jsonb("multikills").notNull().default({}), // {"2k": n, "3k": n, ...}
  tradeKills: integer("trade_kills").notNull().default(0),
  tradedDeaths: integer("traded_deaths").notNull().default(0),
  roundTypeSplits: jsonb("round_type_splits").notNull().default({}), // {"pistol": {won, played}, "atk": {rounds, roundsWon, kills, kast}, ...}
  abilityKills: jsonb("ability_kills").notNull().default({}), // {"ability1": n, "ability2": n, "grenade": n, "ultimate": n}
  fallDeaths: integer("fall_deaths").notNull().default(0),
  weaponKills: jsonb("weapon_kills").notNull().default({}), // {"<weapon name>": n, ...}
}, (t) => [
  index("map_player_stats_map_id_idx").on(t.mapId),
]);

export const mapTeamRoundSummary = pgTable("map_team_round_summary", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  mapId: bigint("map_id", { mode: "number" }).notNull().references(() => maps.id, { onDelete: "cascade" }),
  entrantId: bigint("entrant_id", { mode: "number" }).notNull().references(() => entrants.id),
  side: text("side").notNull(), // 'atk' | 'def'
  roundsPlayed: integer("rounds_played").notNull().default(0),
  roundsWon: integer("rounds_won").notNull().default(0),
}, (t) => [
  index("map_team_round_summary_map_id_idx").on(t.mapId),
  index("map_team_round_summary_entrant_id_idx").on(t.entrantId),
]);
