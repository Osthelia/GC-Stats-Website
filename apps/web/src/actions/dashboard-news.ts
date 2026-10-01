/**
 * GC-Stats - dashboard-news
 *
 * Dashboard server actions for writing news articles, either individually
 * or on behalf of an organization outlet. Resolves and gates the acting
 * scope (individual author vs org role permissions) before every action.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq, ne, and } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { news, newsMessages, newsRelations, newsImages, newsAuthors, users, ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { storeNewsImage, deleteNewsImage, newsImageUrl, validateImageBuffer } from "@gc-stats/storage";
import { requireDashboardOrgActor, requireAuthorActor, hasOrgPermission, type DashboardOrgMembership } from "@/lib/dashboard-rbac";
import { getOrCreateAuthorProfileId, isNewsLanguageActive, scopeCondition, type DashboardNewsScope } from "@/lib/dashboard-news-data";
import { sanitizeNewsContent } from "@/lib/news-content-sanitize";
import { searchTeamsQuery, type TeamPickerResult } from "@/lib/team-search";
import { searchPeopleQuery, type PersonPickerResult } from "@/lib/person-search";
import { searchTournamentsQuery, type TournamentPickerResult } from "@/lib/tournament-search";
import { searchNewsAuthorsQuery, type NewsAuthorPickerResult } from "@/lib/news-author-search";
import { slugify } from "@/lib/entity-id";

/**
 * Resolves + gates the acting scope for one article action.
 * `organizationId: null` is the individual/author space — its own gate
 * (isAuthor) has no org-permission granularity, any of create/publish/delete
 * is allowed on the writer's own articles. Also resolves (auto-provisioning
 * if needed) the acting user's own byline `news_authors` profile: an
 * org-scoped article still bylines the person who wrote it, the
 * organization is the outlet on top of that (V1 parity).
 *
 * `orgPermission` accepts an array for actions any one of several roles may
 * take (e.g. the private conversation: both a writer and a reviewer can
 * post in it) — org scope passes if the actor holds at least one.
 */
