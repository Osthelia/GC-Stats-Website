/**
 * GC-Stats - admin-analytics
 *
 * Admin queries for /admin/analytics: per-region daily page view series
 * over the last 30 days, and the top pages list by view count.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, gte, or, sql, type SQL } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { pageViews } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";

const CHART_WINDOW_DAYS = 30;

function startOfWindow(days: number): string {
  const now = new Date();
  const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * 86_400_000);
  return startUtc.toISOString().slice(0, 10);
}

export type TopPageSort = "page" | "views";
export type SortDirection = "asc" | "desc";

export type TopPageRow = { uri: string; views: number };

export const TOP_PAGES_PAGE_SIZE = 30;

/** Top pages by view count over the last 30 days — mirrors V1's AnalyticsController::index() topPages query. */
export async function listTopPages(opts: { q: string; sort: TopPageSort; direction: SortDirection; page: number }): Promise<{ rows: TopPageRow[]; total: number }> {
  const { q, sort, direction, page } = opts;
  const since = startOfWindow(CHART_WINDOW_DAYS);

  const conditions: (SQL | undefined)[] = [gte(pageViews.viewedAt, since)];
  if (q) {
    const variants = typoVariants(q.toLowerCase());
    conditions.push(or(...variants.map((v) => foldedIlike(pageViews.uri, v))));
  }
  const where = and(...conditions);

  const totalExpr = sql<number>`sum(${pageViews.count})`;
  const orderBy = direction === "desc" ? desc(sort === "page" ? pageViews.uri : totalExpr) : asc(sort === "page" ? pageViews.uri : totalExpr);

  const [rows, totalRows] = await Promise.all([
    db
      .select({ uri: pageViews.uri, views: totalExpr })
      .from(pageViews)
      .where(where)
      .groupBy(pageViews.uri)
      .orderBy(orderBy, asc(pageViews.uri))
      .limit(TOP_PAGES_PAGE_SIZE)
      .offset((page - 1) * TOP_PAGES_PAGE_SIZE),
    db.select({ total: sql<number>`count(distinct ${pageViews.uri})` }).from(pageViews).where(where),
  ]);

  return { rows: rows.map((r) => ({ uri: r.uri, views: Number(r.views) })), total: Number(totalRows[0]?.total ?? 0) };
}
