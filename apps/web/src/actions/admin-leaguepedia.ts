/**
 * GC-Stats - admin-leaguepedia
 *
 * Admin server actions for a LoL tournament's Leaguepedia link. Both read the game list from
 * Leaguepedia, so each one is a request and the result says what happened to the list.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { PERMISSIONS, lolTournaments } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";
import { getLeaguepediaLinkStatus, normalizeBasePage } from "@/lib/admin-leaguepedia";
import { refreshGameList } from "@/lib/leaguepedia-games";
import type { LeaguepediaError } from "@/lib/leaguepedia-client";

export type LeaguepediaLinkError = "invalidBasePage" | "notFound" | "notLinked" | "missingConfig" | "fetch";

export type LeaguepediaLinkResult = { ok: true; games: number } | { ok: false; error: LeaguepediaLinkError };

async function requireLolActor(): Promise<string> {
  const access = await requireActorPermission(PERMISSIONS.tournamentsManage, "lol");
  return access.userId;
}

/** Saves the base page and reads the game list. The link is only saved when the list was read. */
export async function saveLeaguepediaBasePage(tournamentId: number, basePage: string): Promise<LeaguepediaLinkResult> {
  const actorUserId = await requireLolActor();
  const overviewPage = normalizeBasePage(basePage);
  if (!overviewPage) return { ok: false, error: "invalidBasePage" };

  const [tournament] = await db.select({ id: lolTournaments.id }).from(lolTournaments).where(eq(lolTournaments.id, tournamentId));
  if (!tournament) return { ok: false, error: "notFound" };

  const result = await refreshGameList(tournamentId, overviewPage);
  if (!result.ok) return { ok: false, error: fetchError(result.error) };

  await logActivity({
    subject: "tournament",
    subjectId: tournamentId,
    event: "updated",
    description: `Set the Leaguepedia base page of tournament #${tournamentId} to ${overviewPage} (${result.data} games)`,
    actorUserId,
  });
  return { ok: true, games: result.data };
}

/** Reads the game list again from the saved base page. */
export async function refreshLeaguepediaGameList(tournamentId: number): Promise<LeaguepediaLinkResult> {
  const actorUserId = await requireLolActor();
  const { overviewPage } = await getLeaguepediaLinkStatus(tournamentId);
  if (!overviewPage) return { ok: false, error: "notLinked" };

  const result = await refreshGameList(tournamentId, overviewPage);
  if (!result.ok) return { ok: false, error: fetchError(result.error) };

  await logActivity({
    subject: "tournament",
    subjectId: tournamentId,
    event: "updated",
    description: `Refreshed the Leaguepedia game list of tournament #${tournamentId} (${result.data} games)`,
    actorUserId,
  });
  return { ok: true, games: result.data };
}

function fetchError(error: LeaguepediaError): LeaguepediaLinkError {
  return error.kind === "missingConfig" ? "missingConfig" : "fetch";
}
