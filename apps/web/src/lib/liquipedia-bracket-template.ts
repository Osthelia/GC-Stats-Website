/**
 * GC-Stats - liquipedia-bracket-template
 *
 * Liquipedia bracket templates linked to our bracket containers.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { inArray, isNotNull, and } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { gameTables } from "@gc-stats/db";
import { GAME_INFO, type GameSlug } from "@gc-stats/db/game";

export const liquipediaBracketGeneratorUrl = (game: GameSlug) => `https://liquipedia.net/${GAME_INFO[game].liquipediaWiki}/Special:RunQuery/BracketCopyPaste`;

/** Template of each container that has one. */
export async function getBracketTemplates(game: GameSlug, containerIds: number[]): Promise<Map<number, string>> {
  const { stageContainers } = gameTables(game);
  if (containerIds.length === 0) return new Map();
  const rows = await db
    .select({ id: stageContainers.id, template: stageContainers.liquipediaBracketTemplate })
    .from(stageContainers)
    .where(and(inArray(stageContainers.id, containerIds), isNotNull(stageContainers.liquipediaBracketTemplate)));
  return new Map(rows.map((r) => [r.id, r.template!]));
}
