/**
 * GC-Stats - news-languages
 *
 * Active news languages (editable from /admin) and a viewer's effective
 * language preference outside of /news itself, resolved from the mirrored
 * cookie or the locale + English default.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { db } from "@gc-stats/db/client";
import { newsLanguages } from "@gc-stats/db";
import { NEWS_LANGUAGES_COOKIE, parseNewsLanguagesCookie } from "@/lib/news-languages-cookie";
import { defaultNewsLanguages } from "@/lib/news-languages-default";
import { NEWS_LANGUAGES_TAG } from "@/lib/cache-tags";
import type { AppLocale } from "@/i18n/routing";

export { defaultNewsLanguages } from "@/lib/news-languages-default";

export type NewsLanguageOption = { code: string; name: string };

/** Active languages, in display order (editable from /admin), read by both the dashboard article language picker and the public news language filter, never a hardcoded list. */
export const listActiveNewsLanguages = unstable_cache(
  async (): Promise<NewsLanguageOption[]> =>
    db
      .select({ code: newsLanguages.code, name: newsLanguages.name })
      .from(newsLanguages)
      .where(eq(newsLanguages.isActive, true))
      .orderBy(asc(newsLanguages.sortOrder), asc(newsLanguages.code)),
  ["news-languages-active"],
  { revalidate: 3600, tags: [NEWS_LANGUAGES_TAG] }
);

/**
 * A viewer's effective news languages outside of `/news` itself (home feed,
 * team/player/org news tabs, ...) — the stored preference (mirrored into a
 * cookie so it's readable at SSR time, see `news-languages-cookie.ts`) when
 * set, else the site locale + English default. `/news` itself layers the
 * explicit `?languages=` URL param on top of this (see its page component).
 */
export async function resolveNewsLanguages(locale: AppLocale): Promise<string[]> {
  const cookieLanguages = parseNewsLanguagesCookie((await cookies()).get(NEWS_LANGUAGES_COOKIE)?.value);
  return cookieLanguages ?? defaultNewsLanguages(locale);
}
