/**
 * GC-Stats - admin-data
 *
 * Core entity counts (users, teams, tournaments, players, matches) shown
 * on the /admin dashboard.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { count } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { users, teams, tournaments, people, matches } from "@gc-stats/db";

export type DashboardCounts = {
  users: number;
  teams: number;
  tournaments: number;
  players: number;
  matches: number;
};

/** Same 4 core counts as V1's admin dashboard (tournaments/teams/players/matches), plus V2's own `users` card. */
export async function getDashboardCounts(): Promise<DashboardCounts> {
  const [[u], [t], [tr], [p], [m]] = await Promise.all([
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(teams),
    db.select({ value: count() }).from(tournaments),
    db.select({ value: count() }).from(people),
    db.select({ value: count() }).from(matches),
  ]);
  return { users: u!.value, teams: t!.value, tournaments: tr!.value, players: p!.value, matches: m!.value };
}
