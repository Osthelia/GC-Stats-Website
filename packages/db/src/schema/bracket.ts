/**
 * GC-Stats — bracket module
 *
 * Enums shared by the bracket tables. The tables themselves exist once per
 * game, see game-tables.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgEnum } from "drizzle-orm/pg-core";

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
