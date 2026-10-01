/**
 * GC-Stats - admin-point-types
 *
 * Admin query for /admin/point-types: paginated, sortable, searchable
 * point type list.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { pointTypes } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";

export type PointTypeSort = "name" | "label" | "startDate" | "endDate";
export type SortDirection = "asc" | "desc";

export type AdminPointTypeRow = {
  id: number;
  name: string;
  label: string;
  startDate: string;
  endDate: string;
};

export const POINT_TYPES_PAGE_SIZE = 30;

export async function listAdminPointTypes(opts: { q: string; sort: PointTypeSort; direction: SortDirection; page: number }): Promise<{ rows: AdminPointTypeRow[]; total: number }> {
  const { q, sort, direction, page } = opts;
  const conditions = [];

  if (q) {
    const numeric = /^\d+$/.test(q);
    const variants = typoVariants(q.toLowerCase());
    const clauses = variants.flatMap((v) => [foldedIlike(pointTypes.name, v), foldedIlike(pointTypes.label, v)]);
    if (numeric) clauses.push(eq(pointTypes.id, Number(q)));
    conditions.push(or(...clauses));
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const sortCol = sort === "label" ? pointTypes.label : sort === "startDate" ? pointTypes.startDate : sort === "endDate" ? pointTypes.endDate : pointTypes.name;
  const orderBy = direction === "desc" ? desc(sortCol) : asc(sortCol);

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(pointTypes)
      .where(where)
      .orderBy(orderBy, asc(pointTypes.id))
      .limit(POINT_TYPES_PAGE_SIZE)
      .offset((page - 1) * POINT_TYPES_PAGE_SIZE),
    db.select({ total: sql<number>`count(*)` }).from(pointTypes).where(where),
  ]);

  return { rows, total: Number(totalRows[0]?.total ?? 0) };
}
