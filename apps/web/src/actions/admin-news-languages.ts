/**
 * GC-Stats - admin-news-languages
 *
 * Admin server actions managing the set of languages news articles can be
 * written in (code, display name, sort order, active flag).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { adminDb as db } from "@gc-stats/db/client";
import { newsLanguages, news, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { NEWS_LANGUAGES_TAG } from "@/lib/cache-tags";

async function requireNewsLanguagesActor(): Promise<void> {
  // Re-checked here, not just relied on from the /admin layout guard — a
  // server action is reachable as its own POST endpoint regardless of which
  // page rendered the form that calls it.
  await requireActorPermission(PERMISSIONS.newsLanguagesManage);
}

export type NewsLanguageField = "code" | "name" | "sortOrder";
export type NewsLanguageFieldErrors = Partial<Record<NewsLanguageField, string>>;
export type NewsLanguageResult = { ok: true; code: string } | { ok: false; fieldErrors: NewsLanguageFieldErrors };

export type NewsLanguageInput = {
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

const CODE_RE = /^[a-z]{2,3}(_[A-Za-z]{2,8})?$/;

async function validateNewsLanguage(input: NewsLanguageInput, excludeCode?: string): Promise<NewsLanguageFieldErrors> {
  const fieldErrors: NewsLanguageFieldErrors = {};

  const code = input.code.trim();
  if (!code) fieldErrors.code = "required";
  else if (code.length > 10) fieldErrors.code = "tooLong";
  else if (!CODE_RE.test(code)) fieldErrors.code = "invalid";

  const name = input.name.trim();
  if (!name) fieldErrors.name = "required";
  else if (name.length > 100) fieldErrors.name = "tooLong";

  if (!Number.isInteger(input.sortOrder)) fieldErrors.sortOrder = "invalid";

  if (code && !fieldErrors.code && code !== excludeCode) {
    const [existing] = await db.select({ code: newsLanguages.code }).from(newsLanguages).where(eq(newsLanguages.code, code)).limit(1);
    if (existing) fieldErrors.code = "duplicate";
  }

  return fieldErrors;
}

export async function createNewsLanguage(input: NewsLanguageInput): Promise<NewsLanguageResult> {
  await requireNewsLanguagesActor();

  const fieldErrors = await validateNewsLanguage(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db.insert(newsLanguages).values({ code: input.code.trim(), name: input.name.trim(), sortOrder: input.sortOrder, isActive: input.isActive });
  updateTag(NEWS_LANGUAGES_TAG);

  return { ok: true, code: input.code.trim() };
}

export async function updateNewsLanguage(code: string, input: NewsLanguageInput): Promise<NewsLanguageResult> {
  await requireNewsLanguagesActor();

  const [existingRow] = await db.select({ code: newsLanguages.code }).from(newsLanguages).where(eq(newsLanguages.code, code)).limit(1);
  if (!existingRow) return { ok: false, fieldErrors: { code: "notFound" } };

  const fieldErrors = await validateNewsLanguage(input, code);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  // Renaming the code itself would orphan every news.lang FK pointing at the
  // old value — simplest safe rule: the code is fixed once created, only
  // name/order/active can change. Mirrors "id is forever" elsewhere.
  await db
    .update(newsLanguages)
    .set({ name: input.name.trim(), sortOrder: input.sortOrder, isActive: input.isActive })
    .where(eq(newsLanguages.code, code));
  updateTag(NEWS_LANGUAGES_TAG);

  return { ok: true, code };
}

export type DeleteNewsLanguageResult = { ok: true } | { ok: false; error: "notFound" | "inUse" };

export async function deleteNewsLanguage(code: string): Promise<DeleteNewsLanguageResult> {
  await requireNewsLanguagesActor();

  const [existing] = await db.select({ code: newsLanguages.code }).from(newsLanguages).where(eq(newsLanguages.code, code)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  const [inUse] = await db.select({ id: news.id }).from(news).where(eq(news.lang, code)).limit(1);
  if (inUse) return { ok: false, error: "inUse" };

  await db.delete(newsLanguages).where(eq(newsLanguages.code, code));
  updateTag(NEWS_LANGUAGES_TAG);
  return { ok: true };
}
