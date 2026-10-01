/**
 * GC-Stats — game module
 *
 * GC-Stats is Valorant-only. No `games` table; a fork targeting another
 * game would need to revisit far more than the DB schema, so this constant
 * is not meant as a multi-game abstraction, just a single named place to
 * change if that fork ever happens.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const GAME = {
  slug: "valorant",
  name: "VALORANT",
} as const;
