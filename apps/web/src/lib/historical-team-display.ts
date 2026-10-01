/**
 * GC-Stats - historical-team-display
 *
 * Batched resolver for a team's name/logo as they were at a given point in
 * time, used by match/team/player pages instead of the live name/logo so a
 * rebrand doesn't rewrite history.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { teams, teamNameHistory } from "@gc-stats/db";
import { getEntityLogosBatch, themedLogoUrlsAt, type AdminLogoEntry, type ThemedLogoUrls } from "@/lib/admin-logos";
import { rangeLower, rangeUpper } from "@/lib/daterange";

type NameHistoryEntry = { name: string; since: string | null; until: string | null; isVisible: boolean };

function periodContainsDate(since: string | null, until: string | null, at: string): boolean {
  if (since && at < since) return false;
  if (until && at >= until) return false;
  return true;
}

export type TeamDisplayResolver = {
  /** A team's name as it was on `at` — `fallbackName` (typically `entrants.displayName`, itself a snapshot at registration) is used whenever there's no documented rename for that date. */
  nameAt(teamId: number, at: Date, fallbackName: string): string;
  /** A team's logo as it was on `at`. */
  logosAt(teamId: number, at: Date): ThemedLogoUrls;
  /** Current short tag, null when unknown. */
  shortNameOf(teamId: number): string | null;
  /** Raw logo rows, for callers that need another URL shape than `logosAt`. */
  logoEntriesOf(teamId: number): AdminLogoEntry[];
};

/**
 * Batched resolver for a team's name/logo as they were at a given point in time — what
 * match/team/player pages show instead of the live name/logo, so a rebrand doesn't rewrite
 * history. Falls back to the current name/logo whenever the matching `team_name_history`/`logos`
 * row has been masked by an admin (`isVisible: false`), never surfacing a hidden identity.
 */
export async function buildTeamDisplayResolver(teamIds: number[]): Promise<TeamDisplayResolver> {
  const ids = [...new Set(teamIds)];
  if (ids.length === 0) {
    return { nameAt: (_teamId, _at, fallbackName) => fallbackName, logosAt: () => ({ dark: null, light: null }), shortNameOf: () => null, logoEntriesOf: () => [] };
  }

  const [historyRows, currentRows, logosByTeam] = await Promise.all([
    db
      .select({ teamId: teamNameHistory.teamId, name: teamNameHistory.name, period: teamNameHistory.period, isVisible: teamNameHistory.isVisible })
      .from(teamNameHistory)
      .where(inArray(teamNameHistory.teamId, ids)),
    db.select({ id: teams.id, name: teams.name, shortName: teams.shortName }).from(teams).where(inArray(teams.id, ids)),
    getEntityLogosBatch("team", ids),
  ]);

  const currentNameById = new Map(currentRows.map((t) => [t.id, t.name]));
  const shortNameById = new Map(currentRows.map((t) => [t.id, t.shortName]));
  const historyByTeam = new Map<number, NameHistoryEntry[]>();
  for (const r of historyRows) {
    const entry: NameHistoryEntry = { name: r.name, since: rangeLower(r.period), until: rangeUpper(r.period), isVisible: r.isVisible };
    const list = historyByTeam.get(r.teamId);
    if (list) list.push(entry);
    else historyByTeam.set(r.teamId, [entry]);
  }

  return {
    nameAt(teamId, at, fallbackName) {
      const entries = historyByTeam.get(teamId);
      if (!entries || entries.length === 0) return fallbackName;
      const atStr = at.toISOString().slice(0, 10);
      const match = entries.find((e) => periodContainsDate(e.since, e.until, atStr));
      if (!match) return fallbackName;
      return match.isVisible ? match.name : (currentNameById.get(teamId) ?? fallbackName);
    },
    logosAt(teamId, at) {
      const entries = logosByTeam.get(teamId) ?? [];
      return themedLogoUrlsAt(entries, "team", at.toISOString().slice(0, 10));
    },
    shortNameOf(teamId) {
      return shortNameById.get(teamId) ?? null;
    },
    logoEntriesOf(teamId) {
      return logosByTeam.get(teamId) ?? [];
    },
  };
}
