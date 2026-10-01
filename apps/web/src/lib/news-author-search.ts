/**
 * GC-Stats - news-author-search
 *
 * Byline picker search for org-authored articles: searches every existing
 * news_authors profile, not just the current organization's members, since a
 * byline can credit anyone who has ever written on the site.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { db } from "@gc-stats/db/client";
import { newsAuthors } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";
import { or } from "drizzle-orm";

export type NewsAuthorPickerResult = { id: number; name: string; slug: string };

/**
 * Byline picker for org-authored articles (dashboard-news.ts,
 * searchDashboardNewsAuthors) — searches every existing news_authors
 * profile, not just this organization's own members, since a byline can
 * credit anyone who has ever written on the site (e.g. a guest caster).
 */
export async function searchNewsAuthorsQuery(query: string): Promise<NewsAuthorPickerResult[]> {
  const q = query.trim();
  if (!q) {
    return db.select({ id: newsAuthors.id, name: newsAuthors.name, slug: newsAuthors.slug }).from(newsAuthors).orderBy(newsAuthors.name).limit(8);
  }

  const variants = typoVariants(q.toLowerCase());
  const clauses = variants.map((v) => foldedIlike(newsAuthors.name, v));

  return db
    .select({ id: newsAuthors.id, name: newsAuthors.name, slug: newsAuthors.slug })
    .from(newsAuthors)
    .where(or(...clauses))
    .orderBy(newsAuthors.name)
    .limit(8);
}
