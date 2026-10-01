/**
 * GC-Stats - news
 *
 * Query helpers for the API v2 news listing: published articles, paginated,
 * optionally scoped to a team/player/tournament via `news_relations`.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { news, organizations } from "@gc-stats/db";
import { isNewsPublishedCondition } from "@/lib/news-publish-condition";
import { exclusiveUpperBound } from "../../v1/params";
import { getThemedLogoUrlsBatch, type ApiThemedLogoUrls } from "../../v1/logo-response";
import type { NewsFilter } from "../params";

export type ApiNewsOrganizationRef = { id: number; name: string; logos: ApiThemedLogoUrls };

export type ApiNewsEntry = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  image_cover: string | null;
  lang: string;
  is_featured: boolean;
  published_at: string | null;
  organization: ApiNewsOrganizationRef | null;
};

export type ApiPaginatedNews = { page: number; per_page: number; total: number; total_pages: number; data: ApiNewsEntry[] };

/**
 * Global published news listing, most recent first — always paginated (same
 * perf rule as matches/vods). `team_id`/`person_id`/`tournament_id` filter
 * via `news_relations` (the polymorphic "this article is about" join used by
 * the public news page), unlike team/player/org press which are already
 * scoped by the id in the path.
 */
export async function getNewsV2(filter: NewsFilter): Promise<ApiPaginatedNews> {
  const conditions = [isNewsPublishedCondition()];
  if (filter.from) conditions.push(gte(news.publishedAt, new Date(`${filter.from}T00:00:00.000Z`)));
  if (filter.to) conditions.push(lt(news.publishedAt, exclusiveUpperBound(filter.to)));
  if (filter.lang) conditions.push(eq(news.lang, filter.lang));
  if (filter.organizationId) conditions.push(eq(news.organizationId, filter.organizationId));
  if (filter.teamId) conditions.push(sql`EXISTS (SELECT 1 FROM news_relations nr WHERE nr.news_id = ${news.id} AND nr.relatable_type = 'team' AND nr.relatable_id = ${filter.teamId})`);
  if (filter.personId) conditions.push(sql`EXISTS (SELECT 1 FROM news_relations nr WHERE nr.news_id = ${news.id} AND nr.relatable_type = 'person' AND nr.relatable_id = ${filter.personId})`);
  if (filter.tournamentId) conditions.push(sql`EXISTS (SELECT 1 FROM news_relations nr WHERE nr.news_id = ${news.id} AND nr.relatable_type = 'tournament' AND nr.relatable_id = ${filter.tournamentId})`);
  const where = and(...conditions);

  const [countRow] = await db.select({ total: sql<number>`count(*)` }).from(news).where(where);
  const total = Number(countRow?.total ?? 0);
  const totalPages = total > 0 ? Math.ceil(total / filter.perPage) : 0;

  const rows = await db
    .select({
      id: news.id,
      title: news.title,
      slug: news.slug,
      excerpt: news.excerpt,
      imageCover: news.imageCover,
      lang: news.lang,
      isFeatured: news.isFeatured,
      publishedAt: news.publishedAt,
      organizationId: news.organizationId,
    })
    .from(news)
    .where(where)
    .orderBy(desc(news.publishedAt), desc(news.id))
    .limit(filter.perPage)
    .offset((filter.page - 1) * filter.perPage);

  const organizationIds = [...new Set(rows.map((r) => r.organizationId).filter((id): id is number => id != null))];
  const [orgRows, logosByOrgId] = await Promise.all([
    organizationIds.length ? db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, organizationIds)) : Promise.resolve([]),
    getThemedLogoUrlsBatch("organization", organizationIds),
  ]);
  const orgNameById = new Map(orgRows.map((o) => [o.id, o.name]));

  const data: ApiNewsEntry[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt,
    image_cover: r.imageCover,
    lang: r.lang,
    is_featured: r.isFeatured,
    published_at: r.publishedAt ? r.publishedAt.toISOString() : null,
    organization: r.organizationId
      ? { id: r.organizationId, name: orgNameById.get(r.organizationId) ?? "", logos: logosByOrgId.get(r.organizationId) ?? { dark: null, light: null } }
      : null,
  }));

  return { page: filter.page, per_page: filter.perPage, total, total_pages: totalPages, data };
}
