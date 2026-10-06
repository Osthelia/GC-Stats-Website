/**
 * GC-Stats - news-page-data
 *
 * Public news queries: paginated index, single article with author/publisher/
 * relations, organization redirect lookup, and a user's authored articles.
 * Unpublished drafts are only visible to whoever can review them.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { cache } from "react";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { news, newsAuthors, newsRelations, organizations, teams, people, tournaments, users, ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { getEntityLogos, themedLogoUrls, getCurrentLogoUrlsThemed } from "@/lib/admin-logos";
import { slugify } from "@/lib/entity-id";
import { abbreviateTournamentName } from "@/lib/home-data";
import { isNewsPublishedCondition } from "@/lib/news-publish-condition";
import { auth } from "@/auth";
import { getDashboardMemberships, hasOrgPermission } from "@/lib/dashboard-rbac";

export type PublicNewsListItem = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  imageCover: string | null;
  lang: string;
  publishedAt: Date | null;
  isFeatured: boolean;
  publisherName: string;
  publisherLogoUrl: string | null;
  publisherLogoUrlLight: string | null;
};

const PER_PAGE = 12;

export async function getPublicNewsIndex(opts: { languages: string[]; page: number }): Promise<{ items: PublicNewsListItem[]; total: number; perPage: number }> {
  const { languages, page } = opts;
  const where = and(isNewsPublishedCondition(), inArray(news.lang, languages));

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: news.id,
        title: news.title,
        slug: news.slug,
        excerpt: news.excerpt,
        imageCover: news.imageCover,
        lang: news.lang,
        publishedAt: news.publishedAt,
        isFeatured: news.isFeatured,
        organizationId: news.organizationId,
        publisherName: organizations.name,
      })
      .from(news)
      .leftJoin(organizations, eq(organizations.id, news.organizationId))
      .where(where)
      .orderBy(desc(news.publishedAt))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db.select({ count: sql<number>`count(*)::int` }).from(news).where(where),
  ]);
  const total = countRows[0]?.count ?? 0;

  const logosByOrgId = await getCurrentLogoUrlsThemed(
    "organization",
    rows.map((r) => r.organizationId).filter((id): id is number => id !== null)
  );

  return {
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt,
      imageCover: r.imageCover,
      lang: r.lang,
      publishedAt: r.publishedAt,
      isFeatured: r.isFeatured,
      publisherName: r.publisherName ?? "GC-Stats",
      publisherLogoUrl: r.organizationId ? (logosByOrgId.get(r.organizationId)?.dark ?? null) : null,
      publisherLogoUrlLight: r.organizationId ? (logosByOrgId.get(r.organizationId)?.light ?? null) : null,
    })),
    total,
    perPage: PER_PAGE,
  };
}

export type PublicNewsRelation = { id: number; label: string; href: string };

export type PublicNewsArticle = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  imageCover: string | null;
  lang: string;
  status: string;
  publishedAt: Date | null;
  author: { name: string; slug: string; bio: string | null; logoUrl: string | null; logoUrlLight: string | null; username: string | null } | null;
  publisher: { id: number; name: string; slug: string; logoUrl: string | null; logoUrlLight: string | null } | null;
  teams: PublicNewsRelation[];
  people: PublicNewsRelation[];
  tournaments: PublicNewsRelation[];
};

/**
 * Whoever can review a draft in the dashboard (organization.news.view for
 * that org, or the article's own author account for an individually-authored
 * one) can also preview it on the public site before it's published, so they
 * can check formatting/relations the way readers will actually see them.
 */
async function canPreviewUnpublishedNews(row: { organizationId: number | null; authorId: number | null }): Promise<boolean> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return false;

  if (row.organizationId !== null) {
    const memberships = await getDashboardMemberships(userId);
    const membership = memberships.find((m) => m.organizationId === row.organizationId);
    return !!membership && hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.newsView);
  }

  if (row.authorId !== null) {
    const [authorRow] = await db.select({ userId: newsAuthors.userId }).from(newsAuthors).where(eq(newsAuthors.id, row.authorId)).limit(1);
    return authorRow?.userId === userId;
  }

  return false;
}

