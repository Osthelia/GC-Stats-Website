/**
 * GC-Stats - dashboard-author
 *
 * Dashboard server actions managing a news writer's own author profile
 * (name, bio, logo). Auto-provisions the profile on first visit, same as
 * the lazy creation used for a writer's first article.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { newsAuthors, users, logos } from "@gc-stats/db";
import { storeLogoPair, deleteLogoFiles, validateImageBuffer, MAX_IMAGE_BYTES } from "@gc-stats/storage";
import { openRangeFrom, closeRange } from "@/lib/daterange";
import { requireNewsWriterActor } from "@/lib/dashboard-rbac";
import { diffChanges, logActivity } from "@/lib/activity-log";
import { getOrCreateAuthorProfileId } from "@/lib/dashboard-news-data";
import { getEntityLogos, currentLogo } from "@/lib/admin-logos";
import { validateAuthorProfileInput, type AuthorProfileInput, type AuthorProfileFieldErrors } from "@/lib/author-profile-validation";

async function resolveMyAuthor(): Promise<{ authorId: number; userId: string }> {
  const { userId } = await requireNewsWriterActor();
  const [user] = await db.select({ name: users.name, username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
  return { authorId: await getOrCreateAuthorProfileId(userId, user?.name || user?.username || "Author"), userId };
}

async function resolveMyAuthorId(): Promise<number> {
  return (await resolveMyAuthor()).authorId;
}

export type AuthorProfile = {
  id: number;
  name: string;
  slug: string;
  bio: string;
  logoId: string | null;
  logoUrl: string | null;
};

/** Auto-provisions the profile on first visit (same lazy creation as the first article) so the page always has something to show/edit. */
export async function getMyAuthorProfile(): Promise<AuthorProfile> {
  const authorId = await resolveMyAuthorId();

  const [row] = await db.select().from(newsAuthors).where(eq(newsAuthors.id, authorId)).limit(1);
  if (!row) throw new Error("Author profile disappeared right after creation");

  const logoEntries = await getEntityLogos("news-author", authorId);
  const live = currentLogo(logoEntries);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    bio: row.bio ?? "",
    logoId: live?.id ?? null,
    logoUrl: live?.url ?? null,
  };
}

export type AuthorProfileResult = { ok: true } | { ok: false; fieldErrors: AuthorProfileFieldErrors };

export async function updateMyAuthorProfile(input: AuthorProfileInput): Promise<AuthorProfileResult> {
  const { authorId, userId } = await resolveMyAuthor();

  const { fieldErrors, name, slug, bio } = validateAuthorProfileInput(input);

  if (!fieldErrors.slug) {
    const [collision] = await db.select({ id: newsAuthors.id }).from(newsAuthors).where(eq(newsAuthors.slug, slug)).limit(1);
    if (collision && collision.id !== authorId) fieldErrors.slug = "duplicate";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [current] = await db.select({ name: newsAuthors.name, slug: newsAuthors.slug, bio: newsAuthors.bio }).from(newsAuthors).where(eq(newsAuthors.id, authorId)).limit(1);

  await db.transaction(async (tx) => {
    await tx.update(newsAuthors).set({ name, slug, bio: bio || null }).where(eq(newsAuthors.id, authorId));
    const changes = diffChanges(current ?? {}, { name, slug, bio: bio || null });
    if (Object.keys(changes).length > 0) {
      await logActivity({ subject: "author", subjectId: authorId, logName: "moderation", event: "updated", description: `Updated author profile #${authorId} (${name})`, actorUserId: userId, changes, properties: { section: "profile" } }, tx);
    }
  });

  return { ok: true };
}

export type UploadAuthorLogoResult = { ok: true } | { ok: false; error: "empty" | "tooLarge" | "invalidImage" };

/** Deliberately simple, like dashboard-logo-panel.tsx (organization logo from /dashboard): one current logo, no theme/history — a replacement just closes whatever was open before. */
export async function uploadMyAuthorLogo(formData: FormData): Promise<UploadAuthorLogoResult> {
  const { authorId, userId } = await resolveMyAuthor();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "empty" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "tooLarge" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = await validateImageBuffer(buffer);
  if (!validation.ok) return { ok: false, error: validation.error === "processingFailed" ? "invalidImage" : validation.error };

  const stored = await storeLogoPair("news-author", buffer);
  const today = new Date().toISOString().slice(0, 10);

  try {
    await db.transaction(async (tx) => {
      const openExisting = await tx.select({ id: logos.id, period: logos.period }).from(logos).where(and(eq(logos.entityType, "news-author"), eq(logos.entityId, authorId)));
      for (const row of openExisting) {
        await tx.update(logos).set({ period: closeRange(row.period, today) }).where(eq(logos.id, row.id));
      }
      await tx.insert(logos).values({ id: stored.id, entityType: "news-author", entityId: authorId, period: openRangeFrom(today), theme: null, isVisible: true });
      await logActivity({ subject: "author", subjectId: authorId, logName: "moderation", event: "updated", description: `Replaced logo of author profile #${authorId}`, actorUserId: userId, properties: { section: "logo", logoId: stored.id } }, tx);
    });
  } catch (error) {
    await deleteLogoFiles("news-author", stored.id).catch(() => {});
    throw error;
  }

  return { ok: true };
}

export async function deleteMyAuthorLogo(logoId: string): Promise<{ ok: true } | { ok: false; error: "notFound" }> {
  const { authorId, userId } = await resolveMyAuthor();

  const [row] = await db.select({ id: logos.id }).from(logos).where(and(eq(logos.id, logoId), eq(logos.entityType, "news-author"), eq(logos.entityId, authorId))).limit(1);
  if (!row) return { ok: false, error: "notFound" };

  await db.transaction(async (tx) => {
    await tx.delete(logos).where(eq(logos.id, logoId));
    await logActivity({ subject: "author", subjectId: authorId, logName: "moderation", event: "updated", description: `Removed logo of author profile #${authorId}`, actorUserId: userId, properties: { section: "logo", logoId } }, tx);
  });
  await deleteLogoFiles("news-author", logoId).catch(() => {});

  return { ok: true };
}
