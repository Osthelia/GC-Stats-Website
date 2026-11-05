/**
 * GC-Stats — pickem module
 *
 * Enums shared by the pick'em tables. The tables themselves exist once per
 * game, see game-tables.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgEnum } from "drizzle-orm/pg-core";

export const pickemScoringModeEnum = pgEnum("pickem_scoring_mode", ["default", "custom"]);
export const pickemRewardKindEnum = pgEnum("pickem_reward_kind", ["top1pct", "top5pct", "perfect"]);
// How Swiss/round robin containers are predicted: their final standings, or the winner of each match.
export const pickemGroupPickModeEnum = pgEnum("pickem_group_pick_mode", ["standings", "matches"]);
