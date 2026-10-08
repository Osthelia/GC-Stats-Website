/**
 * GC-Stats - dashboard-authors-data
 *
 * Query helpers for the admin view over every news author profile.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { news, newsAuthors, users } from "@gc-stats/db";
import { getCurrentLogoUrlsThemed } from "@/lib/admin-logos";

export type DashboardAuthorRow = {
  id: number;
  name: string;
  slug: string;
  username: string | null;
  isAuthor: boolean;
  logoUrl: string | null;
  darkLogoUrl: string | null;
  individualCount: number;
  organizationCount: number;
};

export async function listDashboardAuthors(): Promise<DashboardAuthorRow[]> {
  const [rows, counts] = await Promise.all([
    db
      .select({ id: newsAuthors.id, name: newsAuthors.name, slug: newsAuthors.slug, username: users.username, isAuthor: users.isAuthor })
      .from(newsAuthors)
      .leftJoin(users, eq(users.id, newsAuthors.userId))
      .orderBy(newsAuthors.name),
    db
      .select({
        authorId: news.authorId,
        individual: sql<number>`count(*) filter (where ${isNull(news.organizationId)})`.mapWith(Number),
        organization: sql<number>`count(*) filter (where ${isNotNull(news.organizationId)})`.mapWith(Number),
      })
      .from(news)
      .groupBy(news.authorId),
  ]);

  const countByAuthor = new Map(counts.map((c) => [c.authorId, c]));
  const logoUrls = await getCurrentLogoUrlsThemed(
    "news-author",
    rows.map((r) => r.id)
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    username: r.username,
    isAuthor: r.isAuthor ?? false,
    logoUrl: logoUrls.get(r.id)?.light ?? null,
    darkLogoUrl: logoUrls.get(r.id)?.dark ?? null,
    individualCount: countByAuthor.get(r.id)?.individual ?? 0,
    organizationCount: countByAuthor.get(r.id)?.organization ?? 0,
  }));
}

export type DashboardAuthorDetail = {
  id: number;
  name: string;
  slug: string;
  bio: string | null;
  username: string | null;
  userDisplayName: string | null;
  isAuthor: boolean;
  logoUrl: string | null;
  darkLogoUrl: string | null;
  organizationCount: number;
};

export async function getDashboardAuthor(authorId: number): Promise<DashboardAuthorDetail | null> {
  const [row] = await db
    .select({
      id: newsAuthors.id,
      name: newsAuthors.name,
      slug: newsAuthors.slug,
      bio: newsAuthors.bio,
      username: users.username,
      userDisplayName: users.name,
      isAuthor: users.isAuthor,
    })
    .from(newsAuthors)
    .leftJoin(users, eq(users.id, newsAuthors.userId))
    .where(eq(newsAuthors.id, authorId))
    .limit(1);
  if (!row) return null;

  const [[orgCount], logoUrls] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(news)
      .where(and(eq(news.authorId, authorId), isNotNull(news.organizationId))),
    getCurrentLogoUrlsThemed("news-author", [authorId]),
  ]);

  return {
    ...row,
    isAuthor: row.isAuthor ?? false,
    logoUrl: logoUrls.get(authorId)?.light ?? null,
    darkLogoUrl: logoUrls.get(authorId)?.dark ?? null,
    organizationCount: orgCount?.count ?? 0,
  };
}