export const getPublicNewsArticle = cache(async (slug: string): Promise<PublicNewsArticle | null> => {
  const [row] = await db.select().from(news).where(eq(news.slug, slug)).limit(1);
  if (!row) return null;

  const isPublished = row.status === "published" && !!row.publishedAt && row.publishedAt.getTime() <= Date.now();
  if (!isPublished && !(await canPreviewUnpublishedNews({ organizationId: row.organizationId, authorId: row.authorId }))) return null;

  const [authorRow, organizationRow, relations] = await Promise.all([
    row.authorId
      ? db
          .select({ name: newsAuthors.name, slug: newsAuthors.slug, bio: newsAuthors.bio, userId: newsAuthors.userId, id: newsAuthors.id })
          .from(newsAuthors)
          .where(eq(newsAuthors.id, row.authorId))
          .limit(1)
      : Promise.resolve([]),
    row.organizationId ? db.select().from(organizations).where(eq(organizations.id, row.organizationId)).limit(1) : Promise.resolve([]),
    db.select({ relatableType: newsRelations.relatableType, relatableId: newsRelations.relatableId }).from(newsRelations).where(eq(newsRelations.newsId, row.id)),
  ]);

  const authorData = authorRow[0] ?? null;
  const organizationData = organizationRow[0] ?? null;

  let author: PublicNewsArticle["author"] = null;
  if (authorData) {
    const logos = await getEntityLogos("news-author", authorData.id);
    const themed = themedLogoUrls(logos, "news-author");
    let username: string | null = null;
    if (authorData.userId) {
      const [u] = await db.select({ username: users.username }).from(users).where(eq(users.id, authorData.userId)).limit(1);
      username = u?.username ?? null;
    }
    author = {
      name: authorData.name,
      slug: authorData.slug,
      bio: authorData.bio,
      logoUrl: themed.dark,
      logoUrlLight: themed.light,
      username,
    };
  }

  let publisher: PublicNewsArticle["publisher"] = null;
  if (organizationData) {
    const logos = await getEntityLogos("organization", organizationData.id);
    const themed = themedLogoUrls(logos, "organization");
    publisher = { id: organizationData.id, name: organizationData.name, slug: organizationData.slug, logoUrl: themed.dark, logoUrlLight: themed.light };
  }

  const teamIds = relations.filter((r) => r.relatableType === "team").map((r) => r.relatableId);
  const personIds = relations.filter((r) => r.relatableType === "person").map((r) => r.relatableId);
  const tournamentIds = relations.filter((r) => r.relatableType === "tournament").map((r) => r.relatableId);

  const [teamRows, personRows, tournamentRows] = await Promise.all([
    teamIds.length ? db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds)) : Promise.resolve([]),
    personIds.length ? db.select({ id: people.id, handle: people.handle }).from(people).where(inArray(people.id, personIds)) : Promise.resolve([]),
    tournamentIds.length ? db.select({ id: tournaments.id, name: tournaments.name }).from(tournaments).where(inArray(tournaments.id, tournamentIds)) : Promise.resolve([]),
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
    publishedAt: row.publishedAt,
    author,
    publisher,
    teams: teamRows.map((t) => ({ id: t.id, label: t.name, href: `/team/${t.id}/${slugify(t.name)}` })),
    people: personRows.map((p) => ({ id: p.id, label: p.handle, href: `/player/${p.id}/${slugify(p.handle)}` })),
    tournaments: tournamentRows.map((t) => ({ id: t.id, label: abbreviateTournamentName(t.name), href: `/tournaments/${t.id}/${slugify(t.name)}` })),
  };
});

export async function getPublicOrganizationRedirectSegment(slug: string): Promise<string | null> {
  const [row] = await db.select({ id: organizations.id, slug: organizations.slug }).from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return row ? `${row.id}/${row.slug}` : null;
}

export type UserNewsArticle = PublicNewsListItem;

const NEWS_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function getUserNewsArticles(
  username: string,
  opts: { languages: string[]; dateFrom: string; dateTo: string; page: number }
): Promise<{ items: UserNewsArticle[]; total: number; perPage: number }> {
  const [author] = await db
    .select({ id: newsAuthors.id })
    .from(newsAuthors)
    .innerJoin(users, eq(users.id, newsAuthors.userId))
    .where(eq(users.username, username))
    .limit(1);
  if (!author) return { items: [], total: 0, perPage: PER_PAGE };

  const conditions = [eq(news.authorId, author.id), isNewsPublishedCondition(), inArray(news.lang, opts.languages)];
  // `dateTo` is inclusive of the whole day, hence `< dateTo + 1 day` rather than `<= dateTo` (publishedAt carries a time-of-day component).
  if (opts.dateFrom && NEWS_DATE_RE.test(opts.dateFrom)) conditions.push(gte(news.publishedAt, new Date(`${opts.dateFrom}T00:00:00.000Z`)));
  if (opts.dateTo && NEWS_DATE_RE.test(opts.dateTo)) {
    const upperBound = new Date(`${opts.dateTo}T00:00:00.000Z`);
    upperBound.setUTCDate(upperBound.getUTCDate() + 1);
    conditions.push(lt(news.publishedAt, upperBound));
  }
  const where = and(...conditions);
  const { page } = opts;

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: news.id,
        title: news.title,
        slug: news.slug,
        excerpt: news.excerpt,
        imageCover: news.imageCover,
        lang: news.lang,
        publishedAt: news.publishedAt,
        isFeatured: news.isFeatured,
        organizationId: news.organizationId,
        publisherName: organizations.name,
      })
      .from(news)
      .leftJoin(organizations, eq(organizations.id, news.organizationId))
      .where(where)
      .orderBy(desc(news.publishedAt))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db.select({ count: sql<number>`count(*)::int` }).from(news).where(where),
  ]);
  const total = countRows[0]?.count ?? 0;

  const logosByOrgId = await getCurrentLogoUrlsThemed(
    "organization",
    rows.map((r) => r.organizationId).filter((id): id is number => id !== null)
  );

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt,
    imageCover: r.imageCover,
    lang: r.lang,
    publishedAt: r.publishedAt,
    isFeatured: r.isFeatured,
    publisherName: r.publisherName ?? "GC-Stats",
    publisherLogoUrl: r.organizationId ? (logosByOrgId.get(r.organizationId)?.dark ?? null) : null,
    publisherLogoUrlLight: r.organizationId ? (logosByOrgId.get(r.organizationId)?.light ?? null) : null,
  }));

  return { items, total, perPage: PER_PAGE };
}
