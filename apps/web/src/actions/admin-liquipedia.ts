/**
 * GC-Stats - admin-liquipedia
 *
 * Admin server actions for the Liquipedia name <-> team table (one Liquipedia
 * page name per team, and vice versa).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { entrants, liquipediaTeamNames, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { findLiquipediaMappings } from "@/lib/admin-liquipedia";
import { validateLiquipediaName, type LiquipediaNameError } from "@/lib/liquipedia-name-validation";

export type LiquipediaRowError = { error: LiquipediaNameError | "duplicate" | "nameTaken" | "teamNotInTournament"; teamName?: string };

export type SaveLiquipediaNamesResult =
  | { ok: true; saved: number }
  | { ok: false; error?: "empty" | "tooMany"; rowErrors: Record<number, LiquipediaRowError> };

const MAX_ROWS = 300;

export async function saveLiquipediaTeamNames(tournamentId: number, rows: { teamId: number; name: string }[]): Promise<SaveLiquipediaNamesResult> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);

  if (!Number.isInteger(tournamentId) || !Array.isArray(rows)) return { ok: false, error: "empty", rowErrors: {} };
  if (rows.length === 0) return { ok: false, error: "empty", rowErrors: {} };
  if (rows.length > MAX_ROWS) return { ok: false, error: "tooMany", rowErrors: {} };

  const rowErrors: Record<number, LiquipediaRowError> = {};
  const cleaned: { teamId: number; name: string }[] = [];
  const seenTeams = new Set<number>();
  const seenNames = new Map<string, number>();

  for (const row of rows) {
    if (!row || !Number.isInteger(row.teamId) || seenTeams.has(row.teamId)) continue;
    seenTeams.add(row.teamId);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const nameError = validateLiquipediaName(name);
    if (nameError) {
      rowErrors[row.teamId] = { error: nameError };
      continue;
    }
    const key = name.toLowerCase();
    const otherTeamId = seenNames.get(key);
    if (otherTeamId !== undefined) {
      rowErrors[row.teamId] = { error: "duplicate" };
      rowErrors[otherTeamId] = { error: "duplicate" };
      continue;
    }
    seenNames.set(key, row.teamId);
    cleaned.push({ teamId: row.teamId, name });
  }

  // Only teams actually registered in this tournament can be completed from its page.
  const teamIds = cleaned.map((r) => r.teamId);
  const registered = teamIds.length
    ? await db
        .select({ teamId: entrants.teamId })
        .from(entrants)
        .where(and(eq(entrants.tournamentId, tournamentId), isNotNull(entrants.teamId), inArray(entrants.teamId, teamIds)))
    : [];
  const registeredIds = new Set(registered.map((r) => r.teamId));
  for (const row of cleaned) if (!registeredIds.has(row.teamId)) rowErrors[row.teamId] = { error: "teamNotInTournament" };

  // A name already held by a team outside this submission stays with it.
  const existing = await findLiquipediaMappings([], cleaned.map((r) => r.name));
  for (const mapping of existing) {
    if (seenTeams.has(mapping.teamId)) continue;
    const row = cleaned.find((r) => r.name.toLowerCase() === mapping.name.toLowerCase());
    if (row) rowErrors[row.teamId] = { error: "nameTaken", teamName: mapping.teamName };
  }

  if (Object.keys(rowErrors).length > 0) return { ok: false, rowErrors };

  await db.transaction(async (tx) => {
    await tx.delete(liquipediaTeamNames).where(inArray(liquipediaTeamNames.teamId, teamIds));
    await tx.insert(liquipediaTeamNames).values(cleaned.map((r) => ({ teamId: r.teamId, name: r.name })));
  });

  return { ok: true, saved: cleaned.length };
}
