/**
 * GC-Stats - liquipedia-bracket-template
 *
 * Liquipedia bracket templates linked to our bracket containers.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { inArray, isNotNull, and } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { stageContainers } from "@gc-stats/db";

export const LIQUIPEDIA_BRACKET_GENERATOR_URL = "https://liquipedia.net/valorant/Special:RunQuery/BracketCopyPaste";

/** Template of each container that has one. */
export async function getBracketTemplates(containerIds: number[]): Promise<Map<number, string>> {
  if (containerIds.length === 0) return new Map();
  const rows = await db
    .select({ id: stageContainers.id, template: stageContainers.liquipediaBracketTemplate })
    .from(stageContainers)
    .where(and(inArray(stageContainers.id, containerIds), isNotNull(stageContainers.liquipediaBracketTemplate)));
  return new Map(rows.map((r) => [r.id, r.template!]));
}
