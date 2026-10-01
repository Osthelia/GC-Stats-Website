/**
 * GC-Stats - admin-sanctions
 *
 * Admin queries for /admin/sanctions: paginated, filterable sanction list
 * with derived active/expired/revoked status, plus status counts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, gt, isNull, isNotNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { adminDb as db } from "@gc-stats/db/client";
import { sanctions, users, teams } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";
import { SANCTION_TYPES, type SanctionType } from "@/lib/sanction-constants";

export { SANCTION_TYPES, type SanctionType };

export const SANCTIONS_PAGE_SIZE = 30;

export type SanctionStatus = "active" | "expired" | "revoked";
export type SanctionSort = "startsAt" | "type" | "status";
export type SortDirection = "asc" | "desc";

export type AdminSanctionRow = {
  id: number;
  userId: string | null;
  username: string | null;
  teamId: number | null;
  teamName: string | null;
  issuedByUsername: string | null;
  type: SanctionType;
  reason: string;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  revokedByUsername: string | null;
  status: SanctionStatus;
};

export function statusOf(row: { endsAt: Date | null; revokedAt: Date | null }): SanctionStatus {
  if (row.revokedAt) return "revoked";
  if (row.endsAt && row.endsAt.getTime() <= Date.now()) return "expired";
  return "active";
}

export async function listAdminSanctions(opts: {
  q: string;
  status: SanctionStatus | "";
  type: SanctionType | "";
  sort: SanctionSort;
  direction: SortDirection;
  page: number;
}): Promise<{ rows: AdminSanctionRow[]; total: number }> {
  const { q, status, type, sort, direction, page } = opts;

  const issuedBy = alias(users, "issued_by_user");
  const revokedByAlias = alias(users, "revoked_by_user");

  const conditions = [];
  if (type) conditions.push(eq(sanctions.type, type));
  if (q) {
    const numeric = /^\d+$/.test(q);
    const variants = typoVariants(q.toLowerCase());
    const clauses = [...variants.map((v) => foldedIlike(sanctions.reason, v)), ...variants.map((v) => foldedIlike(users.username, v)), ...variants.map((v) => foldedIlike(teams.name, v))];
    if (numeric) clauses.push(eq(sanctions.id, Number(q)));
    conditions.push(or(...clauses));
  }
  if (status === "revoked") conditions.push(isNotNull(sanctions.revokedAt));
  else if (status === "expired") conditions.push(and(isNull(sanctions.revokedAt), isNotNull(sanctions.endsAt), lte(sanctions.endsAt, new Date())));
  else if (status === "active") conditions.push(and(isNull(sanctions.revokedAt), or(isNull(sanctions.endsAt), gt(sanctions.endsAt, new Date()))));
  const where = conditions.length ? and(...conditions) : undefined;

  const sortCol = sort === "type" ? sanctions.type : sanctions.startsAt;
  const orderBy = direction === "asc" ? asc(sortCol) : desc(sortCol);

  const [pageRows, countRows] = await Promise.all([
    db
      .select({
        id: sanctions.id,
        userId: sanctions.userId,
        username: users.username,
        teamId: sanctions.teamId,
        teamName: teams.name,
        issuedByUsername: issuedBy.username,
        type: sanctions.type,
        reason: sanctions.reason,
        startsAt: sanctions.startsAt,
        endsAt: sanctions.endsAt,
        revokedAt: sanctions.revokedAt,
        revokedByUsername: revokedByAlias.username,
      })
      .from(sanctions)
      .leftJoin(users, eq(users.id, sanctions.userId))
      .leftJoin(teams, eq(teams.id, sanctions.teamId))
      .leftJoin(issuedBy, eq(issuedBy.id, sanctions.issuedBy))
      .leftJoin(revokedByAlias, eq(revokedByAlias.id, sanctions.revokedBy))
      .where(where)
      .orderBy(orderBy, desc(sanctions.id))
      .limit(SANCTIONS_PAGE_SIZE)
      .offset((page - 1) * SANCTIONS_PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sanctions)
      .leftJoin(users, eq(users.id, sanctions.userId))
      .leftJoin(teams, eq(teams.id, sanctions.teamId))
      .where(where),
  ]);

  const total = countRows[0]?.count ?? 0;

  return {
    rows: pageRows.map((r) => ({
      id: r.id,
      userId: r.userId,
      username: r.username,
      teamId: r.teamId,
      teamName: r.teamName,
      issuedByUsername: r.issuedByUsername,
      type: r.type as SanctionType,
      reason: r.reason,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt ? r.endsAt.toISOString() : null,
      revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
      revokedByUsername: r.revokedByUsername,
      status: statusOf(r),
    })),
    total,
  };
}

export async function getAdminSanctionCounts(): Promise<{ active: number; expired: number; revoked: number }> {
  const rows = await db.select({ endsAt: sanctions.endsAt, revokedAt: sanctions.revokedAt }).from(sanctions);
  const result = { active: 0, expired: 0, revoked: 0 };
  for (const row of rows) {
    const status = statusOf(row);
    if (status === "active") result.active += 1;
    else if (status === "expired") result.expired += 1;
    else result.revoked += 1;
  }
  return result;
}
