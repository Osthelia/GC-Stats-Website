/**
 * GC-Stats - roster-sql
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sql } from "drizzle-orm";
import { rosterMemberships } from "@gc-stats/db";

/** Excludes entries that left on an unknown date (open period + has_left), which can't be placed on a given date. */
export const rosterPeriodIsDated = sql`NOT (${rosterMemberships.hasLeft} AND upper_inf(${rosterMemberships.period}))`;
