/**
 * GC-Stats - seed-roster-watch-accounts
 *
 * Adds a followed X account for every team entered in a (non ghost) tournament that
 * starts this year, using the twitter social of the team. Teams without one are listed.
 * Existing accounts are never touched.
 *
 * Usage (from apps/web): npm run seed:roster-watch [-- --dry-run]
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, gte, isNotNull } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { entrants, teams, tournaments, xMonitoredAccounts } from "@gc-stats/db";
import { normalizeXHandle } from "../src/lib/roster-watch/review";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;
  const rows = await db
    .selectDistinct({ id: teams.id, name: teams.name, socials: teams.socials })
    .from(entrants)
    .innerJoin(tournaments, eq(tournaments.id, entrants.tournamentId))
    .innerJoin(teams, eq(teams.id, entrants.teamId))
    .where(and(isNotNull(entrants.teamId), eq(tournaments.isGhost, false), gte(tournaments.startDate, yearStart)));

  let added = 0;
  let existing = 0;
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const team of rows) {
    const twitter = (team.socials as Record<string, string | undefined>).twitter;
    if (!twitter?.trim()) {
      missing.push(team.name);
      continue;
    }
    const handle = normalizeXHandle(twitter);
    if (!handle.ok) {
      invalid.push(`${team.name} (${twitter})`);
      continue;
    }
    if (DRY_RUN) {
      added++;
      continue;
    }
    const inserted = await db.insert(xMonitoredAccounts).values({ teamId: team.id, xHandle: handle.handle }).onConflictDoNothing({ target: xMonitoredAccounts.xHandle }).returning({ id: xMonitoredAccounts.id });
    if (inserted.length > 0) added++;
    else existing++;
  }

  console.log("[seed-roster-watch] %d team(s), %d %s, %d already followed", rows.length, added, DRY_RUN ? "to add" : "added", existing);
  if (missing.length > 0) console.log("[seed-roster-watch] no twitter social (%d): %s", missing.length, missing.join(", "));
  if (invalid.length > 0) console.log("[seed-roster-watch] unreadable twitter social (%d): %s", invalid.length, invalid.join(", "));
  process.exit(0);
}

main().catch((error) => {
  console.error("[seed-roster-watch] failed", error);
  process.exit(1);
});
