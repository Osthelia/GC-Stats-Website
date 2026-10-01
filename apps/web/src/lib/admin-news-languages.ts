/**
 * GC-Stats - admin-news-languages
 *
 * Admin queries for /admin/news-languages: paginated, sortable, searchable
 * list of news languages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { newsLanguages } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";

export type NewsLanguageSort = "code" | "name" | "sortOrder";
export type SortDirection = "asc" | "desc";

export type AdminNewsLanguageRow = {
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export const NEWS_LANGUAGES_PAGE_SIZE = 30;

export async function listAdminNewsLanguages(opts: { q: string; sort: NewsLanguageSort; direction: SortDirection; page: number }): Promise<{ rows: AdminNewsLanguageRow[]; total: number }> {
  const { q, sort, direction, page } = opts;
  const conditions = [];

  if (q) {
    const variants = typoVariants(q.toLowerCase());
    const clauses = variants.flatMap((v) => [foldedIlike(newsLanguages.code, v), foldedIlike(newsLanguages.name, v)]);
    conditions.push(or(...clauses));
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const sortCol = sort === "name" ? newsLanguages.name : sort === "sortOrder" ? newsLanguages.sortOrder : newsLanguages.code;
  const orderBy = direction === "desc" ? desc(sortCol) : asc(sortCol);

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(newsLanguages)
      .where(where)
      .orderBy(orderBy, asc(newsLanguages.code))
      .limit(NEWS_LANGUAGES_PAGE_SIZE)
      .offset((page - 1) * NEWS_LANGUAGES_PAGE_SIZE),
    db.select({ total: sql<number>`count(*)` }).from(newsLanguages).where(where),
  ]);

  return { rows, total: Number(totalRows[0]?.total ?? 0) };
}