async function resolveScope(organizationId: number | null, orgPermission: string | string[]): Promise<{ userId: string; authorId: number; scope: DashboardNewsScope; membership: DashboardOrgMembership | null }> {
  let userId: string;
  let membership: DashboardOrgMembership | null = null;
  if (organizationId !== null) {
    const result = await requireDashboardOrgActor(organizationId);
    const perms = Array.isArray(orgPermission) ? orgPermission : [orgPermission];
    if (!perms.some((p) => hasOrgPermission(result.membership, p))) throw new Error("Not authorized");
    userId = result.userId;
    membership = result.membership;
  } else {
    userId = (await requireAuthorActor()).userId;
  }

  const [user] = await db.select({ name: users.name, username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
  const authorId = await getOrCreateAuthorProfileId(userId, user?.name || user?.username || "Author");

  const scope: DashboardNewsScope = organizationId !== null ? { organizationId } : { authorId };
  return { userId, authorId, scope, membership };
}

/** Only meaningful for an org-scoped article — an org can byline any known author, not just whoever is writing it. Individual /dashboard/author articles always keep the writer's own byline (requestedAuthorId ignored). */
async function resolveArticleAuthorId(organizationId: number | null, requestedAuthorId: number | null, fallbackAuthorId: number): Promise<{ authorId: number; invalid: boolean }> {
  if (organizationId === null || requestedAuthorId === null) return { authorId: fallbackAuthorId, invalid: false };
  const [row] = await db.select({ id: newsAuthors.id }).from(newsAuthors).where(eq(newsAuthors.id, requestedAuthorId)).limit(1);
  if (!row) return { authorId: fallbackAuthorId, invalid: true };
  return { authorId: row.id, invalid: false };
}

async function insertNewsMessage(newsId: number, userId: string, type: string, body: string): Promise<void> {
  await db.insert(newsMessages).values({ newsId, userId, type, body });
}

export type NewsArticleField = "title" | "slug" | "lang" | "excerpt" | "content" | "authorId";
export type NewsArticleFieldErrors = Partial<Record<NewsArticleField, string>>;
export type NewsArticleResult = { ok: true; id: number } | { ok: false; fieldErrors: NewsArticleFieldErrors; error?: "locked" };

/** Mid review, content is always locked regardless of permissions — nobody edits a submitted article out from under its reviewer. */
function isUnderReview(status: string): boolean {
  return status === "in_review" || status === "approved";
}

export type NewsArticleInput = {
  title: string;
  slug: string;
  lang: string;
  excerpt: string;
  content: string;
  /** Org scope only — the byline to credit. null keeps/uses the writer's own profile, see resolveArticleAuthorId. */
  authorId: number | null;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function validateArticle(input: NewsArticleInput, excludeId?: number): Promise<{ fieldErrors: NewsArticleFieldErrors; slug: string; content: string }> {
  const fieldErrors: NewsArticleFieldErrors = {};

  const title = input.title.trim();
  if (!title) fieldErrors.title = "required";
  else if (title.length > 255) fieldErrors.title = "tooLong";

  let slug = input.slug.trim() || (title ? slugify(title, "article") : "");
  if (slug.length > 255) fieldErrors.slug = "tooLong";
  else if (slug && !SLUG_RE.test(slug)) fieldErrors.slug = "invalid";

  if (!fieldErrors.slug && slug) {
    const conditions = [eq(news.slug, slug)];
    if (excludeId !== undefined) conditions.push(ne(news.id, excludeId));
    const [existing] = await db
      .select({ id: news.id })
      .from(news)
      .where(and(...conditions))
      .limit(1);
    if (existing) fieldErrors.slug = "duplicate";
  }

  const lang = input.lang.trim();
  if (!lang) fieldErrors.lang = "required";
  else if (!(await isNewsLanguageActive(lang))) fieldErrors.lang = "invalid";

  const excerpt = input.excerpt.trim();
  if (excerpt.length > 500) fieldErrors.excerpt = "tooLong";

  const content = sanitizeNewsContent(input.content);
  const isContentEmpty = content.replace(/<[^>]*>/g, "").trim().length === 0;
  if (isContentEmpty) fieldErrors.content = "required";

  return { fieldErrors, slug, content };
}

export async function createDashboardNewsArticle(organizationId: number | null, input: NewsArticleInput): Promise<NewsArticleResult> {
  const { authorId: selfAuthorId } = await resolveScope(organizationId, ORGANIZATION_PERMISSIONS.newsEdit);

  const { fieldErrors, slug, content } = await validateArticle(input);
  const { authorId, invalid: authorInvalid } = await resolveArticleAuthorId(organizationId, input.authorId, selfAuthorId);
  if (authorInvalid) fieldErrors.authorId = "invalid";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [created] = await db
    .insert(news)
    .values({
      title: input.title.trim(),
      slug,
      lang: input.lang.trim(),
      excerpt: input.excerpt.trim() || null,
      content,
      organizationId,
      authorId,
      status: "draft",
    })
    .returning({ id: news.id });
  if (!created) throw new Error("Insert returned no row");

  return { ok: true, id: created.id };
}

export async function updateDashboardNewsArticle(organizationId: number | null, newsId: number, input: NewsArticleInput): Promise<NewsArticleResult> {
  const { authorId: selfAuthorId, scope, membership } = await resolveScope(organizationId, [ORGANIZATION_PERMISSIONS.newsEdit, ORGANIZATION_PERMISSIONS.newsEditPublished]);

  const [existing] = await db.select({ id: news.id, status: news.status }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, fieldErrors: { title: "notFound" } };
  if (isUnderReview(existing.status)) return { ok: false, fieldErrors: {}, error: "locked" };
  if (existing.status === "published") {
    const canEditPublished = organizationId !== null && hasOrgPermission(membership as DashboardOrgMembership, ORGANIZATION_PERMISSIONS.newsEditPublished);
    if (!canEditPublished) return { ok: false, fieldErrors: {}, error: "locked" };
  } else if (organizationId !== null && !hasOrgPermission(membership as DashboardOrgMembership, ORGANIZATION_PERMISSIONS.newsEdit)) {
    // Draft/changes_requested: a pure newsEditPublished holder (no newsEdit) can't touch unpublished drafts.
    return { ok: false, fieldErrors: {}, error: "locked" };
  }

  const { fieldErrors, slug, content } = await validateArticle(input, newsId);
  const { authorId, invalid: authorInvalid } = await resolveArticleAuthorId(organizationId, input.authorId, selfAuthorId);
  if (authorInvalid) fieldErrors.authorId = "invalid";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db
    .update(news)
    .set({
      title: input.title.trim(),
      slug,
      lang: input.lang.trim(),
      excerpt: input.excerpt.trim() || null,
      content,
      authorId,
      updatedAt: new Date(),
    })
    .where(eq(news.id, newsId));

  return { ok: true, id: newsId };
}

export type SimpleNewsResult = { ok: true } | { ok: false; error: "notFound" | "invalidState" | "invalidDate" };

/**
 * A future `scheduledAt` is how "post at a later date/time" is represented —
 * status flips to 'published' right away (the approval is done, nothing
 * left to review), but publishedAt is set in the future instead of now.
 * Every public read site additionally requires publishedAt <= now() (see
 * news-page-data.ts and friends), so the article stays invisible until due
 * without any background job. Org scope requires the article to already be
 * 'approved' (the PR-style gate); the individual /dashboard/author space has
 * no review step, so any status may be published directly, same as before.
 */
export async function publishDashboardNewsArticle(organizationId: number | null, newsId: number, scheduledAt?: string | null): Promise<SimpleNewsResult> {
  const { userId, scope } = await resolveScope(organizationId, ORGANIZATION_PERMISSIONS.newsPublish);

  const [existing] = await db.select({ id: news.id, status: news.status, publishedAt: news.publishedAt }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };
  if (organizationId !== null && existing.status !== "approved") return { ok: false, error: "invalidState" };

  let publishAt = existing.publishedAt ?? new Date();
  if (scheduledAt) {
    const parsed = new Date(scheduledAt);
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: "invalidDate" };
    publishAt = parsed;
  }

  await db.update(news).set({ status: "published", publishedAt: publishAt, updatedAt: new Date() }).where(eq(news.id, newsId));
  await insertNewsMessage(newsId, userId, publishAt.getTime() > Date.now() ? "scheduled" : "published", publishAt.toISOString());

  return { ok: true };
}

/** Undoes a publish (immediate or scheduled) — back to draft with publishedAt cleared, so a wrong schedule/live mistake can be corrected without going through archive. Reopens content editing (see isContentLocked). */
export async function unpublishDashboardNewsArticle(organizationId: number | null, newsId: number): Promise<SimpleNewsResult> {
  const { userId, scope } = await resolveScope(organizationId, ORGANIZATION_PERMISSIONS.newsPublish);

  const [existing] = await db.select({ id: news.id, status: news.status }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };
  if (existing.status !== "published") return { ok: false, error: "invalidState" };

  await db.update(news).set({ status: "draft", publishedAt: null, updatedAt: new Date() }).where(eq(news.id, newsId));
  await insertNewsMessage(newsId, userId, "unpublished", "");

  return { ok: true };
}

/** Writer submits a draft (or a draft sent back with changes requested) for review — org scope only, see schema/content.ts's status doc comment. */
export async function submitDashboardNewsForReview(organizationId: number, newsId: number): Promise<SimpleNewsResult> {
  const { userId, scope } = await resolveScope(organizationId, ORGANIZATION_PERMISSIONS.newsEdit);

  const [existing] = await db.select({ id: news.id, status: news.status }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };
  if (existing.status !== "draft" && existing.status !== "changes_requested") return { ok: false, error: "invalidState" };

  await db.update(news).set({ status: "in_review", submittedBy: userId, submittedAt: new Date(), updatedAt: new Date() }).where(eq(news.id, newsId));
  await insertNewsMessage(newsId, userId, "submitted", "");

  return { ok: true };
}

/** Reviewer approves — the article can now be published (immediately or scheduled) by a newsPublish holder, a separate grant from review. */
export async function approveDashboardNewsArticle(organizationId: number, newsId: number): Promise<SimpleNewsResult> {
  const { userId, scope } = await resolveScope(organizationId, ORGANIZATION_PERMISSIONS.newsReview);

  const [existing] = await db.select({ id: news.id, status: news.status }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };
  if (existing.status !== "in_review") return { ok: false, error: "invalidState" };

  await db.update(news).set({ status: "approved", reviewedBy: userId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(news.id, newsId));
  await insertNewsMessage(newsId, userId, "approved", "");

  return { ok: true };
}

export type RequestNewsChangesResult = { ok: true } | { ok: false; error: "notFound" | "invalidState" | "empty" };

/** Reviewer sends the article back to the writer — mirrors a PR "request changes" review, a note is required (mirrors GitHub, which won't let you request changes with no comment). */
export async function requestDashboardNewsChanges(organizationId: number, newsId: number, note: string): Promise<RequestNewsChangesResult> {
  const { userId, scope } = await resolveScope(organizationId, ORGANIZATION_PERMISSIONS.newsReview);

  const [existing] = await db.select({ id: news.id, status: news.status }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };
  if (existing.status !== "in_review") return { ok: false, error: "invalidState" };

  const trimmed = note.trim();
  if (!trimmed) return { ok: false, error: "empty" };

  await db.update(news).set({ status: "changes_requested", reviewedBy: userId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(news.id, newsId));
  await insertNewsMessage(newsId, userId, "changes_requested", trimmed);

  return { ok: true };
}

export type PostNewsMessageResult = { ok: true } | { ok: false; error: "notFound" | "empty" | "tooLong" };

/** The private conversation — visible/postable by whoever can reach this article's editor (a writer via newsEdit, a reviewer via newsReview, or a publisher via newsPublish/newsEditPublished alone, see resolveScope's array form). */
export async function postDashboardNewsMessage(organizationId: number | null, newsId: number, body: string): Promise<PostNewsMessageResult> {
  const { userId, scope } = await resolveScope(organizationId, [
    ORGANIZATION_PERMISSIONS.newsEdit,
    ORGANIZATION_PERMISSIONS.newsEditPublished,
    ORGANIZATION_PERMISSIONS.newsReview,
    ORGANIZATION_PERMISSIONS.newsPublish,
  ]);

  const [existing] = await db.select({ id: news.id }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "empty" };
  if (trimmed.length > 4000) return { ok: false, error: "tooLong" };

  await insertNewsMessage(newsId, userId, "comment", trimmed);
  return { ok: true };
}

/** Soft-delete alternative to destroy — same permission as delete, mirrors V1. */
export async function archiveDashboardNewsArticle(organizationId: number | null, newsId: number): Promise<SimpleNewsResult> {
  const { scope } = await resolveScope(organizationId, ORGANIZATION_PERMISSIONS.newsDelete);

  const [existing] = await db.select({ id: news.id }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.update(news).set({ status: "archived", updatedAt: new Date() }).where(eq(news.id, newsId));
  return { ok: true };
}

/** Reverses archiveDashboardNewsArticle — back to draft, so an article archived by mistake can be reworked and republished instead of being a one way trip. */
export async function unarchiveDashboardNewsArticle(organizationId: number | null, newsId: number): Promise<SimpleNewsResult> {
  const { scope } = await resolveScope(organizationId, ORGANIZATION_PERMISSIONS.newsDelete);

  const [existing] = await db.select({ id: news.id, status: news.status }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };
  if (existing.status !== "archived") return { ok: false, error: "invalidState" };

  await db.update(news).set({ status: "draft", updatedAt: new Date() }).where(eq(news.id, newsId));
  return { ok: true };
}

export async function deleteDashboardNewsArticle(organizationId: number | null, newsId: number): Promise<SimpleNewsResult> {
  const { scope } = await resolveScope(organizationId, ORGANIZATION_PERMISSIONS.newsDelete);

  const [existing] = await db.select({ id: news.id }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  const images = await db.select({ id: newsImages.id }).from(newsImages).where(eq(newsImages.newsId, newsId));
  await db.delete(news).where(eq(news.id, newsId));
  await Promise.all(images.map((img) => deleteNewsImage(img.id).catch(() => {})));

  return { ok: true };
}

/**
 * "Feature"/"show on home" have no site-editor role anymore now that /admin
 * has no news section (SUIVI.MD, 2026-09-13 session) — tied to the same
 * trust level as publishing rather than inventing a separate global gate.
 */
export async function toggleDashboardNewsFeature(organizationId: number | null, newsId: number, value: boolean): Promise<SimpleNewsResult> {
  const { scope } = await resolveScope(organizationId, ORGANIZATION_PERMISSIONS.newsPublish);
  const [existing] = await db.select({ id: news.id }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.update(news).set({ isFeatured: value, updatedAt: new Date() }).where(eq(news.id, newsId));
  return { ok: true };
}

export async function toggleDashboardNewsShowOnHome(organizationId: number | null, newsId: number, value: boolean): Promise<SimpleNewsResult> {
  const { scope } = await resolveScope(organizationId, ORGANIZATION_PERMISSIONS.newsPublish);
  const [existing] = await db.select({ id: news.id }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.update(news).set({ showOnHome: value, updatedAt: new Date() }).where(eq(news.id, newsId));
  return { ok: true };
}

export type SyncNewsRelationsInput = { teamIds: number[]; personIds: number[]; tournamentIds: number[] };

export async function syncDashboardNewsRelations(organizationId: number | null, newsId: number, input: SyncNewsRelationsInput): Promise<SimpleNewsResult> {
  const { scope } = await resolveScope(organizationId, [ORGANIZATION_PERMISSIONS.newsEdit, ORGANIZATION_PERMISSIONS.newsEditPublished]);
  const [existing] = await db.select({ id: news.id }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.delete(newsRelations).where(eq(newsRelations.newsId, newsId));

  const rows = [
    ...input.teamIds.map((id) => ({ newsId, relatableType: "team" as const, relatableId: id })),
    ...input.personIds.map((id) => ({ newsId, relatableType: "person" as const, relatableId: id })),
    ...input.tournamentIds.map((id) => ({ newsId, relatableType: "tournament" as const, relatableId: id })),
  ];
  if (rows.length > 0) await db.insert(newsRelations).values(rows);

  return { ok: true };
}

export type UploadNewsImageResult = { ok: true; id: string; url: string } | { ok: false; error: "empty" | "tooLarge" | "invalidImage" | "notFound" };

const MAX_NEWS_IMAGE_BYTES = 10 * 1024 * 1024;

export async function uploadDashboardNewsImage(organizationId: number | null, newsId: number, formData: FormData): Promise<UploadNewsImageResult> {
  const { scope } = await resolveScope(organizationId, [ORGANIZATION_PERMISSIONS.newsEdit, ORGANIZATION_PERMISSIONS.newsEditPublished]);
  const [existing] = await db.select({ id: news.id, authorId: news.authorId }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "empty" };
  if (file.size > MAX_NEWS_IMAGE_BYTES) return { ok: false, error: "tooLarge" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = await validateImageBuffer(buffer);
  if (!validation.ok) return { ok: false, error: validation.error === "empty" ? "empty" : validation.error === "tooLarge" ? "tooLarge" : "invalidImage" };

  const stored = await storeNewsImage(buffer);
  await db.insert(newsImages).values({ id: stored.id, newsId, authorId: existing.authorId });

  return { ok: true, id: stored.id, url: stored.url };
}

export async function setDashboardNewsCover(organizationId: number | null, newsId: number, newsImageId: string): Promise<SimpleNewsResult> {
  const { scope } = await resolveScope(organizationId, [ORGANIZATION_PERMISSIONS.newsEdit, ORGANIZATION_PERMISSIONS.newsEditPublished]);
  const [existing] = await db.select({ id: news.id }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  // Only one of THIS article's own uploaded images can become its cover —
  // mirrors V1's NewsMediaController::setCover, prevents pointing the cover
  // at an arbitrary image row via a tampered id.
  const [image] = await db.select({ id: newsImages.id }).from(newsImages).where(and(eq(newsImages.id, newsImageId), eq(newsImages.newsId, newsId))).limit(1);
  if (!image) return { ok: false, error: "notFound" };

  await db.update(news).set({ imageCover: newsImageUrl(newsImageId), updatedAt: new Date() }).where(eq(news.id, newsId));

  return { ok: true };
}

export async function deleteDashboardNewsImage(organizationId: number | null, newsId: number, newsImageId: string): Promise<SimpleNewsResult> {
  const { scope } = await resolveScope(organizationId, [ORGANIZATION_PERMISSIONS.newsEdit, ORGANIZATION_PERMISSIONS.newsEditPublished]);
  const [existing] = await db.select({ id: news.id }).from(news).where(and(eq(news.id, newsId), scopeCondition(scope))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  const [image] = await db.select({ id: newsImages.id }).from(newsImages).where(and(eq(newsImages.id, newsImageId), eq(newsImages.newsId, newsId))).limit(1);
  if (!image) return { ok: false, error: "notFound" };

  await db.delete(newsImages).where(eq(newsImages.id, newsImageId));
  await deleteNewsImage(newsImageId).catch(() => {});

  return { ok: true };
}

async function requireNewsEditAccess(organizationId: number | null): Promise<void> {
  if (organizationId !== null) {
    const { membership } = await requireDashboardOrgActor(organizationId);
    if (!hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.newsEdit) && !hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.newsEditPublished)) throw new Error("Not authorized");
    return;
  }
  await requireAuthorActor();
}

export async function searchDashboardTeams(organizationId: number | null, query: string): Promise<TeamPickerResult[]> {
  await requireNewsEditAccess(organizationId);
  return searchTeamsQuery(query);
}

export async function searchDashboardPeople(organizationId: number | null, query: string): Promise<PersonPickerResult[]> {
  await requireNewsEditAccess(organizationId);
  return searchPeopleQuery(query);
}

export async function searchDashboardTournaments(organizationId: number | null, query: string): Promise<TournamentPickerResult[]> {
  await requireNewsEditAccess(organizationId);
  return searchTournamentsQuery(query);
}

export async function searchDashboardNewsAuthors(organizationId: number | null, query: string): Promise<NewsAuthorPickerResult[]> {
  await requireNewsEditAccess(organizationId);
  return searchNewsAuthorsQuery(query);
}
