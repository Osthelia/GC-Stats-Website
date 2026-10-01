/**
 * GC-Stats - rate-limit-costs
 *
 * Per-minute ratelimit cost of the heavier V2 entity endpoints (teams/players)
 * — they bundle achievements, matches, roster and press in one call, worth
 * more than a plain lookup.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const TEAM_PLAYER_ENTITY_COST = 10;
