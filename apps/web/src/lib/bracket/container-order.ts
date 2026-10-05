/**
 * GC-Stats - container-order
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, sql, type SQL } from "drizzle-orm";
import { stageContainers } from "@gc-stats/db";

/** Insert value placing a new container last in its stage. */
export function nextContainerDisplayOrder(stageId: number): SQL<number> {
  return sql<number>`(select coalesce(max(${stageContainers.displayOrder}), 0) + 1 from ${stageContainers} where ${stageContainers.stageId} = ${stageId})`;
}

/** Admin-set position within the stage, id as tie-break. */
export const containerOrderBy = [asc(stageContainers.displayOrder), asc(stageContainers.id)] as const;
