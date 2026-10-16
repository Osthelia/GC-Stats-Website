/**
 * GC-Stats - container-order
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, sql, type SQL } from "drizzle-orm";
import { gameTables } from "@gc-stats/db";
import type { GameSlug } from "@gc-stats/db/game";

/** Insert value placing a new container last in its stage. */
export function nextContainerDisplayOrder(game: GameSlug, stageId: number): SQL<number> {
  const { stageContainers } = gameTables(game);
  return sql<number>`(select coalesce(max(${stageContainers.displayOrder}), 0) + 1 from ${stageContainers} where ${stageContainers.stageId} = ${stageId})`;
}

export function containerOrderBy(game: GameSlug) {
  const { stageContainers } = gameTables(game);
  return [asc(stageContainers.displayOrder), asc(stageContainers.id)] as const;
}
