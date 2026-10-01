/**
 * GC-Stats - dashboard-news-data
 *
 * Query helpers for the dashboard news list, scoped to either an
 * organization or an individual author.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, isNull, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { news, newsAuthors, newsMessages, newsRelations, newsImages, newsLanguages, teams, people, tournaments, users } from "@gc-stats/db";
import { newsImageUrl } from "@gc-stats/storage";
import { slugify } from "@/lib/entity-id";

function isScheduled(status: string, publishedAt: Date | null): boolean {
  return status === "published" && !!publishedAt && publishedAt.getTime() > Date.now();
}

/** A news article always belongs to exactly one of these two scopes — never both, never neither (organizationId is NULL for an individually-authored article). */
export type DashboardNewsScope = { organizationId: number } | { authorId: number };

export function scopeCondition(scope: DashboardNewsScope) {
  return "organizationId" in scope ? eq(news.organizationId, scope.organizationId) : and(isNull(news.organizationId), eq(news.authorId, scope.authorId));
}

export type DashboardNewsListRow = {
  id: number;
  title: string;
  slug: string;
  status: string;
  /** status === 'published' with a publishedAt still in the future — see news.publishedAt's doc comment in schema/content.ts. */
  isScheduled: boolean;
  lang: string;
  isFeatured: boolean;
  showOnHome: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
};

export async function listDashboardNewsArticles(scope: DashboardNewsScope): Promise<DashboardNewsListRow[]> {
  const rows = await db
    .select({
      id: news.id,
      title: news.title,
      slug: news.slug,
      status: news.status,
      lang: news.lang,
      isFeatured: news.isFeatured,
      showOnHome: news.showOnHome,
      publishedAt: news.publishedAt,
      updatedAt: news.updatedAt,
    })
    .from(news)
    .where(scopeCondition(scope))
    .orderBy(desc(news.updatedAt));

  return rows.map((r) => ({ ...r, isScheduled: isScheduled(r.status, r.publishedAt) }));
}

export type DashboardNewsRelationEntry = { id: number; label: string };

export type DashboardNewsArticleDetail = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  imageCover: string | null;
  lang: string;
  status: string;
  isScheduled: boolean;
  isFeatured: boolean;
  showOnHome: boolean;
  organizationId: number | null;
  authorId: number;
  authorName: string;
  publishedAt: Date | null;
  submittedAt: Date | null;
  submittedByName: string | null;
  reviewedAt: Date | null;
  reviewedByName: string | null;
  teams: DashboardNewsRelationEntry[];
  people: DashboardNewsRelationEntry[];
  tournaments: DashboardNewsRelationEntry[];
  images: { id: string; url: string }[];
};

async function labelForUserId(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const [row] = await db.select({ name: users.name, username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.name || row?.username || null;
}

export async function getDashboardNewsArticle(scope: DashboardNewsScope, newsId: number): Promise<DashboardNewsArticleDetail | null> {
  const [row] = await db.select().from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!row) return null;

  const relations = await db.select({ relatableType: newsRelations.relatableType, relatableId: newsRelations.relatableId }).from(newsRelations).where(eq(newsRelations.newsId, newsId));

  const teamIds = relations.filter((r) => r.relatableType === "team").map((r) => r.relatableId);
  const personIds = relations.filter((r) => r.relatableType === "person").map((r) => r.relatableId);
  const tournamentIds = relations.filter((r) => r.relatableType === "tournament").map((r) => r.relatableId);

  const [resolvedTeams, resolvedPeople, resolvedTournaments, imageRows, authorRow, submittedByName, reviewedByName] = await Promise.all([
    teamIds.length ? db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds)) : Promise.resolve([]),
    personIds.length ? db.select({ id: people.id, name: people.handle }).from(people).where(inArray(people.id, personIds)) : Promise.resolve([]),
    tournamentIds.length ? db.select({ id: tournaments.id, name: tournaments.name }).from(tournaments).where(inArray(tournaments.id, tournamentIds)) : Promise.resolve([]),
    db.select({ id: newsImages.id }).from(newsImages).where(eq(newsImages.newsId, newsId)),
    db.select({ name: newsAuthors.name }).from(newsAuthors).where(eq(newsAuthors.id, row.authorId as number)).limit(1),
    labelForUserId(row.submittedBy),
    labelForUserId(row.reviewedBy),
  ]);

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    imageCover: row.imageCover,
    lang: row.lang,
    status: row.status,
    isScheduled: isScheduled(row.status, row.publishedAt),
    isFeatured: row.isFeatured,
    showOnHome: row.showOnHome,
    organizationId: row.organizationId,
    authorId: row.authorId as number,
    authorName: authorRow[0]?.name ?? "",
    publishedAt: row.publishedAt,
    submittedAt: row.submittedAt,
    submittedByName,
    reviewedAt: row.reviewedAt,
    reviewedByName,
    teams: resolvedTeams.map((t) => ({ id: t.id, label: t.name })),
    people: resolvedPeople.map((p) => ({ id: p.id, label: p.name })),
    tournaments: resolvedTournaments.map((t) => ({ id: t.id, label: t.name })),
    images: imageRows.map((img) => ({ id: img.id, url: newsImageUrl(img.id) })),
  };
}

export type DashboardNewsMessage = {
  id: number;
  type: string;
  body: string;
  createdAt: Date;
  authorName: string | null;
};

export async function listDashboardNewsMessages(newsId: number): Promise<DashboardNewsMessage[]> {
  const rows = await db
    .select({ id: newsMessages.id, type: newsMessages.type, body: newsMessages.body, createdAt: newsMessages.createdAt, name: users.name, username: users.username })
    .from(newsMessages)
    .leftJoin(users, eq(users.id, newsMessages.userId))
    .where(eq(newsMessages.newsId, newsId))
    .orderBy(asc(newsMessages.createdAt));

  return rows.map((r) => ({ id: r.id, type: r.type, body: r.body, createdAt: r.createdAt, authorName: r.name || r.username || null }));
}

/** Read-only lookup (no auto-provisioning) — used for the personal article list, where a brand-new author with no articles yet should just see an empty list rather than getting a profile row created by merely visiting it. */
export async function findMyAuthorId(userId: string): Promise<number | null> {
  const [existing] = await db.select({ id: newsAuthors.id }).from(newsAuthors).where(eq(newsAuthors.userId, userId)).limit(1);
  return existing?.id ?? null;
}

export async function getOrCreateAuthorProfileId(userId: string, fallbackName: string): Promise<number> {
  const [existing] = await db.select({ id: newsAuthors.id }).from(newsAuthors).where(eq(newsAuthors.userId, userId)).limit(1);
  if (existing) return existing.id;

  const base = slugify(fallbackName, "author");

  let slug = base;
  let attempt = 1;
  // Slugs are unique — retry with a numeric suffix on collision (rare: only
  // when two accounts share the same display name).
  for (;;) {
    const [collision] = await db.select({ id: newsAuthors.id }).from(newsAuthors).where(eq(newsAuthors.slug, slug)).limit(1);
    if (!collision) break;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  const [created] = await db.insert(newsAuthors).values({ userId, name: fallbackName, slug }).returning({ id: newsAuthors.id });
  if (!created) throw new Error("Insert returned no row");
  return created.id;
}

export async function isNewsLanguageActive(code: string): Promise<boolean> {
  const [row] = await db.select({ code: newsLanguages.code }).from(newsLanguages).where(and(eq(newsLanguages.code, code), eq(newsLanguages.isActive, true))).limit(1);
  return !!row;
}
