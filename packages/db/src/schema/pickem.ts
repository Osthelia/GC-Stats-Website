/**
 * GC-Stats — pickem module
 *
 * Pick'em feature tables: per-stage settings, groups and their members,
 * per-phase points, match picks, standing picks, and rewards.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgTable, pgEnum, bigserial, bigint, integer, text, varchar, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { stages, stageContainers, matches, entrants, tournaments } from "./bracket";

export const pickemScoringModeEnum = pgEnum("pickem_scoring_mode", ["default", "custom"]);
export const pickemRewardKindEnum = pgEnum("pickem_reward_kind", ["top1pct", "top5pct", "perfect"]);

// Per-stage (phase) pick'em configuration, admin only. Predictions open at
// `opensAt`; they close at the stage's own earliest match `scheduledAt`
// (computed at read time from `matches`, never stored — a match can be
// rescheduled after this row is created).
export const pickemStageSettings = pgTable(
  "pickem_stage_settings",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    stageId: bigint("stage_id", { mode: "number" }).notNull().references(() => stages.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
  },
  (t) => [unique("pickem_stage_settings_stage_unique").on(t.stageId)]
);

// A group is scoped to one tournament — its leaderboard spans every
// pick'em-enabled stage of that tournament only.
export const pickemGroups = pgTable(
  "pickem_groups",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tournamentId: bigint("tournament_id", { mode: "number" }).notNull().references(() => tournaments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    scoringMode: pickemScoringModeEnum("scoring_mode").notNull().default("default"),
    joinCode: varchar("join_code", { length: 12 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("pickem_groups_join_code_unique").on(t.joinCode)]
);

export const pickemGroupMembers = pgTable(
  "pickem_group_members",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    groupId: bigint("group_id", { mode: "number" }).notNull().references(() => pickemGroups.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("pickem_group_members_group_user_unique").on(t.groupId, t.userId)]
);

// Custom points for one phase of a group — a row only exists when the group
// opted into scoringMode='custom' for that stage. Missing row (default mode,
// or custom mode without an explicit override yet) falls back to
// lib/pickem/scoring.ts::DEFAULT_PICKEM_SCORING.
export const pickemGroupPhasePoints = pgTable(
  "pickem_group_phase_points",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    groupId: bigint("group_id", { mode: "number" }).notNull().references(() => pickemGroups.id, { onDelete: "cascade" }),
    stageId: bigint("stage_id", { mode: "number" }).notNull().references(() => stages.id, { onDelete: "cascade" }),
    teamCorrectPoints: integer("team_correct_points").notNull(),
    outcomeCorrectPoints: integer("outcome_correct_points").notNull(),
    advancementPerRoundPoints: integer("advancement_per_round_points").notNull(),
    standingRankPoints: integer("standing_rank_points").notNull(),
  },
  (t) => [unique("pickem_group_phase_points_group_stage_unique").on(t.groupId, t.stageId)]
);

// One predicted winner per bracket-container match. Locked once the stage's
// pick'em window closes (first match of the stage) — enforced in
// lib/pickem/pickem-data.ts, not by a DB constraint (the lock deadline
// moves with matches.scheduledAt).
export const pickemMatchPicks = pgTable(
  "pickem_match_picks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    stageId: bigint("stage_id", { mode: "number" }).notNull().references(() => stages.id, { onDelete: "cascade" }),
    matchId: bigint("match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
    predictedWinnerEntrantId: bigint("predicted_winner_entrant_id", { mode: "number" }).notNull().references(() => entrants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("pickem_match_picks_user_match_unique").on(t.userId, t.matchId)]
);

// One predicted final rank per entrant of a group/Swiss/round-robin
// container — "1er/2e/3e/etc", not a match by match prediction.
export const pickemStandingPicks = pgTable(
  "pickem_standing_picks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    stageId: bigint("stage_id", { mode: "number" }).notNull().references(() => stages.id, { onDelete: "cascade" }),
    containerId: bigint("container_id", { mode: "number" }).notNull().references(() => stageContainers.id, { onDelete: "cascade" }),
    entrantId: bigint("entrant_id", { mode: "number" }).notNull().references(() => entrants.id, { onDelete: "cascade" }),
    predictedRank: integer("predicted_rank").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("pickem_standing_picks_user_container_entrant_unique").on(t.userId, t.containerId, t.entrantId),
    unique("pickem_standing_picks_user_container_rank_unique").on(t.userId, t.containerId, t.predictedRank),
  ]
);

// Awarded once against the PUBLIC default-scoring leaderboard only (never a
// custom group's) — kept simple and comparable across
// every participant of a stage. Computed lazily (lib/pickem/rewards.ts) the
// first time the stage's pick'em results are viewed after it completes.
export const pickemRewards = pgTable(
  "pickem_rewards",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    stageId: bigint("stage_id", { mode: "number" }).notNull().references(() => stages.id, { onDelete: "cascade" }),
    kind: pickemRewardKindEnum("kind").notNull(),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("pickem_rewards_user_stage_kind_unique").on(t.userId, t.stageId, t.kind)]
);
