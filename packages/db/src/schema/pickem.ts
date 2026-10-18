/**
 * GC-Stats — pickem module
 *
 * Enums shared by the pick'em tables. The tables themselves exist once per
 * game, see game-tables.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgEnum } from "drizzle-orm/pg-core";

export const pickemScoringModeEnum = pgEnum("pickem_scoring_mode", ["default", "custom"]);
export const pickemRewardKindEnum = pgEnum("pickem_reward_kind", ["top1pct", "top5pct", "perfect"]);
