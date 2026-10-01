/**
 * GC-Stats - admin-emotes
 *
 * Admin queries for /admin/emotes: paginated, filterable emote list and
 * the distinct source values in use.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { emotes } from "@gc-stats/db";
import { emoteImageUrl } from "@gc-stats/storage";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";

export { EMOTE_SOURCE_RE } from "@/lib/emote-sources";

export type EmoteSort = "name" | "source" | "status";
export type SortDirection = "asc" | "desc";
export type EmoteStatusFilter = "" | "active" | "inactive";

export type AdminEmoteRow = {
  id: number;
  name: string;
  imagePath: string;
  source: string;
  isActive: boolean;
};

export const EMOTES_PAGE_SIZE = 50;

export async function listAdminEmotes(opts: {
  q: string;
  sort: EmoteSort;
  direction: SortDirection;
  status: EmoteStatusFilter;
  page: number;
}): Promise<{ rows: AdminEmoteRow[]; total: number }> {
  const { q, sort, direction, status, page } = opts;
  const conditions = [];

  if (q) {
    const numeric = /^\d+$/.test(q);
    const variants = typoVariants(q.toLowerCase());
    const clauses = variants.map((v) => foldedIlike(emotes.name, v));
    if (numeric) clauses.push(eq(emotes.id, Number(q)));
    conditions.push(or(...clauses));
  }

  if (status === "active") conditions.push(eq(emotes.isActive, true));
  if (status === "inactive") conditions.push(eq(emotes.isActive, false));

  const where = conditions.length ? and(...conditions) : undefined;

  const sortCol = sort === "source" ? emotes.source : sort === "status" ? emotes.isActive : emotes.name;
  const orderBy = direction === "desc" ? desc(sortCol) : asc(sortCol);

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(emotes)
      .where(where)
      .orderBy(orderBy, asc(emotes.id))
      .limit(EMOTES_PAGE_SIZE)
      .offset((page - 1) * EMOTES_PAGE_SIZE),
    db.select({ total: sql<number>`count(*)` }).from(emotes).where(where),
  ]);

  return { rows: rows.map((r) => ({ ...r, imagePath: emoteImageUrl(r.imagePath) })), total: Number(totalRows[0]?.total ?? 0) };
}

/** Distinct source values currently in use — powers the create/edit hint and keeps us honest about what's actually in the DB rather than a hardcoded guess. */
export async function listEmoteSources(): Promise<string[]> {
  const rows = await db.selectDistinct({ source: emotes.source }).from(emotes).orderBy(asc(emotes.source));
  return rows.map((r) => r.source);
}
