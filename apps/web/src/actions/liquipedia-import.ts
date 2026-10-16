/**
 * GC-Stats - liquipedia-import
 *
 * Admin server action that reads the Liquipedia pages of a tournament's
 * mapped teams and people and opens change requests for what we are missing.
 * Nothing is written to the live tables, staff reviews every request.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { users, PERMISSIONS, gameTables } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { planLiquipediaImport } from "@/lib/liquipedia-import";
import type { GameSlug } from "@gc-stats/db/game";

export type LiquipediaImportResult =
  | { ok: true; created: number; upToDate: number; alreadyPending: number; noPage: string[] }
  | { ok: false; error: "invalid" | "unreachable" | "busy" };

// Tournaments being imported right now, so a double submit cannot plan twice before the first insert.
const runningImports = new Set<number>();

export async function importLiquipediaData(game: GameSlug, tournamentId: number): Promise<LiquipediaImportResult> {
  const access = await requireActorPermission(PERMISSIONS.tournamentsManage, game);
  if (!Number.isInteger(tournamentId)) return { ok: false, error: "invalid" };
  if (runningImports.has(tournamentId)) return { ok: false, error: "busy" };

  runningImports.add(tournamentId);
  try {
    return await runImport(game, tournamentId, access.userId);
  } finally {
    runningImports.delete(tournamentId);
  }
}

async function runImport(game: GameSlug, tournamentId: number, userId: string): Promise<LiquipediaImportResult> {
  const { changeRequests, changeRequestItems, tournaments } = gameTables(game);
  let plan;
  try {
    plan = await planLiquipediaImport(game, tournamentId);
  } catch {
    return { ok: false, error: "unreachable" };
  }

  if (plan.proposals.length > 0) {
    const [requester] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
    const [tournament] = await db.select({ name: tournaments.name }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
    const requesterName = requester?.username ?? userId;
    await db.transaction(async (tx) => {
      for (const proposal of plan.proposals) {
        const [row] = await tx
          .insert(changeRequests)
          .values({ subjectType: proposal.subjectType, subjectId: proposal.subjectId, requestedBy: null, reason: `${proposal.reason} (requested by ${requesterName}, from tournament ${tournament?.name ?? tournamentId})`, status: "pending" })
          .returning({ id: changeRequests.id });
        await tx.insert(changeRequestItems).values(
          proposal.items.map((item) => ({ changeRequestId: row!.id, field: item.field, oldValue: item.oldValue, newValue: item.newValue, status: "pending" }))
        );
      }
    });
  }

  return { ok: true, created: plan.proposals.length, upToDate: plan.upToDate, alreadyPending: plan.alreadyPending, noPage: plan.noPage };
}
