/**
 * GC-Stats - settings-change-requests
 *
 * Backs the "My change requests" tab in account settings: a user's own
 * change requests, paginated, plus an ownership-checked detail lookup that
 * reuses the admin detail query.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { desc, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { gameTables } from "@gc-stats/db";
import type { ChangeRequestSubjectType } from "@/lib/change-request-fields";
import { subjectLabels, getAdminChangeRequestDetail, type ChangeRequestStatus, type AdminChangeRequestDetail } from "@/lib/admin-change-requests";
import { GAMES, type GameSlug } from "@gc-stats/db/game";

export const MY_CHANGE_REQUESTS_PAGE_SIZE = 20;

export type MyChangeRequestRow = {
  id: number;
  game: GameSlug;
  subjectType: ChangeRequestSubjectType;
  subjectId: number;
  subjectLabel: string | null;
  status: ChangeRequestStatus;
  createdAt: string;
};

/** The user's change requests of every game, newest first. A user's own list stays small, so the games are merged before paging. */
export async function listOwnChangeRequests(userId: string, page: number): Promise<{ rows: MyChangeRequestRow[]; totalPages: number }> {
  const perGame = await Promise.all(
    GAMES.map(async (game) => {
      const { changeRequests } = gameTables(game);
      const rows = await db
        .select({ id: changeRequests.id, subjectType: changeRequests.subjectType, subjectId: changeRequests.subjectId, status: changeRequests.status, createdAt: changeRequests.createdAt })
        .from(changeRequests)
        .where(eq(changeRequests.requestedBy, userId))
        .orderBy(desc(changeRequests.id));
      return rows.map((r) => ({ ...r, game }));
    })
  );
  const all = perGame.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const pageRows = all.slice((page - 1) * MY_CHANGE_REQUESTS_PAGE_SIZE, page * MY_CHANGE_REQUESTS_PAGE_SIZE);

  const labels = new Map<string, string | null>();
  await Promise.all(
    GAMES.flatMap((game) =>
      (["team", "person"] as const).map(async (type) => {
        const ids = pageRows.filter((r) => r.game === game && r.subjectType === type).map((r) => r.subjectId);
        const found = await subjectLabels(game, type, ids);
        for (const [id, label] of found) labels.set(`${game}:${type}:${id}`, label);
      })
    )
  );

  return {
    rows: pageRows.map((r) => ({
      id: r.id,
      game: r.game,
      subjectType: r.subjectType as ChangeRequestSubjectType,
      subjectId: r.subjectId,
      subjectLabel: labels.get(`${r.game}:${r.subjectType}:${r.subjectId}`) ?? null,
      status: r.status as ChangeRequestStatus,
      createdAt: r.createdAt.toISOString(),
    })),
    totalPages: Math.max(1, Math.ceil(all.length / MY_CHANGE_REQUESTS_PAGE_SIZE)),
  };
}

/** Ownership-checked before reusing the admin detail query — never a 403 that would confirm the id exists to someone else. */
export async function getMyChangeRequestDetail(game: GameSlug, userId: string, id: number): Promise<AdminChangeRequestDetail | null> {
  const { changeRequests } = gameTables(game);
  const [row] = await db.select({ requestedBy: changeRequests.requestedBy }).from(changeRequests).where(eq(changeRequests.id, id)).limit(1);
  if (!row || row.requestedBy !== userId) return null;

  return getAdminChangeRequestDetail(game, id);
}
