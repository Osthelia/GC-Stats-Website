/**
 * GC-Stats — bracket module
 *
 * Tournament structure and match tables: point_types, tournaments,
 * tournament_components, stages, stage_containers, entrants and their
 * members, group_entries and standings rules, matches, match_seeds,
 * bracket_edges (progression graph), stage_qualifications and their
 * results, point_entries, and match_vetos.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgTable, pgEnum, bigserial, bigint, integer, text, varchar, jsonb, boolean, date, timestamp, numeric, char, unique, index } from "drizzle-orm/pg-core";
import { teams, people } from "./people";

export const pointTypes = pgTable("point_types", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  label: text("label").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
});

export const tournaments = pgTable("tournaments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  region: text("region"),
  category: text("category"),
  prizePool: text("prize_pool"),
  location: text("location"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status").notNull().default("upcoming"), // 'upcoming' | 'live' | 'finished'
  description: text("description"),
  active: boolean("active").notNull().default(false),
  // Uncovered tournament (mix) holding a GC team's match: only the match is
  // public, the tournament has no page and stays out of every listing.
  isGhost: boolean("is_ghost").notNull().default(false),
  liquipediaLink: text("liquipedia_link"),
  socials: jsonb("socials").notNull().default({}),
  playerPovPhrase: text("player_pov_phrase"),
  pointTypeId: bigint("point_type_id", { mode: "number" }).references(() => pointTypes.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("tournaments_active_start_date_idx").on(t.active, t.startDate),
]);

// Mirrors component-registry selections (veto system, standings calculator,
// auth provider, ...) — absence of a row for a `kind` is a valid state.
export const tournamentComponents = pgTable("tournament_components", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tournamentId: bigint("tournament_id", { mode: "number" }).notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 64 }).notNull(),
  componentId: varchar("component_id", { length: 64 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  config: jsonb("config"),
});

// --- Bracket engine enums (shared vocabulary with TournamentPlatform) ----
export const containerTypeEnum = pgEnum("container_type", ["bracket", "group"]);
// No "ready" state (unlike the shared bracket-engine's generic MatchStatus vocabulary):
// V1's matches.status only ever had upcoming/live/finished, never a distinct
// pre-live gate once both entrants were known — GC-Stats keeps that same
// two-value "not started yet" bucket (pending), it just doesn't persist it.
export const matchStatusEnum = pgEnum("match_status", ["pending", "live", "completed"]);
export const slotEnum = pgEnum("slot", ["a", "b"]);
export const matchResultEnum = pgEnum("match_result", ["winner", "loser"]);
export const seedSourceEnum = pgEnum("seed_source", ["seed", "group_rank", "bye", "qualification"]);
export const entryStatusEnum = pgEnum("entry_status", ["active", "qualified", "eliminated"]);
export const stageStatusEnum = pgEnum("stage_status", ["pending", "active", "completed"]);

export const stages = pgTable("stages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tournamentId: bigint("tournament_id", { mode: "number" }).notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sequenceOrder: integer("sequence_order").notNull(),
  status: stageStatusEnum("status").notNull().default("pending"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  // Public-visibility toggle, mirrors tournaments.active — unlike that
  // column this defaults to true (not false): existing stages must stay
  // visible after this column is added, only an explicit deactivation
  // should hide one going forward. Purely a display switch, never gates
  // admin editing.
  active: boolean("active").notNull().default(true),
  liquipediaLink: text("liquipedia_link"),
}, (t) => [
  index("stages_tournament_id_idx").on(t.tournamentId),
]);

export const stageContainers = pgTable("stage_containers", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  stageId: bigint("stage_id", { mode: "number" }).notNull().references(() => stages.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  containerType: containerTypeEnum("container_type").notNull(),
  config: jsonb("config").notNull().default({}),
  status: stageStatusEnum("status").notNull().default("pending"),
}, (t) => [
  index("stage_containers_stage_id_idx").on(t.stageId),
]);

// --- Entrants -------------------------------------------------------------
// GC-Stats never uses kind='player' — a Valorant tournament always registers
// by team. Kept in the shared type only for BRACKT's future solo-game use.
// See DATABASES.MD §2.3. CHECK (exactly one of team_id/player_id per kind)
// added in drizzle/0000_squashed_baseline.sql.
export const entrants = pgTable("entrants", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tournamentId: bigint("tournament_id", { mode: "number" }).notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // 'team' | 'player' | 'placeholder' — GC-Stats only ever writes 'team'/'placeholder'
  teamId: bigint("team_id", { mode: "number" }).references(() => teams.id),
  playerId: bigint("player_id", { mode: "number" }).references(() => people.id),
  displayName: text("display_name").notNull(), // snapshot at registration time, survives a later team rename
  seed: integer("seed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("entrants_tournament_id_idx").on(t.tournamentId),
  index("entrants_team_id_idx").on(t.teamId),
]);

// The roster locked in for THIS tournament — distinct from the team's
// ongoing roster (rosterMemberships). See DATABASES.MD §2.3bis.
export const entrantMembers = pgTable("entrant_members", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  entrantId: bigint("entrant_id", { mode: "number" }).notNull().references(() => entrants.id, { onDelete: "cascade" }),
  personId: bigint("person_id", { mode: "number" }).notNull().references(() => people.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("player"), // 'player' | 'stand_in' | 'coach' | 'manager' | 'analyst' | ...
  isStarter: boolean("is_starter").notNull().default(true),
}, (t) => [
  unique("entrant_members_entrant_person_role_unique").on(t.entrantId, t.personId, t.role),
]);

export const groupEntries = pgTable("group_entries", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  containerId: bigint("container_id", { mode: "number" }).notNull().references(() => stageContainers.id, { onDelete: "cascade" }),
  entrantId: bigint("entrant_id", { mode: "number" }).notNull().references(() => entrants.id, { onDelete: "cascade" }),
  seed: integer("seed"),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  buchholz: integer("buchholz").notNull().default(0), // hundredths, no float
  roundDiff: integer("round_diff").notNull().default(0),
  hadBye: boolean("had_bye").notNull().default(false),
  status: entryStatusEnum("status").notNull().default("active"),
}, (t) => [
  index("group_entries_container_id_idx").on(t.containerId),
]);

export const containerStandingsRules = pgTable("container_standings_rules", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  containerId: bigint("container_id", { mode: "number" }).notNull().references(() => stageContainers.id, { onDelete: "cascade" }),
  criteria: jsonb("criteria").notNull(), // ordered, e.g. ["buchholz", "round_diff", "seed"]
});

export const matches = pgTable("matches", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  containerId: bigint("container_id", { mode: "number" }).notNull().references(() => stageContainers.id, { onDelete: "cascade" }),
  round: integer("round").notNull(),
  // Row position within its (container, round) column on the admin bracket
  // editor canvas — purely a manual layout hint (null = auto-placed in the
  // next free row), never read by the bracket engine or the public/pickem/
  // admin-viewer canvases (those derive their own row from the graph shape,
  // cf. lib/bracket-layout.ts).
  displayOrder: integer("display_order"),
  label: text("label"),
  bestOf: integer("best_of").notNull().default(1),
  status: matchStatusEnum("status").notNull().default("pending"),
  entrantAId: bigint("entrant_a_id", { mode: "number" }).references(() => entrants.id),
  entrantBId: bigint("entrant_b_id", { mode: "number" }).references(() => entrants.id),
  scoreA: integer("score_a"),
  scoreB: integer("score_b"),
  winnerId: bigint("winner_id", { mode: "number" }).references(() => entrants.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  patch: text("patch"),
  // Drives the optional "forfeit win" point value in a group container's
  // points-based tiebreaker (apps/web/src/lib/bracket/points.ts) — a
  // forfeited match still has a winnerId, this just flags that the win
  // didn't come from actually playing it out.
  isForfeit: boolean("is_forfeit").notNull().default(false),
}, (t) => [
  index("matches_entrant_a_id_idx").on(t.entrantAId),
  index("matches_entrant_b_id_idx").on(t.entrantBId),
]);

export const matchSeeds = pgTable("match_seeds", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  matchId: bigint("match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
  slot: slotEnum("slot").notNull(),
  sourceType: seedSourceEnum("source_type").notNull(),
  sourceRef: jsonb("source_ref").notNull(), // {seed:3} | {containerId,rank} | {} (bye) | {qualificationId}
}, (t) => [
  index("match_seeds_match_id_idx").on(t.matchId),
]);

export const bracketEdges = pgTable("bracket_edges", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  fromMatchId: bigint("from_match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
  fromResult: matchResultEnum("from_result").notNull(),
  toMatchId: bigint("to_match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
  toSlot: slotEnum("to_slot").notNull(),
}, (t) => [
  index("bracket_edges_from_match_id_idx").on(t.fromMatchId),
  index("bracket_edges_to_match_id_idx").on(t.toMatchId),
]);

// Stage-level qualification/advancement rules — ported from V1
// phase_qualifications (see DATABASES.MD §2.6). CHECK (exactly one of
// source_container_id/source_match_id) added in 0000_squashed_baseline.sql.
export const stageQualifications = pgTable("stage_qualifications", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  sourceContainerId: bigint("source_container_id", { mode: "number" }).references(() => stageContainers.id, { onDelete: "cascade" }),
  rankFrom: integer("rank_from"),
  rankTo: integer("rank_to"),
  sourceMatchId: bigint("source_match_id", { mode: "number" }).references(() => matches.id, { onDelete: "cascade" }),
  outcome: matchResultEnum("outcome"),
  destinationType: text("destination_type").notNull(), // 'container' | 'placement'
  destinationContainerId: bigint("destination_container_id", { mode: "number" }).references(() => stageContainers.id, { onDelete: "cascade" }), // may be in ANOTHER tournament
  placement: integer("placement"),
  placementLabel: text("placement_label"),
  points: integer("points"),
  cashPrizeAmount: numeric("cash_prize_amount", { precision: 12, scale: 2 }),
  cashPrizeCurrency: varchar("cash_prize_currency", { length: 8 }), // symbol (€, $, £, ...), not an ISO code
}, (t) => [
  index("stage_qualifications_source_container_id_idx").on(t.sourceContainerId),
]);

export const qualificationResults = pgTable("qualification_results", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  qualificationId: bigint("qualification_id", { mode: "number" }).notNull().references(() => stageQualifications.id, { onDelete: "cascade" }),
  entrantId: bigint("entrant_id", { mode: "number" }).notNull().references(() => entrants.id, { onDelete: "cascade" }),
  rank: integer("rank"),
}, (t) => [
  index("qualification_results_entrant_id_idx").on(t.entrantId),
  unique("qualification_results_qualification_entrant_unique").on(t.qualificationId, t.entrantId),
]);

export const pointEntries = pgTable("point_entries", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  teamId: bigint("team_id", { mode: "number" }).notNull().references(() => teams.id, { onDelete: "cascade" }),
  pointTypeId: bigint("point_type_id", { mode: "number" }).notNull().references(() => pointTypes.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // signed ledger entry, SUM not counter
  qualificationResultId: bigint("qualification_result_id", { mode: "number" }).references(() => qualificationResults.id, { onDelete: "cascade" }),
  reason: text("reason"),
});

// --- Match vetos (GC-Stats-specific, not shared with BRACKT) -------------
export const matchVetos = pgTable("match_vetos", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  matchId: bigint("match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
  entrantId: bigint("entrant_id", { mode: "number" }).notNull().references(() => entrants.id),
  mapName: text("map_name").notNull(),
  type: text("type").notNull(), // 'pick' | 'ban' | 'decider'
  order: integer("order").notNull(),
  side: char("side", { length: 3 }), // 'atk' | 'def'
  sidePickedByEntrantId: bigint("side_picked_by_entrant_id", { mode: "number" }).references(() => entrants.id),
}, (t) => [
  index("match_vetos_match_id_idx").on(t.matchId),
]);
