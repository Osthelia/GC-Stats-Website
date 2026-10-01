/**
 * GC-Stats - settings-sanctions
 *
 * Backs the "My sanctions" tab in account settings: a user's own visible
 * sanctions (never "note", internal only), paginated, plus an
 * ownership-checked detail lookup.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { sanctions } from "@gc-stats/db";
import { statusOf, type SanctionStatus } from "@/lib/admin-sanctions";
import type { SanctionType } from "@/lib/sanction-constants";

export const MY_SANCTIONS_PAGE_SIZE = 20;

// Notes are internal only, never shown to the sanctioned user (legal export excepted).
const VISIBLE_TYPES = ["warning", "mute", "suspension", "ban"] as const;

export type MySanctionRow = {
  id: number;
  type: SanctionType;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  status: SanctionStatus;
};

export type MySanctionDetail = MySanctionRow & {
  reason: string;
};

export async function listOwnSanctions(userId: string, page: number): Promise<{ rows: MySanctionRow[]; totalPages: number }> {
  const where = and(eq(sanctions.userId, userId), ne(sanctions.type, "note"));

  const [rows, countRows] = await Promise.all([
    db
      .select({ id: sanctions.id, type: sanctions.type, startsAt: sanctions.startsAt, endsAt: sanctions.endsAt, revokedAt: sanctions.revokedAt })
      .from(sanctions)
      .where(where)
      .orderBy(desc(sanctions.id))
      .limit(MY_SANCTIONS_PAGE_SIZE)
      .offset((page - 1) * MY_SANCTIONS_PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(sanctions).where(where),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      type: r.type as SanctionType,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt ? r.endsAt.toISOString() : null,
      revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
      status: statusOf(r),
    })),
    totalPages: Math.max(1, Math.ceil((countRows[0]?.count ?? 0) / MY_SANCTIONS_PAGE_SIZE)),
  };
}

/** Ownership checked before returning anything, never a 404 that would confirm the id exists to someone else — and a "note" is never returned, even to its own target. */
export async function getOwnSanctionDetail(userId: string, id: number): Promise<MySanctionDetail | null> {
  const [row] = await db
    .select({ id: sanctions.id, userId: sanctions.userId, type: sanctions.type, reason: sanctions.reason, startsAt: sanctions.startsAt, endsAt: sanctions.endsAt, revokedAt: sanctions.revokedAt })
    .from(sanctions)
    .where(eq(sanctions.id, id))
    .limit(1);
  if (!row || row.userId !== userId) return null;
  if (!(VISIBLE_TYPES as readonly string[]).includes(row.type)) return null;

  return {
    id: row.id,
    type: row.type as SanctionType,
    reason: row.reason,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    status: statusOf(row),
  };
}
